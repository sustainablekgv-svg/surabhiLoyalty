import 'dotenv/config';
import './ensureGcpRuntimeCredentials';
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {setGlobalOptions} from "firebase-functions";
// import {onRequest} from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
// setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as auth from './auth';
import * as cloudflare from './cloudflare';
import * as ecommerce from './ecommerce';
import {
  checkOjivaBalance as checkOjivaBalanceFn,
  resetCustomerPassword as resetCustomerPasswordFn,
  sendOjivaNotification as sendOjivaNotificationFn,
  sendPhoneOtp as sendPhoneOtpFn,
  verifyPhoneOtp as verifyPhoneOtpFn,
} from './ojivaSms';
import * as quarterly from './quartleryCheck';
import { sendSaleNotificationSms as sendSaleNotificationSmsFn } from './saleSms';
import { syncFirebaseAuthForUpload as syncFirebaseAuthForUploadFn } from './syncAuthForUpload';

export const checkQuarterlyCriteria = quarterly.checkQuarterlyCriteria;
export const createRazorpayOrder = ecommerce.createRazorpayOrder;
export const verifyRazorpayPayment = ecommerce.verifyRazorpayPayment;
export const razorpayWebhook = ecommerce.razorpayWebhook;
export const createR2UploadUrl = cloudflare.createR2UploadUrl;
export const deleteImageFromR2 = cloudflare.deleteImageFromR2;
/** HTTP variant with explicit CORS — use from web clients when callable preflight fails. */
export const deleteImageFromR2Http = cloudflare.deleteImageFromR2Http;
export const syncFirebaseAuthForUpload = syncFirebaseAuthForUploadFn;
export const onStaffUpdate = auth.onStaffUpdate;
export const onCustomerUpdate = auth.onCustomerUpdate;
/** A2Z SMS: notify customer after a sale (credentials in Cloud Function env). */
export const sendSaleNotificationSms = sendSaleNotificationSmsFn;
/** OJIVA.AI SMS: transactional notifications (coins credited, referrer, etc.). */
export const sendOjivaNotification = sendOjivaNotificationFn;
/** OJIVA.AI SMS: send 6-digit OTP for signup / reset / coin redemption / sales return. */
export const sendPhoneOtp = sendPhoneOtpFn;
/** OJIVA.AI SMS: verify the OTP issued by `sendPhoneOtp`. */
export const verifyPhoneOtp = verifyPhoneOtpFn;
/** Forgot-password reset; consumes a `verifyPhoneOtp` token. */
export const resetCustomerPassword = resetCustomerPasswordFn;
export const checkOjivaBalance = checkOjivaBalanceFn;
