import * as crypto from 'crypto';

import * as CryptoJS from 'crypto-js';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * OJIVA.AI SMS Gateway integration.
 *
 * Docs: https://nexus.ojiva.ai (X-API-Key header auth, send-campaign endpoint).
 *
 * Credentials & sender are read from Cloud Function env. They MUST stay server-side:
 *   - OJIVA_API_KEY      (X-API-Key header value)
 *   - OJIVA_SENDER_ID    (5–6 char DLT-registered Sender ID, e.g. SUSKGV)
 *
 * Each SMS "kind" below has its own DLT-registered template. The 19-digit
 * `templateId` and the `messageTemplate` text MUST exactly match what was
 * approved with TRAI/the operator.
 *
 * Two pieces are sent per request (matches the working production payload):
 *   - top-level `message`  : the approved DLT body with {#var#} placeholders.
 *   - `messages[].message` : the per-recipient message with placeholders filled.
 *
 * `messageTemplate` uses {#var#} (DLT format). `renderedTemplate` uses our
 * named placeholders ({otp}, {amount}, …) so we know what to substitute.
 */
const OJIVA_BASE_URL = 'https://nexus.ojiva.ai';

type TemplateConfig = {
  /** 19-digit DLT-registered template ID. */
  templateId: string;
  /** Approved DLT body with `{#var#}` placeholders — sent as top-level `message`. */
  messageTemplate: string;
  /** Same body but with our named `{name}/{otp}/...` placeholders for substitution. */
  renderedTemplate: string;
  /** Default priority (0=OTP, 1=Transactional, 2=Promotional). */
  priority: 0 | 1 | 2 | 3;
};

export const OJIVA_TEMPLATES = {
  /* ----------------------------- OTP templates ---------------------------- */

  /** Phone-number verification during customer signup. Vars: {otp}. */
  otp_signup: {
    templateId: '1707177545876425337',
    messageTemplate:
      'Dear User, your OTP for phonenumber verification at NPL-Nenupakkalocal is {#var#}. Do not share this OTP. - Yogaaamrutha RCM',
    renderedTemplate:
      'Dear User, your OTP for phonenumber verification at NPL-Nenupakkalocal is {otp}. Do not share this OTP. - Yogaaamrutha RCM',
    priority: 0,
  },

  /** Forgot-password OTP. Vars: {otp}. */
  otp_reset: {
    templateId: '1707177546212500792',
    messageTemplate:
      'Your OTP to reset your password is {#var#}. Do not share this OTP. - Yogaaamrutha RCM',
    renderedTemplate:
      'Your OTP to reset your password is {otp}. Do not share this OTP. - Yogaaamrutha RCM',
    priority: 0,
  },

  /** Coin-redemption authorization OTP at point of sale. Vars: {otp},{coins},{amount}. */
  otp_coin_redemption: {
    templateId: '1707177571183616841',
    messageTemplate:
      'OTP {#var#} for redeeming {#var#} Surabhi Coins on rs{#var#} at sustainable kgv. Share this OTP only with the store - Yogaaamrutha RCM',
    renderedTemplate:
      'OTP {otp} for redeeming {coins} Surabhi Coins on rs{amount} at sustainable kgv. Share this OTP only with the store - Yogaaamrutha RCM',
    priority: 0,
  },

  /** Sales return authorization OTP. Vars: {otp},{amount},{coins}. */
  otp_sales_return: {
    templateId: '1707177598313802842',
    messageTemplate:
      'Your OTP is {#var#} for sales return of rs{#var#}. {#var#} Surabhi Coins will be debited from wallet. Share this OTP with the store - Yogaaamrutha RCM',
    renderedTemplate:
      'Your OTP is {otp} for sales return of rs{amount}. {coins} Surabhi Coins will be debited from wallet. Share this OTP with the store - Yogaaamrutha RCM',
    priority: 0,
  },

  /* ----------------------- Transactional notifications --------------------- */

  /**
   * Customer purchase confirmation with coins earned + new balance.
   * Vars: {surabhi}, {amount}, {balance}.
   */
  coins_credited: {
    templateId: '1707177553821348005',
    messageTemplate:
      'Namaskar!You received {#var#} Surabhi Coins for the purchase of Rs {#var#} at Sustainable KGV.Your current Surabhi Coins balance is {#var#}- Yogaaamrutha RCM.',
    renderedTemplate:
      'Namaskar!You received {surabhi} Surabhi Coins for the purchase of Rs {amount} at Sustainable KGV.Your current Surabhi Coins balance is {balance}- Yogaaamrutha RCM.',
    priority: 1,
  },

  /**
   * Referrer notification when a referred customer makes a purchase.
   * Vars: {surabhi}, {balance}.
   */
  referrer_credited: {
    templateId: '1707177554555843288',
    messageTemplate:
      'Namaskar! Your referral purchase at SLL-SustainableKGV earned you {#var#} Surabhi Coins. Balance:{#var#} Coins. Yogaaamrutha RCM',
    renderedTemplate:
      'Namaskar! Your referral purchase at SLL-SustainableKGV earned you {surabhi} Surabhi Coins. Balance:{balance} Coins. Yogaaamrutha RCM',
    priority: 1,
  },

  /* ----------------- Future kinds (no DLT template yet) -------------------- */
  /* Calls to these kinds skip silently with reason `template_not_configured`
   * until the corresponding 19-digit DLT template ID is registered. Existing
   * frontend wiring uses these helpers; no-op until activated.
   */
  order_placed: {
    templateId: '',
    messageTemplate:
      'Dear {#var#}, your order #{#var#} of Rs.{#var#} has been placed at {#var#}. We will notify you when it ships. - Yogaaamrutha RCM',
    renderedTemplate:
      'Dear {name}, your order #{invoice} of Rs.{amount} has been placed at {store}. We will notify you when it ships. - Yogaaamrutha RCM',
    priority: 1,
  },
  order_status: {
    templateId: '',
    messageTemplate:
      'Dear {#var#}, your order #{#var#} status is now {#var#}. Thank you for shopping with {#var#}. - Yogaaamrutha RCM',
    renderedTemplate:
      'Dear {name}, your order #{invoice} status is now {status}. Thank you for shopping with {store}. - Yogaaamrutha RCM',
    priority: 1,
  },
  coins_redeemed: {
    templateId: '',
    messageTemplate:
      'Dear {#var#}, you redeemed {#var#} Surabhi and Rs.{#var#} Shipping credits on your purchase of Rs.{#var#}. Surabhi balance: {#var#}. - Yogaaamrutha RCM',
    renderedTemplate:
      'Dear {name}, you redeemed {surabhi} Surabhi and Rs.{shipping} Shipping credits on your purchase of Rs.{amount}. Surabhi balance: {balance}. - Yogaaamrutha RCM',
    priority: 1,
  },
  wallet_recharge: {
    templateId: '',
    messageTemplate:
      'Dear {#var#}, wallet recharge of Rs.{#var#} successful. Earned {#var#} Surabhi and Rs.{#var#} Seva. New wallet balance Rs.{#var#}. - Yogaaamrutha RCM',
    renderedTemplate:
      'Dear {name}, wallet recharge of Rs.{amount} successful. Earned {surabhi} Surabhi and Rs.{seva} Seva. New wallet balance Rs.{balance}. - Yogaaamrutha RCM',
    priority: 1,
  },
} as const satisfies Record<string, TemplateConfig>;

export type OjivaKind = keyof typeof OJIVA_TEMPLATES;

/* -------------------------------------------------------------------------- */
/*                              Internal helpers                              */
/* -------------------------------------------------------------------------- */

/** Indian DLT requires the 12-digit `91xxxxxxxxxx` form (no plus, no dashes). */
function toIndianMobile(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return `91${digits.slice(3)}`;
  return '';
}

function rawTenDigit(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  return '';
}

function applyTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Low-level OJIVA send. Skips silently if env not configured. */
async function postOjivaSms(args: {
  kind: OjivaKind;
  cfg: TemplateConfig;
  cleaned91: string;
  variables: Record<string, string | number>;
  transactionId?: string;
  dcs?: 0 | 2;
  priorityOverride?: 0 | 1 | 2 | 3;
}): Promise<{ skipped: boolean; reason?: string; jobId?: number }> {
  const { kind, cfg, cleaned91, variables, transactionId, dcs = 0, priorityOverride } = args;

  const apiKey = process.env.OJIVA_API_KEY || '';
  const senderId = process.env.OJIVA_SENDER_ID || '';
  if (!apiKey || !senderId) {
    logger.warn('[ojivaSms] OJIVA_API_KEY/OJIVA_SENDER_ID not set; skipping', { kind });
    return { skipped: true, reason: 'ojiva_credentials_not_configured' };
  }
  if (!cfg.templateId) {
    logger.warn(`[ojivaSms] templateId not configured for kind=${kind}; skipping`);
    return { skipped: true, reason: 'template_not_configured' };
  }

  const renderedMessage = applyTemplate(cfg.renderedTemplate, variables).slice(0, 1000);
  const priority = priorityOverride ?? cfg.priority;

  const messagesEntry: Record<string, string> = {
    mobile: cleaned91,
    message: renderedMessage,
  };
  if (transactionId) messagesEntry.transaction_id = transactionId;

  const body = {
    sender_id: senderId,
    template_id: cfg.templateId,
    // top-level message must contain the approved DLT body with {#var#} placeholders.
    message: cfg.messageTemplate,
    dcs,
    priority,
    messages: [messagesEntry],
  };

  const res = await fetch(`${OJIVA_BASE_URL}/sms/api/send-campaign`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  logger.info('[ojivaSms] response', {
    kind,
    status: res.status,
    to: cleaned91,
    bodyPreview: text.slice(0, 200),
  });

  if (!res.ok) {
    const reason = json?.message || `HTTP ${res.status}`;
    throw new functions.https.HttpsError('internal', `OJIVA SMS failed: ${reason}`);
  }
  return {
    skipped: false,
    jobId: typeof json?.jobId === 'number' ? json.jobId : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                       Generic transactional callable                       */
/* -------------------------------------------------------------------------- */

export type OjivaSmsRequest = {
  kind: OjivaKind;
  phone: string;
  variables: Record<string, string | number>;
  priority?: 0 | 1 | 2 | 3;
  dcs?: 0 | 2;
  transactionId?: string;
};

type OjivaSmsResponse = {
  success: boolean;
  skipped: boolean;
  reason?: string;
  jobId?: number;
};

/**
 * Sends one OJIVA SMS based on `kind`. Used for transactional notifications
 * (coin-credited, referrer-credited). Requires Firebase auth.
 *
 * For OTP sends, prefer `sendPhoneOtp` which also persists the hashed OTP for
 * later verification and applies rate limiting.
 */
export const sendOjivaNotification = functions.https.onCall(
  { region: 'us-central1' },
  async (request): Promise<OjivaSmsResponse> => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to send SMS.'
      );
    }

    const data = request.data as OjivaSmsRequest;
    const kind = data?.kind;
    if (!kind || !(kind in OJIVA_TEMPLATES)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Invalid SMS kind. Allowed: ${Object.keys(OJIVA_TEMPLATES).join(', ')}`
      );
    }

    const cleaned91 = toIndianMobile(data?.phone);
    if (!cleaned91) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid Indian mobile number (need 10 digits or 91xxxxxxxxxx).'
      );
    }

    const cfg = OJIVA_TEMPLATES[kind];
    const result = await postOjivaSms({
      kind,
      cfg,
      cleaned91,
      variables: data?.variables || {},
      transactionId: data?.transactionId,
      dcs: (data?.dcs ?? 0) as 0 | 2,
      priorityOverride: data?.priority as 0 | 1 | 2 | 3 | undefined,
    });

    return { success: true, ...result };
  }
);

/* -------------------------------------------------------------------------- */
/*                         OTP send / verify callables                        */
/* -------------------------------------------------------------------------- */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000;
const OTP_RATE_LIMIT = 3;
const PHONE_OTPS_COLLECTION = 'phone_otps';

type OtpContext = 'signup' | 'reset' | 'coin_redemption' | 'sales_return' | 'generic';

type SendOtpRequest = {
  phone: string;
  context: OtpContext;
  /** Required when context = 'coin_redemption' or 'sales_return'. */
  amount?: number;
  /** Required when context = 'coin_redemption' or 'sales_return'. */
  coins?: number;
};

type SendOtpResponse = {
  success: boolean;
  message?: string;
};

function generateOtp(): string {
  // 6-digit numeric, leading zeros preserved.
  const buf = crypto.randomBytes(4).readUInt32BE(0);
  return String(100000 + (buf % 900000));
}

async function isCustomerRegistered(tenDigit: string): Promise<boolean> {
  const snap = await admin
    .firestore()
    .collection('Customers')
    .where('customerMobile', '==', tenDigit)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Generates a 6-digit OTP, stores its SHA-256 hash in `phone_otps`, and sends
 * it via OJIVA. Implements a 3-per-10-minute rate limit per phone.
 *
 * No Firebase auth required (signup/reset happen before sign-in).
 *
 * Context-specific behaviour:
 *   - 'signup'         : rejects if a customer already exists for the phone.
 *   - 'reset'          : rejects if no customer exists for the phone.
 *   - 'coin_redemption': uses redemption template (needs amount, coins).
 *   - 'sales_return'   : uses return template (needs amount, coins).
 *   - 'generic'        : phone-verification template (signup-style body).
 */
export const sendPhoneOtp = functions.https.onCall(
  { region: 'us-central1' },
  async (request): Promise<SendOtpResponse> => {
    const data = request.data as SendOtpRequest;
    const tenDigit = rawTenDigit(data?.phone);
    if (!tenDigit) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid 10-digit Indian mobile number.'
      );
    }

    const context: OtpContext = (data?.context as OtpContext) || 'generic';

    // Resolve template and required vars.
    let kind: OjivaKind;
    let templateVars: Record<string, string | number> = {};
    let txnPrefix = 'otp';

    if (context === 'coin_redemption') {
      if (data?.amount === undefined || data?.coins === undefined) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'amount and coins are required for coin_redemption OTP.'
        );
      }
      kind = 'otp_coin_redemption';
      templateVars = {
        coins: Math.round(Number(data.coins)),
        amount: Math.round(Number(data.amount)),
      };
      txnPrefix = 'redeem';
    } else if (context === 'sales_return') {
      if (data?.amount === undefined || data?.coins === undefined) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'amount and coins are required for sales_return OTP.'
        );
      }
      kind = 'otp_sales_return';
      templateVars = {
        amount: Math.round(Number(data.amount)),
        coins: Math.round(Number(data.coins)),
      };
      txnPrefix = 'return';
    } else if (context === 'reset') {
      kind = 'otp_reset';
      txnPrefix = 'reset';
    } else {
      kind = 'otp_signup';
      txnPrefix = context === 'signup' ? 'signup' : 'verify';
    }

    // Existence checks (signup must be new, reset must exist).
    if (context === 'signup' && (await isCustomerRegistered(tenDigit))) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This mobile number is already registered. Please login instead.'
      );
    }
    if (context === 'reset' && !(await isCustomerRegistered(tenDigit))) {
      throw new functions.https.HttpsError(
        'not-found',
        'No account found with this mobile number.'
      );
    }

    // Rate limit: max OTPs per phone in the rolling window.
    const db = admin.firestore();
    const sinceTs = admin.firestore.Timestamp.fromMillis(Date.now() - OTP_RATE_WINDOW_MS);
    const recent = await db
      .collection(PHONE_OTPS_COLLECTION)
      .where('phone', '==', tenDigit)
      .where('created_at', '>=', sinceTs)
      .get();
    if (recent.size >= OTP_RATE_LIMIT) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many OTP requests. Please wait 10 minutes and try again.'
      );
    }

    // Generate OTP, hash, persist.
    const otp = generateOtp();
    const otpHash = sha256Hex(otp);
    const now = Date.now();
    const docRef = db.collection(PHONE_OTPS_COLLECTION).doc();
    await docRef.set({
      phone: tenDigit,
      otp_hash: otpHash,
      context,
      created_at: admin.firestore.Timestamp.fromMillis(now),
      expires_at: admin.firestore.Timestamp.fromMillis(now + OTP_TTL_MS),
      used: false,
      attempts: 0,
    });

    // Send SMS. If gateway fails, delete the persisted OTP so the user can retry.
    try {
      await postOjivaSms({
        kind,
        cfg: OJIVA_TEMPLATES[kind],
        cleaned91: `91${tenDigit}`,
        variables: { otp, ...templateVars },
        transactionId: `${txnPrefix}-${now}`,
        dcs: 0,
      });
    } catch (err) {
      await docRef.delete().catch(() => undefined);
      throw err;
    }

    return { success: true, message: 'OTP sent successfully.' };
  }
);

type VerifyOtpRequest = {
  phone: string;
  otp: string;
  context?: OtpContext;
};

type VerifyOtpResponse = {
  success: boolean;
  /**
   * Short-lived token (5 minutes) returned on successful verification. Pass it
   * to the next callable (e.g. `registerCustomer`, `resetCustomerPassword`) so
   * it can confirm the OTP was verified and was for this exact phone+context.
   */
  verificationToken?: string;
};

/**
 * Verifies an OTP previously issued by `sendPhoneOtp`. Marks it `used` on
 * success and increments `attempts` on failure. Allows up to 5 attempts per
 * issued OTP before forcing a re-send.
 */
export const verifyPhoneOtp = functions.https.onCall(
  { region: 'us-central1' },
  async (request): Promise<VerifyOtpResponse> => {
    const data = request.data as VerifyOtpRequest;
    const tenDigit = rawTenDigit(data?.phone);
    if (!tenDigit) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid 10-digit Indian mobile number.'
      );
    }
    const otp = String(data?.otp || '').replace(/\D/g, '');
    if (otp.length !== 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'OTP must be a 6-digit code.'
      );
    }

    const db = admin.firestore();
    const nowMs = Date.now();

    // Pull the most recent unused OTP for this phone (optionally filtered by context).
    let q: FirebaseFirestore.Query = db
      .collection(PHONE_OTPS_COLLECTION)
      .where('phone', '==', tenDigit)
      .where('used', '==', false)
      .orderBy('created_at', 'desc')
      .limit(5);

    if (data?.context) {
      q = db
        .collection(PHONE_OTPS_COLLECTION)
        .where('phone', '==', tenDigit)
        .where('context', '==', data.context)
        .where('used', '==', false)
        .orderBy('created_at', 'desc')
        .limit(5);
    }

    const snap = await q.get();
    if (snap.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No active OTP. Please request a new one.'
      );
    }

    const otpHash = sha256Hex(otp);
    let matchedRef: FirebaseFirestore.DocumentReference | null = null;
    let matchedContext: string | undefined;
    for (const doc of snap.docs) {
      const d = doc.data();
      const expiresMs = (d.expires_at as admin.firestore.Timestamp)?.toMillis?.() ?? 0;
      if (expiresMs < nowMs) continue;
      const attempts = Number(d.attempts || 0);
      if (attempts >= 5) continue;
      if (d.otp_hash === otpHash) {
        matchedRef = doc.ref;
        matchedContext = d.context;
        break;
      }
      // Wrong code → bump attempts on this doc.
      await doc.ref.update({ attempts: attempts + 1 }).catch(() => undefined);
    }

    if (!matchedRef) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Incorrect or expired OTP.'
      );
    }

    // Mark used and issue a short-lived verification token.
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const verifiedTokenHash = sha256Hex(verificationToken);
    await matchedRef.update({
      used: true,
      used_at: admin.firestore.Timestamp.fromMillis(nowMs),
      verified_token_hash: verifiedTokenHash,
      verified_token_expires_at: admin.firestore.Timestamp.fromMillis(nowMs + 5 * 60 * 1000),
    });

    logger.info('[ojivaSms] OTP verified', {
      phone: tenDigit,
      context: matchedContext,
    });

    return { success: true, verificationToken };
  }
);

/* -------------------------------------------------------------------------- */
/*                  Reset password (consumes OTP verification)                */
/* -------------------------------------------------------------------------- */

const PASSWORD_ENCRYPTION_SECRET =
  process.env.VITE_ENCRYPTION_SECRET || 'default-test-secret-key-32-chars';

function encryptPassword(plain: string): string {
  return CryptoJS.AES.encrypt(plain, PASSWORD_ENCRYPTION_SECRET, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}

type ResetPasswordRequest = {
  phone: string;
  newPassword: string;
  verificationToken: string;
};

/**
 * Sets a new password for an existing customer after a successful
 * `verifyPhoneOtp(context='reset')` call. The verification token is one-time
 * (it is consumed from the `phone_otps` document) and expires after 5 minutes.
 *
 * The encrypted password is written to `Customers.<id>.customerPassword`;
 * the existing `onCustomerUpdate` Firestore trigger picks the change up and
 * syncs Firebase Auth, so the user can immediately login with the new password.
 */
export const resetCustomerPassword = functions.https.onCall(
  { region: 'us-central1' },
  async (request) => {
    const data = request.data as ResetPasswordRequest;
    const tenDigit = rawTenDigit(data?.phone);
    if (!tenDigit) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid 10-digit Indian mobile number.'
      );
    }
    const newPassword = String(data?.newPassword || '');
    if (newPassword.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'New password must be at least 6 characters long.'
      );
    }
    const token = String(data?.verificationToken || '');
    if (!token) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing verification token. Please verify the OTP first.'
      );
    }

    const tokenHash = sha256Hex(token);
    const db = admin.firestore();
    const nowMs = Date.now();

    // Find the verified OTP row matching the token + phone + reset context.
    const matched = await db
      .collection(PHONE_OTPS_COLLECTION)
      .where('phone', '==', tenDigit)
      .where('context', '==', 'reset')
      .where('verified_token_hash', '==', tokenHash)
      .limit(1)
      .get();

    if (matched.empty) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'OTP verification token is invalid. Please verify the OTP again.'
      );
    }
    const otpDoc = matched.docs[0];
    const otpData = otpDoc.data();
    const expiresMs = (otpData.verified_token_expires_at as admin.firestore.Timestamp)
      ?.toMillis?.();
    if (!expiresMs || expiresMs < nowMs) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'OTP verification token has expired. Please verify the OTP again.'
      );
    }
    if (otpData.consumed) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This OTP has already been used. Please request a new one.'
      );
    }

    // Find the customer doc.
    const custSnap = await db
      .collection('Customers')
      .where('customerMobile', '==', tenDigit)
      .limit(1)
      .get();
    if (custSnap.empty) {
      throw new functions.https.HttpsError(
        'not-found',
        'No account found with this mobile number.'
      );
    }
    const custRef = custSnap.docs[0].ref;

    const encrypted = encryptPassword(newPassword);
    await custRef.update({ customerPassword: encrypted });
    await otpDoc.ref.update({ consumed: true, consumed_at: admin.firestore.FieldValue.serverTimestamp() });

    logger.info('[ojivaSms] Customer password reset via OTP', { phone: tenDigit });
    return { success: true };
  }
);

/* -------------------------------------------------------------------------- */
/*                          Optional balance utility                          */
/* -------------------------------------------------------------------------- */

export const checkOjivaBalance = functions.https.onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
    }
    const apiKey = process.env.OJIVA_API_KEY || '';
    if (!apiKey) return { success: false, configured: false };
    try {
      const res = await fetch(`${OJIVA_BASE_URL}/api/balance`, {
        method: 'GET',
        headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      });
      const json = await res.json();
      return { success: res.ok, configured: true, data: json };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new functions.https.HttpsError('internal', `OJIVA balance check failed: ${msg}`);
    }
  }
);
