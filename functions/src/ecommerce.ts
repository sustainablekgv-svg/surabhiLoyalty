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

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID'; 
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET';

const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
});

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET';

export const createRazorpayOrder = functions.https.onCall(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { amount, currency = 'INR', receipt = 'receipt#1', userId } = request.data;

    if (!amount || !userId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with a valid amount and userId.'
        );
    }

    try {
        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (paise for INR)
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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
         throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required payment details.'
        );
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        // Payment is verified
        await db.collection('payments').doc(razorpay_order_id).update({
            status: 'authorized',
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

    if (!signature) {
        res.status(400).send('Missing signature');
        return;
    }

    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', razorpayWebhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (signature !== expectedSignature) {
        res.status(400).send('Invalid signature');
        return;
    }

    const event = req.body;
    console.log('Razorpay Webhook Event:', event.event);

    try {
        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const orderId = payment.order_id;

            // Update payment record
            await db.collection('payments').doc(orderId).update({
                status: 'captured',
                razorpayPaymentId: payment.id,
                method: payment.method,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update order status in Firestore
            // We need to find the order with this paymentId/razorpayOrderId
            const ordersSnap = await db.collection('orders')
                .where('paymentDetails.razorpay_order_id', '==', orderId)
                .limit(1)
                .get();

            if (!ordersSnap.empty) {
                const orderDoc = ordersSnap.docs[0];
                await orderDoc.ref.update({
                    paymentStatus: 'paid',
                    status: 'received',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        } else if (event.event === 'payment.failed') {
            const payment = event.payload.payment.entity;
            const orderId = payment.order_id;

            await db.collection('payments').doc(orderId).update({
                status: 'failed',
                errorReason: payment.error_description,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const ordersSnap = await db.collection('orders')
                .where('paymentDetails.razorpay_order_id', '==', orderId)
                .limit(1)
                .get();

            if (!ordersSnap.empty) {
                await ordersSnap.docs[0].ref.update({
                    paymentStatus: 'failed',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});
