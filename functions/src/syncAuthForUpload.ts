import * as CryptoJS from "crypto-js";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const SECRET_KEY = process.env.VITE_ENCRYPTION_SECRET || "default-test-secret-key-32-chars";

const allowedOrigins = [
  "https://surabhiloyalty.web.app",
  "https://surabhiloyalty-uat.web.app",
  "https://surabhiloyalty.firebaseapp.com",
  "https://surabhiloyalty-uat.firebaseapp.com",
  /http:\/\/localhost:\d+/,
];

const isEncrypted = (text: string): boolean =>
  text.length > 20 && /^[A-Za-z0-9+/=]+$/.test(text);

const decryptText = (encryptedText: string): string => {
  const decrypted = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const plainText = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plainText) {
    throw new Error("Decryption failed");
  }
  return plainText;
};

const passwordMatches = (stored: string | undefined, plain: string): boolean => {
  if (!stored) return false;
  if (isEncrypted(stored)) {
    try {
      return decryptText(stored) === plain;
    } catch {
      return false;
    }
  }
  return stored === plain;
};

const isValidEmail = (value: string): boolean => {
  const t = value.trim();
  return !!t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
};

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
    const { mobile, password, appRole } = request.data as {
      mobile?: string;
      password?: string;
      appRole?: AppRole;
    };

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
          throw new functions.https.HttpsError(
            "permission-denied",
            "Invalid credentials"
          );
        }

        const doc = snap.docs[0];
        const data = doc.data();
        if (!passwordMatches(data.customerPassword, password)) {
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
        return { success: true };
      }

      const snap = await db
        .collection("staff")
        .where("staffMobile", "==", mobile)
        .limit(1)
        .get();

      if (snap.empty) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Invalid credentials"
        );
      }

      const doc = snap.docs[0];
      const data = doc.data();

      if (data.role !== appRole) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Invalid credentials"
        );
      }

      if (!passwordMatches(data.staffPassword, password)) {
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

      return { success: true };
    } catch (e: unknown) {
      if (e instanceof functions.https.HttpsError) {
        throw e;
      }
      console.error("syncFirebaseAuthForUpload error:", e);
      throw new functions.https.HttpsError(
        "internal",
        "Could not sync authentication. Try again later."
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
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(userRecord.uid, {
      password,
      email,
      displayName,
      disabled: disabled ?? false,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      await admin.auth().createUser({
        email,
        password,
        displayName,
        uid: docId,
        disabled: disabled ?? false,
      });
    } else {
      throw err;
    }
  }
}
