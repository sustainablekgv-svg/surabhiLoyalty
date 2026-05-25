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

export type CartReminderSmsPayload = {
  phone: string;
  customerName: string;
  itemCount: number;
  url: string;
};

type CartReminderSmsResponse = {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
};

export async function notifyCustomerCartReminderSms(
  payload: CartReminderSmsPayload
): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
  if (!auth.currentUser) {
    console.warn('[saleSms] Skipped: no Firebase signed-in user');
    return { success: false, skipped: true, reason: 'unauthenticated' };
  }

  try {
    const send = httpsCallable<CartReminderSmsPayload, CartReminderSmsResponse>(
      functions,
      'sendCartReminderSms'
    );
    const { data } = await send(payload);
    return {
      success: !!data?.success,
      skipped: data?.skipped,
      reason: data?.reason,
    };
  } catch (e) {
    console.error('[saleSms] Cart reminder failed:', e);
    return { success: false, reason: String(e) };
  }
}
