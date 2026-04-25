import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/lib/firebase';

/**
 * Client wrapper around the `sendOjivaNotification` Cloud Function (OJIVA.AI SMS).
 *
 * IMPORTANT: the OJIVA API key is only stored on the Cloud Function runtime
 * (`functions/.env` → `OJIVA_API_KEY`). It must NEVER be added to a Vite env
 * file (`VITE_*`) — those are bundled into the browser and visible to anyone.
 *
 * All helpers below are fire-and-forget — failures are logged, never thrown to
 * the UI, so a flaky SMS gateway never breaks an order/sale.
 */

export type OjivaKind =
  | 'order_placed'
  | 'order_status'
  | 'coins_credited'
  | 'coins_redeemed'
  | 'wallet_recharge'
  | 'referrer_credited';

type OjivaPayload = {
  kind: OjivaKind;
  phone: string;
  variables: Record<string, string | number>;
  priority?: 0 | 1 | 2 | 3;
  dcs?: 0 | 2;
  transactionId?: string;
};

type OjivaResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  jobId?: number;
};

async function sendOjiva(payload: OjivaPayload): Promise<OjivaResponse | undefined> {
  if (!auth.currentUser) {
    console.warn('[ojivaSms] skipped: no Firebase signed-in user');
    return undefined;
  }
  try {
    const send = httpsCallable<OjivaPayload, OjivaResponse>(
      functions,
      'sendOjivaNotification'
    );
    const { data } = await send(payload);
    if (data?.skipped) {
      console.info('[ojivaSms] skipped by server:', data.reason);
    }
    return data;
  } catch (e) {
    console.error('[ojivaSms] send failed', e);
    return undefined;
  }
}

const fmtMoney = (n: number | undefined | null) => Number(n ?? 0).toFixed(2);
const fmtCoins = (n: number | undefined | null) => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};
const shortInvoice = (id: string | undefined) =>
  String(id || '')
    .replace(/[^A-Za-z0-9-]/g, '')
    .slice(0, 12)
    .toUpperCase();

/* -------------------------------------------------------------------------- */
/*                              Convenience APIs                              */
/* -------------------------------------------------------------------------- */

export function notifyOrderPlacedSms(p: {
  phone: string;
  customerName: string;
  orderId: string;
  amount: number;
  storeName?: string;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'order_placed',
    phone: p.phone,
    transactionId: `ORDER-${shortInvoice(p.orderId)}`,
    variables: {
      name: p.customerName,
      invoice: shortInvoice(p.orderId),
      amount: fmtMoney(p.amount),
      store: p.storeName || 'Surabhi Loyalty',
    },
  });
}

export function notifyOrderStatusSms(p: {
  phone: string;
  customerName: string;
  orderId: string;
  status: string;
  storeName?: string;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'order_status',
    phone: p.phone,
    transactionId: `STATUS-${shortInvoice(p.orderId)}`,
    variables: {
      name: p.customerName,
      invoice: shortInvoice(p.orderId),
      status: String(p.status || '').toUpperCase().replace(/_/g, ' '),
      store: p.storeName || 'Surabhi Loyalty',
    },
  });
}

/**
 * Customer purchase confirmation with Surabhi coins earned + new balance.
 * The DLT template (`coins_credited`) only carries `{surabhi}`, `{amount}`,
 * `{balance}` and uses integer values, so seva/shipping are ignored at SMS
 * level (they're already shown in-app and on the invoice).
 */
export function notifyCoinsCreditedSms(p: {
  phone: string;
  customerName: string;
  orderOrInvoiceId: string;
  amount: number;
  surabhiCoins: number;
  /** Updated Surabhi balance after credit. */
  balance: number;
  /** Optional, kept for backwards-compat with old call sites. */
  sevaCoins?: number;
  shippingCoins?: number;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'coins_credited',
    phone: p.phone,
    transactionId: `billing-${shortInvoice(p.orderOrInvoiceId)}-${Date.now()}`,
    variables: {
      surabhi: Math.round(Number(p.surabhiCoins || 0)),
      amount: Math.round(Number(p.amount || 0)),
      balance: Math.round(Number(p.balance || 0)),
    },
  });
}

export function notifyCoinsRedeemedSms(p: {
  phone: string;
  customerName: string;
  orderOrInvoiceId: string;
  amount: number;
  surabhiCoinsUsed: number;
  shippingCreditsUsed: number;
  /** Updated Surabhi balance after redemption. */
  balance: number;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'coins_redeemed',
    phone: p.phone,
    transactionId: `REDEEM-${shortInvoice(p.orderOrInvoiceId)}`,
    variables: {
      name: p.customerName,
      amount: fmtMoney(p.amount),
      surabhi: fmtCoins(p.surabhiCoinsUsed),
      shipping: fmtMoney(p.shippingCreditsUsed),
      balance: fmtCoins(p.balance),
    },
  });
}

export function notifyWalletRechargeSms(p: {
  phone: string;
  customerName: string;
  amount: number;
  surabhiCoinsEarned: number;
  sevaAmountEarned: number;
  newWalletBalance: number;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'wallet_recharge',
    phone: p.phone,
    variables: {
      name: p.customerName,
      amount: fmtMoney(p.amount),
      surabhi: fmtCoins(p.surabhiCoinsEarned),
      seva: fmtMoney(p.sevaAmountEarned),
      balance: fmtMoney(p.newWalletBalance),
    },
  });
}

/**
 * Notify the *referrer* when their referee makes a purchase. The DLT template
 * uses integer values for coins / balance to match the approved body.
 */
export function notifyReferrerCreditedSms(p: {
  referrerPhone: string;
  surabhiCoinsEarned: number;
  newSurabhiBalance: number;
  /** For correlation in OJIVA logs only — not part of the body. */
  refereePhone?: string;
}): Promise<OjivaResponse | undefined> {
  return sendOjiva({
    kind: 'referrer_credited',
    phone: p.referrerPhone,
    transactionId: p.refereePhone ? `referrer-${p.refereePhone}-${Date.now()}` : undefined,
    variables: {
      surabhi: Math.round(Number(p.surabhiCoinsEarned || 0)),
      balance: Math.round(Number(p.newSurabhiBalance || 0)),
    },
  });
}
