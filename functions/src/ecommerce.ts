import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import Razorpay from 'razorpay';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

// Initialize Razorpay
// Note: It's best practice to use environment variables for keys
// use defineString to get environment variables in v2 functions
// but for simplicity here we assume process.env or direct strings if needed for dev
// You should set these via: firebase functions:config:set razorpay.key_id="KEY" razorpay.key_secret="SECRET"
// Or use built-in param support.

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
});

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

type CallableRequestAuth = {
    auth?: {
        uid?: string;
        token?: Record<string, unknown>;
    } | null;
};

const isPrivileged = (request: CallableRequestAuth) =>
    request.auth?.token?.role === 'admin' || request.auth?.token?.role === 'staff';

// Customer documents are keyed by the app's customer ID. In older accounts
// that ID can differ from the Firebase Auth UID, so honor the signed custom
// claim used by Firestore rules as well as the UID.
const ownsAccount = (request: CallableRequestAuth, userId: unknown) =>
    typeof userId === 'string' && (
        userId === request.auth?.uid ||
        userId === request.auth?.token?.docId
    );

const persistCapturedWebhookPayment = async (payment: any) => {
    const orderId = payment.order_id;
    const paymentRef = db.collection('payments').doc(orderId);

    await db.runTransaction(async (transaction) => {
        const paymentSnap = await transaction.get(paymentRef);
        if (!paymentSnap.exists) {
            throw new Error(`No payment record for Razorpay order ${orderId}`);
        }

        const paymentData = paymentSnap.data()!;
        let orderRef: FirebaseFirestore.DocumentReference | undefined;
        let orderData: FirebaseFirestore.DocumentData | undefined;
        if (typeof paymentData.firebaseOrderId === 'string') {
            orderRef = db.collection('orders').doc(paymentData.firebaseOrderId);
            const orderSnap = await transaction.get(orderRef);
            orderData = orderSnap.data();
        } else {
            // Compatibility for payments created before explicit order linking.
            const ordersQuery = db.collection('orders')
                .where('paymentDetails.razorpay_order_id', '==', orderId)
                .limit(1);
            const ordersSnap = await transaction.get(ordersQuery);
            if (!ordersSnap.empty) {
                orderRef = ordersSnap.docs[0].ref;
                orderData = ordersSnap.docs[0].data();
            }
        }
        if (!orderRef || !orderData || orderData.paymentDetails?.razorpay_order_id !== orderId) {
            throw new Error(`No matching order record for Razorpay order ${orderId}`);
        }

        const expectedAmountPaise = Number(paymentData.amountPaise ?? Math.round(Number(paymentData.amount) * 100));
        const orderAmountPaise = Math.round(Number(orderData.totalAmount) * 100);
        if (paymentData.razorpayOrderId !== orderId ||
            payment.amount !== expectedAmountPaise ||
            payment.currency !== paymentData.currency ||
            payment.amount !== orderAmountPaise ||
            paymentData.userId !== orderData.userId) {
            throw new Error(`Captured Razorpay payment does not match order ${orderId}`);
        }

        const alreadyPaid = orderData.paymentStatus === 'paid';
        if (paymentData.status === 'captured' && paymentData.razorpayPaymentId !== payment.id) {
            if (alreadyPaid) return;
            throw new Error(`A different payment is already captured for Razorpay order ${orderId}`);
        }

        transaction.set(paymentRef, {
            status: 'captured',
            razorpayPaymentId: payment.id,
            method: payment.method,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        transaction.update(orderRef, {
            paymentStatus: 'paid',
            // Duplicate and delayed webhooks must not roll back fulfillment.
            ...(alreadyPaid ? {} : { status: 'received' }),
            'paymentDetails.razorpay_payment_id': payment.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...(alreadyPaid ? {} : {
                timeline: admin.firestore.FieldValue.arrayUnion({
                    status: 'paid',
                    // Firestore rejects serverTimestamp() nested inside an array.
                    timestamp: admin.firestore.Timestamp.now(),
                    note: `Online Payment Successful (ID: ${payment.id})`,
                }),
            }),
        });
    });
};

export const createRazorpayOrder = functions.https.onCall(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { amount, currency = 'INR', userId } = request.data || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000 || !userId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with a valid amount and userId.'
        );
    }
    if (!razorpayKeyId || !razorpayKeySecret) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment service is not configured.');
    }
    if (currency !== 'INR' || typeof userId !== 'string' ||
        (!isPrivileged(request) && !ownsAccount(request, userId))) {
        throw new functions.https.HttpsError('permission-denied', 'You may only create payments for your own account.');
    }

    try {
        const amountPaise = Math.round(numericAmount * 100);
        const receipt = `checkout_${request.auth.uid?.slice(0, 8) || 'customer'}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const options = {
            amount: amountPaise, // amount in the smallest currency unit (paise for INR)
            currency,
            receipt,
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Store payment record in DB
        await db.collection('payments').doc(razorpayOrder.id).set({
            id: razorpayOrder.id,
            userId,
            amount: numericAmount,
            amountPaise,
            currency,
            status: 'created',
            razorpayOrderId: razorpayOrder.id,
            receipt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Return the key that created this order so Checkout cannot mix test
        // and live keys through a stale or missing browser environment value.
        return { ...razorpayOrder, keyId: razorpayKeyId };
    } catch (error: any) {
        console.error('Error creating Razorpay order:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Unable to create order');
    }
});

export const linkRazorpayOrderToFirebaseOrder = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { razorpay_order_id, firebaseOrderId } = request.data || {};
    if (typeof razorpay_order_id !== 'string' || !razorpay_order_id ||
        typeof firebaseOrderId !== 'string' || !firebaseOrderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing payment or order reference.');
    }

    const paymentRef = db.collection('payments').doc(razorpay_order_id);
    const orderRef = db.collection('orders').doc(firebaseOrderId);

    await db.runTransaction(async (transaction) => {
        const paymentSnap = await transaction.get(paymentRef);
        const orderSnap = await transaction.get(orderRef);
        const paymentData = paymentSnap.data();
        const orderData = orderSnap.data();

        if (!paymentSnap.exists || !ownsAccount(request, paymentData?.userId)) {
            throw new functions.https.HttpsError('permission-denied', 'Payment does not belong to this account.');
        }
        if (!orderSnap.exists || !ownsAccount(request, orderData?.userId)) {
            throw new functions.https.HttpsError('permission-denied', 'Order does not belong to this account.');
        }
        if (paymentData?.razorpayOrderId !== razorpay_order_id ||
            orderData?.paymentMethod !== 'online' ||
            orderData?.paymentDetails?.razorpay_order_id !== razorpay_order_id) {
            throw new functions.https.HttpsError('failed-precondition', 'Payment does not match this order.');
        }

        const paymentAmountPaise = Number(paymentData.amountPaise ?? Math.round(Number(paymentData.amount) * 100));
        const orderAmountPaise = Math.round(Number(orderData.totalAmount) * 100);
        if (!Number.isFinite(paymentAmountPaise) || paymentAmountPaise !== orderAmountPaise ||
            paymentData.currency !== 'INR') {
            throw new functions.https.HttpsError('failed-precondition', 'Payment amount or currency does not match this order.');
        }

        if (paymentData.firebaseOrderId && paymentData.firebaseOrderId !== firebaseOrderId) {
            throw new functions.https.HttpsError('already-exists', 'This payment is already linked to another order.');
        }

        transaction.set(paymentRef, {
            firebaseOrderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });

    return { success: true };
});

/**
 * Creates customer checkout orders and reserves redeemed credits atomically.
 * Customer documents are intentionally client-write protected by Firestore
 * rules, so checkout must perform these related writes through Admin SDK.
 */
export const createCheckoutOrder = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in before placing an order.');
    }

    const order = request.data?.order;
    if (!order || typeof order !== 'object' || Array.isArray(order)) {
        throw new functions.https.HttpsError('invalid-argument', 'Order details are required.');
    }
    if (typeof order.userId !== 'string' || !ownsAccount(request, order.userId)) {
        throw new functions.https.HttpsError('permission-denied', 'You may only place orders for your own account.');
    }
    if (!['cod', 'online'].includes(order.paymentMethod) || order.paymentStatus !== 'pending' ||
        !Array.isArray(order.items) || order.items.length === 0 ||
        !Number.isFinite(Number(order.totalAmount)) || Number(order.totalAmount) < 0 ||
        !order.shippingAddress || typeof order.shippingAddress !== 'object') {
        throw new functions.https.HttpsError('invalid-argument', 'Order details are incomplete or invalid.');
    }
    if (order.paymentMethod === 'online' && Number(order.totalAmount) < 1) {
        throw new functions.https.HttpsError('invalid-argument', 'Online payments must be at least ₹1.');
    }

    const surabhiUsed = Number(order.surabhiCoinsUsed || 0);
    const shippingUsed = Number(order.shippingPointsUsed || 0);
    if (!Number.isFinite(surabhiUsed) || surabhiUsed < 0 ||
        !Number.isFinite(shippingUsed) || shippingUsed < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Redeemed credit amounts are invalid.');
    }

    const paymentDetails = order.paymentDetails && typeof order.paymentDetails === 'object'
        ? order.paymentDetails
        : {};
    const razorpayOrderId = order.paymentMethod === 'online' ? paymentDetails.razorpay_order_id : undefined;
    if (order.paymentMethod === 'online' && (typeof razorpayOrderId !== 'string' || !razorpayOrderId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Razorpay order reference is missing.');
    }

    const customerRef = db.collection('Customers').doc(order.userId);
    const orderRef = db.collection('orders').doc();
    const paymentRef = razorpayOrderId ? db.collection('payments').doc(razorpayOrderId) : undefined;

    await db.runTransaction(async (transaction) => {
        const customerSnap = await transaction.get(customerRef);
        if (!customerSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Customer account was not found.');
        }
        const paymentSnap = paymentRef ? await transaction.get(paymentRef) : undefined;
        const customerData = customerSnap.data()!;

        if (surabhiUsed > 0) {
            const balance = Number(customerData.surabhiBalance || 0);
            const pending = Number(customerData.pendingSurabhiCoins || 0);
            if (!Number.isFinite(balance) || !Number.isFinite(pending) || balance < 0 || pending < 0 || surabhiUsed > balance - pending) {
                throw new functions.https.HttpsError('failed-precondition', 'Surabhi credit balance changed. Refresh and try again.');
            }
        }
        if (shippingUsed > 0) {
            const balance = Number(customerData.shippingBalance || 0);
            const pending = Number(customerData.pendingShippingBalance || 0);
            if (!Number.isFinite(balance) || !Number.isFinite(pending) || balance < 0 || pending < 0 || shippingUsed > balance - pending) {
                throw new functions.https.HttpsError('failed-precondition', 'Shipping credit balance changed. Refresh and try again.');
            }
        }

        if (paymentRef) {
            const paymentData = paymentSnap?.data();
            const amountPaise = Number(paymentData?.amountPaise ?? Math.round(Number(paymentData?.amount) * 100));
            if (!paymentSnap?.exists || !ownsAccount(request, paymentData?.userId) ||
                paymentData?.razorpayOrderId !== razorpayOrderId || paymentData?.currency !== 'INR' ||
                amountPaise !== Math.round(Number(order.totalAmount) * 100) ||
                (paymentData?.firebaseOrderId && paymentData.firebaseOrderId !== orderRef.id)) {
                throw new functions.https.HttpsError('failed-precondition', 'Razorpay payment does not match this order.');
            }

            transaction.set(paymentRef, {
                firebaseOrderId: orderRef.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        const customerUpdates: Record<string, number> = {};
        if (surabhiUsed > 0) {
            customerUpdates.pendingSurabhiCoins = Number(customerData.pendingSurabhiCoins || 0) + surabhiUsed;
        }
        if (shippingUsed > 0) {
            customerUpdates.pendingShippingBalance = Number(customerData.pendingShippingBalance || 0) + shippingUsed;
        }
        if (Object.keys(customerUpdates).length > 0) transaction.update(customerRef, customerUpdates);

        const checkoutOrder = {
            userId: order.userId,
            items: order.items,
            totalAmount: Number(order.totalAmount),
            totalTax: Number(order.totalTax || 0),
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            paymentStatus: 'pending',
            shippingPointsEarned: Number(order.shippingPointsEarned || 0),
            shippingPointsUsed: shippingUsed,
            netShippingCharges: Number(order.netShippingCharges || 0),
            surabhiCoinsUsed: surabhiUsed,
            surabhiCoinsEarned: Number(order.surabhiCoinsEarned || 0),
            sevaCoinsEarned: Number(order.sevaCoinsEarned || 0),
            referralBonusEarned: Number(order.referralBonusEarned || 0),
            demoStore: order.demoStore === true,
            ...(paymentRef ? { paymentDetails: { razorpay_order_id: razorpayOrderId, status: 'created' } } : {}),
            status: 'received',
            timeline: [{
                status: 'received',
                timestamp: admin.firestore.Timestamp.now(),
                note: 'Order placed successfully',
            }],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        transaction.create(orderRef, checkoutOrder);
    });

    return { success: true, firebaseOrderId: orderRef.id };
});

export const verifyRazorpayPayment = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, firebaseOrderId } = request.data || {};

    if (typeof razorpay_order_id !== 'string' || !razorpay_order_id ||
        typeof razorpay_payment_id !== 'string' || !razorpay_payment_id ||
        typeof razorpay_signature !== 'string' || !razorpay_signature ||
        typeof firebaseOrderId !== 'string' || !firebaseOrderId) {
         throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required payment or order details.'
        );
    }

    const payment = await db.collection('payments').doc(razorpay_order_id).get();
    if (!payment.exists || (!isPrivileged(request) && !ownsAccount(request, payment.data()?.userId))) {
        throw new functions.https.HttpsError('permission-denied', 'Payment does not belong to this account.');
    }
    if (!razorpayKeySecret) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment service is not configured.');
    }

    const paymentData = payment.data()!;
    const storedRazorpayOrderId = paymentData.razorpayOrderId;
    if (storedRazorpayOrderId !== razorpay_order_id) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment order reference does not match.');
    }
    if (paymentData.firebaseOrderId && paymentData.firebaseOrderId !== firebaseOrderId) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment is linked to a different order.');
    }

    // Use the server-stored order ID for signature verification, then fetch
    // the payment from Razorpay before changing the customer order.
    const body = storedRazorpayOrderId + '|' + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

    const expected = Buffer.from(expectedSignature, 'utf8');
    const actual = Buffer.from(String(razorpay_signature), 'utf8');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid signature');
    }

    let razorpayPayment: any;
    try {
        razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
        if (razorpayPayment.order_id !== storedRazorpayOrderId) {
            throw new functions.https.HttpsError('failed-precondition', 'Payment does not belong to this Razorpay order.');
        }

        const expectedAmountPaise = Number(paymentData.amountPaise ?? Math.round(Number(paymentData.amount) * 100));
        if (razorpayPayment.amount !== expectedAmountPaise || razorpayPayment.currency !== paymentData.currency) {
            throw new functions.https.HttpsError('failed-precondition', 'Razorpay payment amount or currency does not match the order.');
        }

        if (razorpayPayment.status === 'authorized' && !razorpayPayment.captured) {
            try {
                razorpayPayment = await razorpay.payments.capture(
                    razorpay_payment_id,
                    razorpayPayment.amount,
                    razorpayPayment.currency,
                );
            } catch (captureError) {
                // Auto-capture can win this race. Fetch once more and accept
                // only a captured result; otherwise let the webhook reconcile.
                razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
                if (razorpayPayment.order_id !== storedRazorpayOrderId) throw captureError;
            }
        }
    } catch (error: any) {
        if (error instanceof functions.https.HttpsError) throw error;
        console.error('Unable to confirm Razorpay payment status:', error);
        throw new functions.https.HttpsError('unavailable', 'Payment is still being confirmed by Razorpay.');
    }

    const isCaptured = razorpayPayment.status === 'captured' || razorpayPayment.captured === true;
    if (!isCaptured && razorpayPayment.status !== 'authorized') {
        throw new functions.https.HttpsError('failed-precondition', `Razorpay payment is ${razorpayPayment.status || 'not captured'}.`);
    }

    {
        // Validate the linked order before changing either record, then commit
        // both writes together. Retrying the callback after a lost response is
        // safe because these updates are idempotent.
        const orderRef = db.collection('orders').doc(firebaseOrderId);

        const paymentRef = db.collection('payments').doc(razorpay_order_id);
        const captured = await db.runTransaction(async (transaction) => {
            const currentPayment = await transaction.get(paymentRef);
            if (!currentPayment.exists || (!isPrivileged(request) && !ownsAccount(request, currentPayment.data()?.userId))) {
                throw new functions.https.HttpsError('permission-denied', 'Payment does not belong to this account.');
            }
            if (currentPayment.data()?.firebaseOrderId && currentPayment.data()?.firebaseOrderId !== firebaseOrderId) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment is linked to a different order.');
            }

            const currentOrder = await transaction.get(orderRef);
            const orderData = currentOrder.data();
            if (!currentOrder.exists || !ownsAccount(request, orderData?.userId)) {
                throw new functions.https.HttpsError('permission-denied', 'Order does not belong to this account.');
            }
            if (orderData?.paymentDetails?.razorpay_order_id !== razorpay_order_id) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment does not match this order.');
            }
            const expectedAmountPaise = Number(currentPayment.data()?.amountPaise ?? Math.round(Number(currentPayment.data()?.amount) * 100));
            const orderAmountPaise = Math.round(Number(orderData?.totalAmount) * 100);
            if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise !== orderAmountPaise) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment amount does not match this order.');
            }

            const paymentAlreadyCaptured = currentPayment.data()?.status === 'captured';
            if (paymentAlreadyCaptured && currentPayment.data()?.razorpayPaymentId !== razorpay_payment_id) {
                if (orderData.paymentStatus === 'paid') return true;
                throw new functions.https.HttpsError('failed-precondition', 'A different payment is already captured for this order.');
            }
            const paymentIsCaptured = isCaptured || paymentAlreadyCaptured;

            transaction.set(paymentRef, {
                status: paymentIsCaptured ? 'captured' : 'authorized',
                ...(paymentAlreadyCaptured ? {} : {
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    method: razorpayPayment.method,
                }),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            // A valid checkout signature confirms payment authenticity, but
            // fulfillment waits until Razorpay reports the funds captured.
            if (!paymentIsCaptured) return false;

            if (orderData.paymentStatus === 'paid') return true;

            transaction.update(orderRef, {
                paymentStatus: 'paid',
                status: 'received',
                'paymentDetails.razorpay_payment_id': razorpay_payment_id,
                'paymentDetails.razorpay_signature': razorpay_signature,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                timeline: admin.firestore.FieldValue.arrayUnion({
                    status: 'paid',
                    // Firestore does not allow serverTimestamp() inside an array.
                    timestamp: admin.firestore.Timestamp.now(),
                    note: `Online Payment Successful (ID: ${razorpay_payment_id})`,
                }),
            });
            return true;
        });
        return captured
            ? { success: true, status: 'captured', message: 'Payment verified and captured successfully' }
            : { success: false, status: 'authorized', message: 'Payment is authorized and awaiting capture' };
    }
});

/**
 * Webhook handler for Razorpay events
 */
export const razorpayWebhook = functions.https.onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature || !razorpayWebhookSecret || !req.rawBody) {
        res.status(400).send('Missing signature');
        return;
    }

    // Verify signature using raw body for robustness
    const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(req.rawBody)
        .digest('hex');

    const expectedBytes = Buffer.from(expectedSignature, 'utf8');
    const signatureBytes = Buffer.from(signature, 'utf8');
    if (expectedBytes.length !== signatureBytes.length || !crypto.timingSafeEqual(expectedBytes, signatureBytes)) {
        console.error('Razorpay Webhook Signature Verification Failed');
        res.status(400).send('Invalid signature');
        return;
    }

    const event = req.body;

    try {
        if (!event || typeof event.event !== 'string') {
            res.status(400).send('Invalid webhook payload');
            return;
        }

        if (event.event === 'payment.captured') {
            const payment = event.payload?.payment?.entity;
            if (!payment || !payment.order_id || !payment.id || !Number.isFinite(payment.amount) || !payment.currency) {
                res.status(400).send('Invalid captured payment payload');
                return;
            }
            await persistCapturedWebhookPayment(payment);
        } else if (event.event === 'payment.authorized') {
            const payment = event.payload?.payment?.entity;
            if (!payment?.order_id || !payment.id) {
                res.status(400).send('Invalid authorized payment payload');
                return;
            }

            // The success callback might never reach the browser. Reconcile
            // authorized events here as well, so capture and order confirmation
            // still complete from the server.
            const knownPayment = await db.collection('payments').doc(payment.order_id).get();
            if (knownPayment.data()?.status === 'captured' &&
                knownPayment.data()?.razorpayPaymentId !== payment.id) {
                res.status(200).send('Another payment for this order is already captured');
                return;
            }

            let latestPayment = await razorpay.payments.fetch(payment.id);
            if (latestPayment.order_id !== payment.order_id) {
                throw new Error('Authorized payment belongs to a different Razorpay order');
            }
            const knownPaymentData = knownPayment.data();
            const expectedAmountPaise = Number(knownPaymentData?.amountPaise ?? Math.round(Number(knownPaymentData?.amount) * 100));
            if (!knownPayment.exists || knownPaymentData?.razorpayOrderId !== payment.order_id ||
                latestPayment.amount !== expectedAmountPaise || latestPayment.currency !== knownPaymentData?.currency) {
                throw new Error('Authorized Razorpay payment does not match the stored order');
            }
            if (latestPayment.status === 'authorized' && !latestPayment.captured) {
                try {
                    latestPayment = await razorpay.payments.capture(
                        payment.id,
                        latestPayment.amount,
                        latestPayment.currency,
                    );
                } catch (captureError) {
                    latestPayment = await razorpay.payments.fetch(payment.id);
                    if (latestPayment.order_id !== payment.order_id) throw captureError;
                }
            }

            if (latestPayment.status === 'captured' || latestPayment.captured === true) {
                await persistCapturedWebhookPayment(latestPayment);
            } else if (latestPayment.status === 'authorized') {
                throw new Error(`Razorpay payment ${payment.id} is awaiting capture`);
            }
        } else if (event.event === 'payment.failed') {
            const payment = event.payload?.payment?.entity;
            if (!payment?.order_id || !payment.id) {
                res.status(400).send('Invalid failed payment payload');
                return;
            }
            const orderId = payment.order_id;
            const errorMsg = payment.error_description || 'Payment Failed';
            const paymentRef = db.collection('payments').doc(orderId);

            await db.runTransaction(async (transaction) => {
                const paymentSnap = await transaction.get(paymentRef);
                const existingStatus = paymentSnap.data()?.status;
                // Failed events describe an individual attempt. Keep already
                // confirmed payments confirmed and leave the order pending so
                // a customer can retry or a later captured event can settle it.
                if (existingStatus === 'captured' || existingStatus === 'authorized') return;

                transaction.set(paymentRef, {
                    status: 'failed',
                    errorReason: errorMsg,
                    lastFailedPaymentId: payment.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
