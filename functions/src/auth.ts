import * as CryptoJS from "crypto-js";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

// Ensure admin is initialized (it might be in index.ts, but safe to call if not)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const SECRET_KEY = process.env.VITE_ENCRYPTION_SECRET || 'default-test-secret-key-32-chars';

const decryptText = (encryptedText: string): string => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plainText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plainText) throw new Error('Decryption failed');
    return plainText;
  } catch (error) {
    logger.error('Decryption failed', error);
    throw error;
  }
};

export const onStaffUpdate = onDocumentWritten("staff/{staffId}", async (event) => {
  const staffId = event.params.staffId;
  const oldData = event.data?.before.data();
  const newData = event.data?.after.data();

  // If deleted, do nothing (or maybe delete user? typically safest to keep auth)
  if (!newData) {
    logger.info(`Staff ${staffId} deleted. No action taken on Auth user.`);
    return;
  }

  const newPasswordEncrypted = newData.staffPassword;
  const oldPasswordEncrypted = oldData?.staffPassword;
  const email = newData.staffEmail;

  // If password hasn't changed, and email hasn't changed, do nothing
  if (newPasswordEncrypted === oldPasswordEncrypted && email === oldData?.staffEmail) {
    return;
  }

  if (!email) {
    logger.warn(`Staff ${staffId} has no email. Cannot sync to Auth.`);
    return;
  }

  if (!newPasswordEncrypted) {
    logger.warn(`Staff ${staffId} has empty password. skipping.`);
    return;
  }

  try {
    const plainPassword = decryptText(newPasswordEncrypted);
    
    // Check if user exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      // Update user
      await admin.auth().updateUser(userRecord.uid, {
        password: plainPassword,
        email: email, // ensure email is synced if changed
        displayName: newData.staffName,
        disabled: newData.staffStatus === 'inactive'
      });
      logger.info(`Synced password for staff ${email}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create user
        await admin.auth().createUser({
          email: email,
          password: plainPassword,
          displayName: newData.staffName,
          uid: staffId, // Optional: use staffId as UID to link them tightly
          disabled: newData.staffStatus === 'inactive'
        });
        logger.info(`Created Auth user for staff ${email}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error(`Failed to sync staff ${staffId} to Auth`, error);
  }
});

export const onCustomerUpdate = onDocumentWritten("Customers/{customerId}", async (event) => {
  const customerId = event.params.customerId;
  const oldData = event.data?.before.data();
  const newData = event.data?.after.data();

  if (!newData) {
    logger.info(`Customer ${customerId} deleted. No action taken on Auth user.`);
    return;
  }

  const newPasswordEncrypted = newData.customerPassword;
  const oldPasswordEncrypted = oldData?.customerPassword;
  const email = newData.customerEmail;

  // If password hasn't changed, and email hasn't changed, do nothing
  if (newPasswordEncrypted === oldPasswordEncrypted && email === oldData?.customerEmail) {
    return;
  }

  if (!email) {
    // Many customers might not have email, which is fine, they just don't use Firebase Auth
    return; 
  }

  if (!newPasswordEncrypted) {
    return;
  }

  try {
    const plainPassword = decryptText(newPasswordEncrypted);
    
    // Check if user exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      // Update user
      await admin.auth().updateUser(userRecord.uid, {
        password: plainPassword,
        email: email,
        displayName: newData.customerName,
        disabled: false // Customers generally don't have a status field like staff
      });
      logger.info(`Synced password for customer ${email}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create user
        await admin.auth().createUser({
          email: email,
          password: plainPassword,
          displayName: newData.customerName,
          uid: customerId,
          disabled: false
        });
        logger.info(`Created Auth user for customer ${email}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error(`Failed to sync customer ${customerId} to Auth`, error);
  }
});
