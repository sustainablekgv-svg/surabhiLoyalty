import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/lib/firebase';

export type SaleSmsPayload = {
  phone: string;
  customerName: string;
  amount: number;
  invoiceId: string;
  paymentMethod?: string;
  storeName?: string;
};

type SaleSmsResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
};

/**
 * Notifies customer via A2Z SMS (Firebase Callable → server-side gateway).
 * No-op if user is not signed in. Does not throw on skip; logs only.
 */
export async function notifyCustomerSaleSms(payload: SaleSmsPayload): Promise<void> {
  if (!auth.currentUser) {
    console.warn('[saleSms] Skipped: no Firebase signed-in user');
    return;
  }

  try {
    const send = httpsCallable<SaleSmsPayload, SaleSmsResponse>(
      functions,
      'sendSaleNotificationSms'
    );
    const { data } = await send(payload);
    if (data?.skipped) {
      console.info('[saleSms] Skipped by server:', data.reason);
    }
  } catch (e) {
    console.error('[saleSms] Failed:', e);
  }
}
