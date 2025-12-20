import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import Razorpay from 'razorpay';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// const db = admin.firestore();

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

export const createRazorpayOrder = functions.https.onCall(async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { amount, currency = 'INR', receipt = 'receipt#1' } = request.data;

    if (!amount) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The function must be called with a valid amount.'
        );
    }

    try {
        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise for INR)
            currency,
            receipt,
        };

        const order = await razorpay.orders.create(options);
        return order;
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
        // You can update the order status in Firestore here
        return { success: true, message: 'Payment verified successfully' };
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid signature');
    }
});
