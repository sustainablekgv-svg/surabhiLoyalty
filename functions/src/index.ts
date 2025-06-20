/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

interface UserRecordData {
  uid: string;
  name: string;
  mobile: string;
  email?: string;
  storeLocation: string;
  createdAt: string;
}

export const createUserRecord = functions.https.onCall(
  async (data: UserRecordData, context: functions.https.CallableContext): Promise<{ success: boolean }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Only authenticated users can create customer records.'
      );
    }

    const { uid, name, mobile, email, storeLocation, createdAt } = data;

    if (!uid || !name || !mobile || !storeLocation || !createdAt) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: uid, name, mobile, storeLocation, createdAt.'
      );
    }

    try {
      const userRef = admin.database().ref(`users/${uid}`);
      await userRef.set({
        name,
        mobile,
        email: email || null,
        storeLocation,
        createdAt,
        role: 'customer',
        status: 'active',
      });

      const mobileRef = admin.database().ref(`mobileNumbers/${mobile}`);
      await mobileRef.set(uid);

      return { success: true };
    } catch (error: any) {
      console.error('Error creating user record:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to create user record.'
      );
    }
  }
);
