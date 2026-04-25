import { httpsCallable } from 'firebase/functions';

import { functions } from '@/lib/firebase';

/**
 * Phone-OTP client. Backed by Firebase callables `sendPhoneOtp` and
 * `verifyPhoneOtp` (see `functions/src/ojivaSms.ts`).
 *
 * No Firebase Auth is required — these run before the user is signed in
 * (signup / forgot-password). The OJIVA API key stays on the function runtime.
 */

export type OtpContext =
  | 'signup'
  | 'reset'
  | 'coin_redemption'
  | 'sales_return'
  | 'generic';

type SendOtpRequest = {
  phone: string;
  context: OtpContext;
  amount?: number;
  coins?: number;
};

type SendOtpResponse = {
  success: boolean;
  message?: string;
};

type VerifyOtpRequest = {
  phone: string;
  otp: string;
  context?: OtpContext;
};

type VerifyOtpResponse = {
  success: boolean;
  verificationToken?: string;
};

/** Throws an Error with the server-provided message on failure. */
export async function sendPhoneOtp(req: SendOtpRequest): Promise<SendOtpResponse> {
  try {
    const fn = httpsCallable<SendOtpRequest, SendOtpResponse>(functions, 'sendPhoneOtp');
    const { data } = await fn(req);
    return data;
  } catch (e: any) {
    const message =
      e?.message ||
      e?.details?.message ||
      'Failed to send OTP. Please check your network and try again.';
    throw new Error(message);
  }
}

/** Throws an Error with the server-provided message on failure. */
export async function verifyPhoneOtp(req: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  try {
    const fn = httpsCallable<VerifyOtpRequest, VerifyOtpResponse>(functions, 'verifyPhoneOtp');
    const { data } = await fn(req);
    return data;
  } catch (e: any) {
    const message =
      e?.message ||
      e?.details?.message ||
      'OTP verification failed. Please try again.';
    throw new Error(message);
  }
}

type ResetPasswordRequest = {
  phone: string;
  newPassword: string;
  verificationToken: string;
};

/**
 * Sets a new password for an existing customer. The `verificationToken` must
 * have been issued by a successful `verifyPhoneOtp({ context: 'reset' })`
 * call within the last 5 minutes. The token is one-time.
 */
export async function resetCustomerPassword(
  req: ResetPasswordRequest
): Promise<{ success: boolean }> {
  try {
    const fn = httpsCallable<ResetPasswordRequest, { success: boolean }>(
      functions,
      'resetCustomerPassword'
    );
    const { data } = await fn(req);
    return data;
  } catch (e: any) {
    const message =
      e?.message ||
      e?.details?.message ||
      'Password reset failed. Please try again.';
    throw new Error(message);
  }
}
