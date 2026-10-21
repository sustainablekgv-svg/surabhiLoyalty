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

export const createRazorpayOrder = functions.https.onCall(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { amount, currency = 'INR', receipt = 'receipt#1', userId } = request.data || {};

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
        const options = {
            amount: Math.round(numericAmount * 100), // amount in the smallest currency unit (paise for INR)
            currency,
            receipt,
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Store payment record in DB
        await db.collection('payments').doc(razorpayOrder.id).set({
            id: razorpayOrder.id,
            userId,
            amount,
            currency,
            status: 'created',
            razorpayOrderId: razorpayOrder.id,
            receipt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return razorpayOrder;
    } catch (error: any) {
        console.error('Error creating Razorpay order:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Unable to create order');
    }
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

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const payment = await db.collection('payments').doc(razorpay_order_id).get();
    if (!payment.exists || (!isPrivileged(request) && !ownsAccount(request, payment.data()?.userId))) {
        throw new functions.https.HttpsError('permission-denied', 'Payment does not belong to this account.');
    }
    if (!razorpayKeySecret) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment service is not configured.');
    }

    const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

    const expected = Buffer.from(expectedSignature, 'utf8');
    const actual = Buffer.from(String(razorpay_signature), 'utf8');
    if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
        // Validate the linked order before changing either record, then commit
        // both writes together. Retrying the callback after a lost response is
        // safe because these updates are idempotent.
        const orderRef = db.collection('orders').doc(firebaseOrderId);

        const paymentRef = db.collection('payments').doc(razorpay_order_id);
        await db.runTransaction(async (transaction) => {
            const currentPayment = await transaction.get(paymentRef);
            if (!currentPayment.exists || (!isPrivileged(request) && !ownsAccount(request, currentPayment.data()?.userId))) {
                throw new functions.https.HttpsError('permission-denied', 'Payment does not belong to this account.');
            }

            const currentOrder = await transaction.get(orderRef);
            const orderData = currentOrder.data();
            if (!currentOrder.exists || !ownsAccount(request, orderData?.userId)) {
                throw new functions.https.HttpsError('permission-denied', 'Order does not belong to this account.');
            }
            if (orderData?.paymentDetails?.razorpay_order_id !== razorpay_order_id) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment does not match this order.');
            }
            const expectedAmountPaise = Math.round(Number(currentPayment.data()?.amount) * 100);
            const orderAmountPaise = Math.round(Number(orderData?.totalAmount) * 100);
            if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise !== orderAmountPaise) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment amount does not match this order.');
            }

            transaction.set(paymentRef, {
                status: currentPayment.data()?.status === 'captured' ? 'captured' : 'authorized',
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            transaction.update(orderRef, {
                paymentStatus: 'paid',
                ...(orderData.paymentStatus === 'paid' ? {} : { status: 'received' }),
                'paymentDetails.razorpay_payment_id': razorpay_payment_id,
                'paymentDetails.razorpay_signature': razorpay_signature,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                timeline: admin.firestore.FieldValue.arrayUnion({
                    status: 'paid',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    note: `Online Payment Successful (ID: ${razorpay_payment_id})`,
                }),
            });
        });
        return { success: true, message: 'Payment verified successfully' };
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid signature');
    }
});

/**
 * Webhook handler for Razorpay events
 */
export const razorpayWebhook = functions.https.onRequest({ cors: true }, async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature || !razorpayWebhookSecret) {
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
    // console.log('Razorpay Webhook Event:', event.event);

    try {
        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const orderId = payment.order_id;
            const paymentRef = db.collection('payments').doc(orderId);
            const ordersQuery = db.collection('orders')
                .where('paymentDetails.razorpay_order_id', '==', orderId)
                .limit(1);

            await db.runTransaction(async (transaction) => {
                const paymentSnap = await transaction.get(paymentRef);
                const ordersSnap = await transaction.get(ordersQuery);
                if (paymentSnap.data()?.status === 'captured') return;

                transaction.set(paymentRef, {
                    status: 'captured',
                    razorpayPaymentId: payment.id,
                    method: payment.method,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                if (!ordersSnap.empty) {
                    const orderDoc = ordersSnap.docs[0];
                    const orderData = orderDoc.data();
                    transaction.update(orderDoc.ref, {
                        paymentStatus: 'paid',
                        // A duplicate or delayed capture webhook must not roll
                        // back an order that has already moved through fulfillment.
                        ...((orderData.paymentStatus === 'paid') ? {} : { status: 'received' }),
                        'paymentDetails.razorpay_payment_id': payment.id,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        timeline: admin.firestore.FieldValue.arrayUnion({
                            status: 'paid',
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            note: `Online Payment Successful (ID: ${payment.id})`
                        })
                    });
                }
            });
        } else if (event.event === 'payment.failed') {
            const payment = event.payload.payment.entity;
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
