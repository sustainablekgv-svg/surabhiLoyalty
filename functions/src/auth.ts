import * as CryptoJS from "crypto-js";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { hashSecret, isSecretHash, verifySecretHash } from './credentialSecurity';

// Ensure admin is initialized (it might be in index.ts, but safe to call if not)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

import * as dotenv from 'dotenv';
dotenv.config();

const SECRET_KEY = process.env.ENCRYPTION_SECRET || process.env.VITE_ENCRYPTION_SECRET || '';
if (!SECRET_KEY) {
  logger.error('ENCRYPTION_SECRET is not configured; password operations will fail closed.');
}


const decryptText = (encryptedText: string): string => {
  if (!SECRET_KEY) throw new Error('Server encryption is not configured');
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
  if (isSecretHash(newPasswordEncrypted)) return;

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
  if (isSecretHash(newPasswordEncrypted)) return;

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

const passwordMatches = async (stored: string | undefined, plain: string): Promise<{ valid: boolean; legacy: boolean }> => {
  if (!stored) return { valid: false, legacy: false };
  if (isSecretHash(stored)) return { valid: await verifySecretHash(stored, plain), legacy: false };
  try {
    const decrypted = decryptText(stored);
    if (decrypted.trim() === plain.trim()) return { valid: true, legacy: true };
  } catch {
    // Plaintext fallback
  }
  return { valid: stored.trim() === plain.trim(), legacy: true };
};

/**
 * Secure Server-Side Login
 * Authenticates user credentials, sets custom claims (role), and issues a Firebase Custom Token.
 * Supports smart role detection: if a user logs in from customer form but is staff/admin (or vice versa),
 * it seamlessly authenticates their verified account and returns their proper role and dashboard access.
 */
export const loginWithCredentials = functions.https.onCall(
  { region: 'us-central1', cors: true },  
  async (request: functions.https.CallableRequest<any>) => {
    const { mobile, password, role } = request.data || {};
    if (!mobile || !password) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Mobile number and password are required.'
      );
    }

    const cleanMobile = String(mobile).replace(/\D/g, '').slice(-10);
    const cleanPassword = String(password).trim();
    if (cleanMobile.length !== 10) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Please enter a valid 10-digit mobile number.'
      );
    }

    const db = admin.firestore();
    let userDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let userData: any = null;
    let matchedLegacyPassword = false;
    let userRole = role || 'customer';

    const checkStaff = async () => {
      const snap = await db.collection('staff').where('staffMobile', '==', cleanMobile).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        const match = await passwordMatches(data.staffPassword, cleanPassword);
        if (match.valid) {
          return { doc, data, role: data.role || 'staff', legacy: match.legacy };
        }
      }
      return null;
    };

    const checkCustomer = async () => {
      const snap = await db.collection('Customers').where('customerMobile', '==', cleanMobile).get();
      if (!snap.empty) {
        const sorted = [...snap.docs].sort((a, b) => {
          const dA = a.data();
          const dB = b.data();
          const sA = (dA.surabhiBalance || 0) + (dA.cumTotal || 0) + (dA.shippingBalance || 0);
          const sB = (dB.surabhiBalance || 0) + (dB.cumTotal || 0) + (dB.shippingBalance || 0);
          return sB - sA;
        });
        for (const doc of sorted) {
          const data = doc.data();
          const match = await passwordMatches(data.customerPassword, cleanPassword);
          if (match.valid) {
            return { doc, data, role: 'customer', legacy: match.legacy };
          }
        }
      }
      return null;
    };

    // Primary check according to role preference
    if (role === 'staff' || role === 'admin') {
      const staffRes = await checkStaff();
      if (staffRes) {
        userDoc = staffRes.doc;
        userData = staffRes.data;
        userRole = staffRes.role;
        matchedLegacyPassword = staffRes.legacy;
      } else {
        // Fallback: check customer accounts
        const custRes = await checkCustomer();
        if (custRes) {
          userDoc = custRes.doc;
          userData = custRes.data;
          userRole = 'customer';
          matchedLegacyPassword = custRes.legacy;
        }
      }
    } else {
      // Default: check customer accounts first
      const custRes = await checkCustomer();
      if (custRes) {
        userDoc = custRes.doc;
        userData = custRes.data;
        userRole = 'customer';
        matchedLegacyPassword = custRes.legacy;
      } else {
        // Fallback: check staff/admin accounts
        const staffRes = await checkStaff();
        if (staffRes) {
          userDoc = staffRes.doc;
          userData = staffRes.data;
          userRole = staffRes.role;
          matchedLegacyPassword = staffRes.legacy;
        }
      }
    }

    if (!userDoc || !userData) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Invalid mobile number or credentials.'
      );
    }

    if (matchedLegacyPassword) {
      const passwordField = userRole === 'customer' ? 'customerPassword' : 'staffPassword';
      await userDoc.ref.update({ [passwordField]: await hashSecret(cleanPassword) });
      userData = { ...userData, [passwordField]: undefined };
    }

    // Check active status for staff accounts
    if (userRole === 'staff' && userData.staffStatus !== 'active') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Staff account is inactive. Please contact your administrator.'
      );
    }

    const authUid = userDoc.id;
    let targetUid = authUid;
    const email =
      (userRole === 'customer' ? userData.customerEmail : userData.staffEmail) ||
      `${cleanMobile}@surabhiloyalty.local`;
    const displayName =
      (userRole === 'customer' ? userData.customerName : userData.staffName) || cleanMobile;

    // Ensure Auth user exists with UID matching document ID or handle existing email
    try {
      await admin.auth().getUser(authUid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        try {
          await admin.auth().createUser({
            uid: authUid,
            email: email,
            displayName: displayName,
          });
        } catch (createErr: any) {
          logger.warn(`Could not create Auth user with uid ${authUid}:`, createErr);
          if (createErr.code === 'auth/email-already-exists') {
            try {
              // Try creating with a unique virtual email for this UID
              await admin.auth().createUser({
                uid: authUid,
                email: `${cleanMobile}.${authUid.slice(0, 6)}@surabhiloyalty.local`,
                displayName: displayName,
              });
            } catch (virtualErr) {
              try {
                const existing = await admin.auth().getUserByEmail(email);
                targetUid = existing.uid;
              } catch (lookupErr) {
                logger.error('Failed to locate existing user by email:', lookupErr);
              }
            }
          }
        }
      }
    }

    const claims = {
      role: userRole,
      storeLocation: userData.storeLocation || null,
      docId: userDoc.id,
      customerMobile: cleanMobile,
    };

    // Set Custom Claims and mint Custom Token
    await admin.auth().setCustomUserClaims(targetUid, claims);
    const customToken = await admin.auth().createCustomToken(targetUid, claims);

    const safeUser = {
      ...userData,
      id: userDoc.id,
      role: userRole,
    };
    delete safeUser.customerPassword;
    delete safeUser.staffPassword;

    logger.info(`User ${cleanMobile} successfully authenticated with role ${userRole}`);
    return {
      customToken,
      user: safeUser,
    };
  }
);

/**
 * Secure Server-Side Customer Registration
 * Validates inputs, checks uniqueness, sets initial zero-balances, and provisions Auth.
 */
export const registerCustomerAccount = functions.https.onCall(
  { region: 'us-central1', cors: true },
  async (request: functions.https.CallableRequest<any>) => {
    const data = request.data || {};
    const cleanMobile = String(data.customerMobile || '').replace(/\D/g, '').slice(-10);
    const cleanPassword = String(data.customerPassword || '').trim();
    const name = String(data.customerName || '').trim();

    if (!name || cleanMobile.length !== 10 || cleanPassword.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Name, valid 10-digit mobile number, and minimum 6-character password are required.'
      );
    }

    const db = admin.firestore();
    const existing = await db.collection('Customers').where('customerMobile', '==', cleanMobile).get();
    if (!existing.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'A customer with this mobile number already exists.'
      );
    }

    let realReferredByMobile: string | null = null;
    let referrerDocId: string | null = null;

    if (data.referredBy) {
      const trimmed = String(data.referredBy).trim();
      const upper = trimmed.toUpperCase();
      const searchCodes = upper.startsWith('REF-') ? [upper] : [upper, `REF-${upper}`];

      const codeSnap = await db.collection('Customers').where('referralCode', 'in', searchCodes).limit(1).get();
      if (!codeSnap.empty) {
        const refData = codeSnap.docs[0].data();
        realReferredByMobile = refData.customerMobile;
        referrerDocId = codeSnap.docs[0].id;
      } else {
        const phone = trimmed.replace(/\D/g, '').slice(-10);
        if (phone.length === 10) {
          const mobileSnap = await db.collection('Customers').where('customerMobile', '==', phone).limit(1).get();
          if (!mobileSnap.empty) {
            const refData = mobileSnap.docs[0].data();
            realReferredByMobile = refData.customerMobile;
            referrerDocId = mobileSnap.docs[0].id;
          }
        }
      }
    }

    // Generate unique referral code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let uniqueCode = '';
    for (let i = 0; i < 6; i++) {
      uniqueCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Encrypt password securely on server
    const passwordHash = await hashSecret(cleanPassword);

    const newCustomer: any = {
      role: 'customer',
      customerName: name,
      customerMobile: cleanMobile,
      customerPassword: passwordHash,
      gender: data.gender || '',
      dateOfBirth: data.dateOfBirth || '',
      isStudent: !!data.isStudent,
      storeLocation: data.storeLocation || 'Sustainable KGV Online',
      demoStore: !!data.demoStore,
      referredBy: realReferredByMobile,
      referralCode: uniqueCode,
      referredUsers: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      joinedDate: admin.firestore.FieldValue.serverTimestamp(),
      tpin: data.tpin ? await hashSecret(String(data.tpin)) : '',
      walletRechargeDone: false,
      saleElgibility: true,
      walletId: `WAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      walletBalance: 0,
      walletBalanceCurrentMonth: 0,
      surabhiBalance: 0,
      surabhiCredit: 0,
      surabhiDebit: 0,
      surabhiReferral: 0,
      surabhiBalanceCurrentMonth: 0,
      sevaBalance: 0,
      sevaCredit: 0,
      sevaDebit: 0,
      sevaTotal: 0,
      sevaBalanceCurrentMonth: 0,
      coinsFrozen: false,
      lastTransactionDate: null,
      lastQuarterCheck: null,
      currentQuarterStart: admin.firestore.FieldValue.serverTimestamp(),
      cumTotal: 0,
      surbhiTotal: 0,
      quartersPast: 0,
      cummulativeTarget: 0,
      targetMet: false,
      shippingBalance: 0,
      shippingCredit: 0,
      shippingDebit: 0,
      shippingTotal: 0,
      shippingBalanceCurrentMonth: 0,
    };

    const docRef = await db.collection('Customers').add(newCustomer);

    if (referrerDocId) {
      try {
        await db.collection('Customers').doc(referrerDocId).update({
          referredUsers: admin.firestore.FieldValue.arrayUnion({
            customerMobile: cleanMobile,
            customerName: name,
            createdAt: admin.firestore.Timestamp.now(),
          }),
        });
      } catch (e) {
        logger.error('Failed to update referrer doc:', e);
      }
    }

    const authUid = docRef.id;
    let targetUid = authUid;
    const email = data.customerEmail || `${cleanMobile}@surabhiloyalty.local`;
    try {
      await admin.auth().createUser({
        uid: authUid,
        email: email,
        displayName: name,
      });
    } catch (err: any) {
      logger.warn('Auth user create during signup notice:', err);
      if (err.code === 'auth/email-already-exists') {
        try {
          await admin.auth().createUser({
            uid: authUid,
            email: `${cleanMobile}.${authUid.slice(0, 6)}@surabhiloyalty.local`,
            displayName: name,
          });
        } catch (vErr) {
          try {
            const existing = await admin.auth().getUserByEmail(email);
            targetUid = existing.uid;
          } catch (e) {
            logger.error('Failed to resolve auth user by email on signup:', e);
          }
        }
      }
    }

    const claims = { role: 'customer', docId: authUid, customerMobile: cleanMobile };
    await admin.auth().setCustomUserClaims(targetUid, claims);
    const customToken = await admin.auth().createCustomToken(targetUid, claims);

    const safeUser = { ...newCustomer, id: authUid };
    delete safeUser.customerPassword;

    logger.info(`Registered new customer ${cleanMobile} (${docRef.id})`);
    return {
      success: true,
      customToken,
      user: safeUser,
    };
  }
);

/**
 * Validates a referral code or phone without exposing the database to unauthenticated clients.
 */
export const validateReferralCode = functions.https.onCall(
  { region: 'us-central1', cors: true },
  async (request: functions.https.CallableRequest<any>) => {
    const codeOrPhone = String(request.data?.codeOrPhone || '').trim();
    if (!codeOrPhone) return { valid: false };

    const db = admin.firestore();
    const upper = codeOrPhone.toUpperCase();
    const searchCodes = upper.startsWith('REF-') ? [upper] : [upper, `REF-${upper}`];

    let snap = await db.collection('Customers').where('referralCode', 'in', searchCodes).limit(1).get();
    if (snap.empty && /^\d{10}$/.test(codeOrPhone.replace(/\D/g, ''))) {
      const cleanPhone = codeOrPhone.replace(/\D/g, '').slice(-10);
      snap = await db.collection('Customers').where('customerMobile', '==', cleanPhone).limit(1).get();
    }

    if (snap.empty) {
      return { valid: false };
    }

    const refData = snap.docs[0].data();
    return {
      valid: true,
      customerName: refData.customerName || 'Referrer',
      eligible: refData.walletRechargeDone === true || refData.saleElgibility === true,
    };
  }
);

/** Verifies a customer's TPIN without exposing the stored credential to the browser. */
export const verifyCustomerTpin = functions.https.onCall(
  { region: 'us-central1' },
  async (request) => {
    const role = request.auth?.token?.role;
    if (role !== 'admin' && role !== 'staff') {
      throw new functions.https.HttpsError('permission-denied', 'Staff authorization is required.');
    }
    const customerId = String(request.data?.customerId || '').trim();
    const tpin = String(request.data?.tpin || '').trim();
    if (!customerId || !/^\d{4,8}$/.test(tpin)) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid customer ID and TPIN are required.');
    }
    const ref = admin.firestore().collection('Customers').doc(customerId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found.');
    }
    const data = snapshot.data() || {};
    const match = await passwordMatches(data.tpin, tpin);
    if (!match.valid) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid TPIN.');
    }
    if (match.legacy) {
      await ref.update({ tpin: await hashSecret(tpin) });
    }
    return { valid: true };
  }
);

/**
 * Secure Server-Side User/Customer Profile Update
 * Requires valid JWT Authentication (request.auth).
 * Strictly validates caller identity and enforces whitelisted profile fields.
 * Prevents client-side manipulation of balances, roles, or sensitive administrative metadata.
 */
export const updateUserProfile = functions.https.onCall(
  { region: 'us-central1', cors: true },
  async (request: functions.https.CallableRequest<any>) => {
    // 1. JWT Authentication Verification
    if (!request.auth || !request.auth.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required. Please sign in to update your profile.'
      );
    }

    const callerUid = request.auth.uid;
    const tokenClaims = request.auth.token || {};
    const callerRole = tokenClaims.role || 'customer';
    const callerDocId = tokenClaims.docId || callerUid;

    const data = request.data || {};
    const targetUserId = String(data.userId || callerDocId).trim();

    // 2. Authorization Check: Regular users can ONLY update their own document
    const isSelf = targetUserId === callerDocId || targetUserId === callerUid;
    const isAdminUser = callerRole === 'admin';

    if (!isSelf && !isAdminUser) {
      logger.warn(`Unauthorized profile update attempt by UID ${callerUid} on target ${targetUserId}`);
      throw new functions.https.HttpsError(
        'permission-denied',
        'You are not authorized to update another user profile.'
      );
    }

    const rawUpdates = data.updates || {};
    if (typeof rawUpdates !== 'object' || rawUpdates === null || Array.isArray(rawUpdates)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid update payload.'
      );
    }

    // 3. Strict Whitelist of Editable Fields (reject / ignore any sensitive balance or role fields)
    const allowedFields = [
      'customerName',
      'name',
      'displayName',
      'customerPassword',
      'password',
      'tpin',
      'gender',
      'dateOfBirth',
      'addresses',
      'deliveryAddress',
      'city',
      'state',
      'pincode',
      'address'
    ];

    const sanitizedUpdates: Record<string, any> = {};
    let newPlainPassword = '';
    let newPlainTpin = '';

    for (const key of Object.keys(rawUpdates)) {
      if (!allowedFields.includes(key)) {
        logger.warn(`Ignoring disallowed field '${key}' in profile update from ${callerUid}`);
        continue;
      }

      const val = rawUpdates[key];

      if (key === 'customerName' || key === 'name' || key === 'displayName') {
        const nameVal = String(val || '').trim();
        if (nameVal.length > 0 && nameVal.length <= 100) {
          sanitizedUpdates.customerName = nameVal;
        }
      } else if (key === 'customerPassword' || key === 'password') {
        const passVal = String(val || '').trim();
        if (passVal) {
          if (passVal.length < 6) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              'Password must be at least 6 characters long.'
            );
          }
          newPlainPassword = passVal;
        }
      } else if (key === 'tpin') {
        const tpinVal = String(val || '').trim();
        if (tpinVal) {
          if (!/^\d{4}$/.test(tpinVal)) {
            throw new functions.https.HttpsError(
              'invalid-argument',
              'TPIN must be a 4-digit numeric code.'
            );
          }
          newPlainTpin = tpinVal;
        }
      } else if (key === 'gender') {
        const g = String(val || '').toLowerCase().trim();
        if (['male', 'female', 'other', ''].includes(g)) {
          sanitizedUpdates.gender = g;
        }
      } else if (key === 'dateOfBirth') {
        sanitizedUpdates.dateOfBirth = String(val || '').slice(0, 30);
      } else if (key === 'addresses' && Array.isArray(val)) {
        sanitizedUpdates.addresses = val.slice(0, 10);
      } else if (key === 'deliveryAddress' && typeof val === 'object' && val !== null) {
        sanitizedUpdates.deliveryAddress = val;
      } else if (['city', 'state', 'pincode', 'address'].includes(key)) {
        sanitizedUpdates[key] = String(val || '').trim().slice(0, 200);
      }
    }

    // 4. Hash sensitive credentials securely on server side
    if (newPlainPassword) {
      sanitizedUpdates.customerPassword = await hashSecret(newPlainPassword);
    }
    if (newPlainTpin) {
      sanitizedUpdates.tpin = await hashSecret(newPlainTpin);
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'No valid profile fields provided for update.'
      );
    }

    sanitizedUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    const db = admin.firestore();
    
    // Check Customers collection first, then users collection
    let targetDocRef = db.collection('Customers').doc(targetUserId);
    let targetDocSnap = await targetDocRef.get();

    if (!targetDocSnap.exists) {
      const userDocRef = db.collection('users').doc(targetUserId);
      const userDocSnap = await userDocRef.get();
      if (userDocSnap.exists) {
        targetDocRef = userDocRef;
        targetDocSnap = userDocSnap;
      } else {
        throw new functions.https.HttpsError('not-found', 'User record not found.');
      }
    }

    // Execute update via Admin SDK (bypasses Firestore client-side security rules)
    await targetDocRef.update(sanitizedUpdates);

    // Sync Firebase Auth user if password or name was updated
    if (newPlainPassword || sanitizedUpdates.customerName) {
      try {
        const authUpdate: admin.auth.UpdateRequest = {};
        if (newPlainPassword) authUpdate.password = newPlainPassword;
        if (sanitizedUpdates.customerName) authUpdate.displayName = sanitizedUpdates.customerName;

        await admin.auth().updateUser(callerUid, authUpdate);
      } catch (authSyncErr) {
        logger.warn(`Firebase Auth sync during profile update for ${callerUid}:`, authSyncErr);
      }
    }

    logger.info(`Profile updated securely via Cloud Function for user ${targetUserId} by ${callerUid}`);

    return {
      success: true,
      message: 'Profile updated successfully.',
      updatedFields: Object.keys(sanitizedUpdates).filter(k => k !== 'customerPassword' && k !== 'tpin'),
    };
  }
);

/** Alias for updateUserProfile for convenience */
export const updateCustomerProfile = updateUserProfile;
