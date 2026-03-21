import * as CryptoJS from "crypto-js";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

const allowedOrigins = [
  "https://surabhiloyalty.web.app",
  "https://surabhiloyalty-uat.web.app",
  "https://surabhiloyalty.firebaseapp.com",
  "https://surabhiloyalty-uat.firebaseapp.com",
  "https://sustainablekgv.com",
  "https://www.sustainablekgv.com",
  /http:\/\/localhost:\d+/,
];

const isEncrypted = (text: string): boolean =>
  text.length > 20 && /^[A-Za-z0-9+/=]+$/.test(text);

const getSecretKey = () =>
  process.env.ENCRYPTION_SECRET ||
  process.env.VITE_ENCRYPTION_SECRET ||
  "default-test-secret-key-32-chars";

const decryptText = (encryptedText: string): string => {
  const secret = getSecretKey();
  const decrypted = CryptoJS.AES.decrypt(encryptedText, secret, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const plainText = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plainText) {
    throw new Error("Decryption failed - possibly wrong secret key or malformed text");
  }
  return plainText;
};

const passwordMatches = (stored: string | undefined, plain: string): boolean => {
  if (!stored) return false;
  if (isEncrypted(stored)) {
    try {
      return decryptText(stored) === plain;
    } catch (err) {
      console.error("Password decryption match failed:", err);
      return false;
    }
  }
  return stored === plain;
};

const isValidEmail = (value: string): boolean => {
  const t = value.trim();
  return !!t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
};

const isServiceUsagePermissionError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("serviceusage.services.use") ||
    message.includes("roles/serviceusage.serviceUsageConsumer") ||
    message.includes("USER_PROJECT_DENIED") ||
    message.includes("identitytoolkit.googleapis.com")
  );
};

const getFirebaseAuthErrorCode = (err: unknown): string | undefined => {
  const any = err as { code?: string; errorInfo?: { code?: string } };
  return any?.code ?? any?.errorInfo?.code;
};

const isAuthInsufficientPermission = (err: unknown): boolean =>
  getFirebaseAuthErrorCode(err) === "auth/insufficient-permission";

type AppRole = "customer" | "staff" | "admin";

/**
 * Verifies mobile + password against Firestore (same rules as app login), then forces
 * Firebase Auth password/email to match via Admin SDK. Used when Auth drifted but
 * Firestore credentials are correct (e.g. upload callables need request.auth).
 * Intentionally unauthenticated — same trust surface as logging in with these fields.
 */
export const syncFirebaseAuthForUpload = functions.https.onCall(
  { cors: allowedOrigins },
  async (request) => {
    console.log("!!! CRITICAL_SYNC_CALL !!!");
    const { mobile, password, appRole } = request.data as {
      mobile?: string;
      password?: string;
      appRole?: AppRole;
    };

    console.log(`syncFirebaseAuthForUpload start for ${mobile} (${appRole})`);

    if (!mobile || !password || !appRole) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "mobile, password, and appRole are required"
      );
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Password must be at least 6 characters for Firebase Auth"
      );
    }

    if (appRole !== "customer" && appRole !== "staff" && appRole !== "admin") {
      throw new functions.https.HttpsError("invalid-argument", "Invalid appRole");
    }

    try {
      if (appRole === "customer") {
        const snap = await db
          .collection("Customers")
          .where("customerMobile", "==", mobile)
          .limit(1)
          .get();

        if (snap.empty) {
          console.warn(`Customer with mobile ${mobile} not found`);
          throw new functions.https.HttpsError(
            "permission-denied",
            "Invalid credentials"
          );
        }

        const doc = snap.docs[0];
        const data = doc.data();
        if (!passwordMatches(data.customerPassword, password)) {
          console.warn(`Password mismatch for customer ${mobile}`);
          throw new functions.https.HttpsError(
            "permission-denied",
            "Invalid credentials"
          );
        }

        const email = String(data.customerEmail || "").trim();
        if (!isValidEmail(email)) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Account needs a valid email for uploads"
          );
        }

        await upsertAuthUser({
          email,
          password,
          displayName: data.customerName || "Customer",
          docId: doc.id,
        });
        console.log(`Sync success for customer ${mobile}`);
        return { success: true };
      }

      const snap = await db
        .collection("staff")
        .where("staffMobile", "==", mobile)
        .limit(1)
        .get();

      if (snap.empty) {
        console.warn(`Staff with mobile ${mobile} not found`);
        throw new functions.https.HttpsError(
          "permission-denied",
          "Invalid credentials"
        );
      }

      const doc = snap.docs[0];
      const data = doc.data();

      if (data.role !== appRole) {
        console.warn(`Role mismatch for staff ${mobile}: expected ${appRole}, got ${data.role}`);
        throw new functions.https.HttpsError(
          "permission-denied",
          "Invalid credentials"
        );
      }

      if (!passwordMatches(data.staffPassword, password)) {
        console.warn(`Password mismatch for staff ${mobile}`);
        throw new functions.https.HttpsError(
          "permission-denied",
          "Invalid credentials"
        );
      }

      if (appRole === "staff" && data.staffStatus !== "active") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Staff account is disabled"
        );
      }

      if (appRole === "staff" && data.storeLocation) {
        const storeSnap = await db
          .collection("stores")
          .where("storeName", "==", data.storeLocation)
          .limit(1)
          .get();
        if (storeSnap.empty) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Store not found"
          );
        }
        if (storeSnap.docs[0].data().storeStatus !== "active") {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Store is currently disabled"
          );
        }
      }

      const email = String(data.staffEmail || "").trim();
      if (!isValidEmail(email)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Account needs a valid email for uploads"
        );
      }

      await upsertAuthUser({
        email,
        password,
        displayName: data.staffName || "Staff",
        docId: doc.id,
        disabled: data.staffStatus === "inactive",
      });

      console.log(`Sync success for ${appRole} ${mobile}`);
      return { success: true };
    } catch (e: unknown) {
      if (e instanceof functions.https.HttpsError) {
        throw e;
      }
      if (isServiceUsagePermissionError(e)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server IAM is missing Service Usage Consumer permission for Auth sync. Ask admin to grant roles/serviceusage.serviceUsageConsumer to the Cloud Function runtime service account."
        );
      }
      if (isAuthInsufficientPermission(e)) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Firebase Admin cannot manage Auth users (identitytoolkit.googleapis.com). In Google Cloud IAM for this project, grant role \"Firebase Authentication Admin\" (roles/firebaseauth.admin) to the Cloud Functions default runtime service account: PROJECT_NUMBER-compute@developer.gserviceaccount.com (Gen2). If GOOGLE_APPLICATION_CREDENTIALS is set in the function env, remove it so the runtime uses that service account."
        );
      }
      console.error("syncFirebaseAuthForUpload error details:", e);
      if (e instanceof Error) {
        console.error("Error name:", e.name, "Message:", e.message, "Stack:", e.stack);
      }
      throw new functions.https.HttpsError(
        "internal",
        "Could not sync authentication. Please contact support."
      );
    }
  }
);

async function upsertAuthUser(opts: {
  email: string;
  password: string;
  displayName: string;
  docId: string;
  disabled?: boolean;
}): Promise<void> {
  const { email, password, displayName, docId, disabled } = opts;

  try {
    // 1. Try finding by UID (docId)
    try {
      await admin.auth().getUser(docId);
      console.log(`Auth user found by UID ${docId}, updating.`);
      try {
        await admin.auth().updateUser(docId, {
          email,
          password,
          displayName,
          disabled: disabled ?? false,
        });
      } catch (updateErr: any) {
        // If another UID already owns this email, move that account out of the way,
        // then re-apply the update on the canonical UID (docId).
        if (updateErr?.code === "auth/email-already-exists") {
          console.warn(
            `Email ${email} belongs to another UID. Deleting conflicting user before retry.`
          );
          const conflictUser = await admin.auth().getUserByEmail(email);
          if (conflictUser.uid !== docId) {
            await admin.auth().deleteUser(conflictUser.uid);
          }
          await admin.auth().updateUser(docId, {
            email,
            password,
            displayName,
            disabled: disabled ?? false,
          });
        } else {
          throw updateErr;
        }
      }
      return;
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    // 2. Try finding by Email
    try {
      const existingEmailUser = await admin.auth().getUserByEmail(email);
      console.log(`Auth user found by email ${email} but different UID ${existingEmailUser.uid}. Re-syncing.`);
      // Delete old user to allow creating one with correct UID (docId)
      await admin.auth().deleteUser(existingEmailUser.uid);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    // 3. Create fresh user with correct UID
    try {
      await admin.auth().createUser({
        email,
        password,
        displayName,
        uid: docId,
        disabled: disabled ?? false,
      });
    } catch (createErr: any) {
      // Race-safe recovery if a user appeared between delete/create attempts.
      if (
        createErr?.code === "auth/uid-already-exists" ||
        createErr?.code === "auth/email-already-exists"
      ) {
        console.warn(
          `Create conflict for ${email}/${docId}. Re-attempting via update on canonical UID.`
        );
        try {
          const conflictByEmail = await admin.auth().getUserByEmail(email);
          if (conflictByEmail.uid !== docId) {
            await admin.auth().deleteUser(conflictByEmail.uid);
          }
        } catch (lookupErr: any) {
          if (lookupErr?.code !== "auth/user-not-found") {
            throw lookupErr;
          }
        }
        await admin.auth().updateUser(docId, {
          email,
          password,
          displayName,
          disabled: disabled ?? false,
        });
      } else {
        throw createErr;
      }
    }
    console.log(`Auth user created for ${email} with UID ${docId}`);
  } catch (err: unknown) {
    console.error(`upsertAuthUser error for ${email}/${docId}:`, err);
    throw err;
  }
}
