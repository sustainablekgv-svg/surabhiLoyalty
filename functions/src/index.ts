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
import * as quarterly from './quartleryCheck';

export const checkQuarterlyCriteria = quarterly.checkQuarterlyCriteria;
export const createRazorpayOrder = ecommerce.createRazorpayOrder;
export const verifyRazorpayPayment = ecommerce.verifyRazorpayPayment;
export const createR2UploadUrl = cloudflare.createR2UploadUrl;
export const deleteImageFromR2 = cloudflare.deleteImageFromR2;
export const onStaffUpdate = auth.onStaffUpdate;
export const onCustomerUpdate = auth.onCustomerUpdate;
