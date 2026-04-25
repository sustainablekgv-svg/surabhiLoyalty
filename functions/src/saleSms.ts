import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * A2Z SMS — **post-purchase sale notification** (one registered DLT template).
 * When you add another SMS type (OTP, order shipped, etc.), add another constant
 * block below and a separate callable or branch that uses it — do not use env
 * for template IDs / PEID / sender / body pattern.
 *
 * The `messageTemplate` string must match what is approved for `templateId`.
 */
const A2Z_SALE_POST_PURCHASE = {
  apiUrl: 'http://sms.a2zsms.in/api.php',
  senderId: 'SUSKGV',
  peid: '1701177271545246259',
  /** DLT template ID registered for the sale-confirmation text below */
  templateId: '1707177546212500792',
  /**
   * Variable placeholders (our convention). Ensure DLT allows these slots or
   * adjust text to match your approved template exactly.
   */
  messageTemplate:
    'Dear {name}, thank you for your purchase of Rs.{amount} at {store}. Invoice {invoice}. Payment: {payment}. - Yogaaamrutha RCM',
} as const;

function cleanIndianMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  return '';
}

function applyTemplate(
  template: string,
  vars: { name: string; amount: string; invoice: string; store: string; payment: string }
): string {
  return template
    .replace(/\{name\}/gi, vars.name)
    .replace(/\{amount\}/gi, vars.amount)
    .replace(/\{invoice\}/gi, vars.invoice)
    .replace(/\{store\}/gi, vars.store)
    .replace(/\{payment\}/gi, vars.payment);
}

export type SendSaleSmsRequest = {
  phone: string;
  customerName: string;
  amount: number;
  invoiceId: string;
  paymentMethod?: string;
  storeName?: string;
};

/**
 * Sends sale confirmation SMS via A2Z using `A2Z_SALE_POST_PURCHASE` DLT config above.
 * Env: only `A2ZSMS_USERNAME` and `A2ZSMS_PASSWORD` (see functions/.env.example).
 */
export const sendSaleNotificationSms = functions.https.onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to send sale SMS.'
      );
    }

    const data = request.data as SendSaleSmsRequest;
    const { customerName, amount, invoiceId, paymentMethod, storeName } = data;
    const phone = typeof data.phone === 'string' ? data.phone : '';

    if (!customerName || typeof amount !== 'number' || !invoiceId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'customerName, amount, and invoiceId are required.'
      );
    }

    const cleaned = cleanIndianMobile(phone);
    if (!cleaned) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid Indian mobile number (need 10 digits).'
      );
    }

    const username = process.env.A2ZSMS_USERNAME || '';
    const password = process.env.A2ZSMS_PASSWORD || '';

    if (!username || !password) {
      logger.warn('sendSaleNotificationSms: A2ZSMS_USERNAME / A2ZSMS_PASSWORD not set; skipping send.');
      return {
        success: true,
        skipped: true,
        reason: 'a2z_credentials_not_configured',
      };
    }

    const cfg = A2Z_SALE_POST_PURCHASE;
    const message = applyTemplate(cfg.messageTemplate, {
      name: String(customerName).slice(0, 80),
      amount: amount.toFixed(2),
      invoice: String(invoiceId).slice(0, 40),
      store: String(storeName || 'Our Store').slice(0, 60),
      payment: String(paymentMethod || 'sale').slice(0, 24),
    });

    const smsUrl =
      `${cfg.apiUrl}?username=${encodeURIComponent(username)}` +
      `&password=${encodeURIComponent(password)}` +
      `&to=${cleaned}` +
      `&from=${encodeURIComponent(cfg.senderId)}` +
      `&message=${encodeURIComponent(message)}` +
      `&PEID=${encodeURIComponent(cfg.peid)}` +
      `&templateid=${encodeURIComponent(cfg.templateId)}`;

    try {
      const smsResponse = await fetch(smsUrl);
      const smsResult = await smsResponse.text();
      logger.info('A2Z sale SMS response', {
        status: smsResponse.status,
        bodyPreview: smsResult.slice(0, 200),
        to: cleaned,
      });

      if (!smsResponse.ok) {
        throw new Error(`SMS gateway HTTP ${smsResponse.status}: ${smsResult.slice(0, 120)}`);
      }

      return { success: true, skipped: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('sendSaleNotificationSms failed', err);
      throw new functions.https.HttpsError('internal', `SMS send failed: ${msg}`);
    }
  }
);
