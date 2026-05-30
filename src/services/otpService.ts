import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

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

export async function sendPhoneOtp(
  req: SendOtpRequest
): Promise<SendOtpResponse> {
  try {
    console.log("Sending OTP to:", phone);
    console.log('========== SEND OTP ==========');
    console.log('Request:', req);

    const fn = httpsCallable<SendOtpRequest, SendOtpResponse>(
      functions,
      'sendPhoneOtp'
    );

    const { data } = await fn(req);

    console.log('OTP Response:', data);

    return data;
  } catch (e: any) {
    console.error('========== OTP ERROR ==========');
    console.error('Code:', e?.code);
    console.error('Message:', e?.message);
    console.error('Details:', e?.details);
    console.error('Full Error:', e);

    const message =
      e?.details?.message ||
      e?.message ||
      'Failed to send OTP. Please try again.';

    throw new Error(message);
  }
}

export async function verifyPhoneOtp(
  req: VerifyOtpRequest
): Promise<VerifyOtpResponse> {
  try {
    console.log('========== VERIFY OTP ==========');
    console.log('Request:', req);

    const fn = httpsCallable<VerifyOtpRequest, VerifyOtpResponse>(
      functions,
      'verifyPhoneOtp'
    );

    const { data } = await fn(req);

    console.log('Verify Response:', data);

    return data;
  } catch (e: any) {
    console.error('========== VERIFY ERROR ==========');
    console.error('Code:', e?.code);
    console.error('Message:', e?.message);
    console.error('Details:', e?.details);
    console.error('Full Error:', e);

    const message =
      e?.details?.message ||
      e?.message ||
      'OTP verification failed.';

    throw new Error(message);
  }
}

type ResetPasswordRequest = {
  phone: string;
  newPassword: string;
  verificationToken: string;
};

export async function resetCustomerPassword(
  req: ResetPasswordRequest
): Promise<{ success: boolean }> {
  try {
    console.log('========== RESET PASSWORD ==========');
    console.log('Request:', req);

    const fn = httpsCallable<
      ResetPasswordRequest,
      { success: boolean }
    >(functions, 'resetCustomerPassword');

    const { data } = await fn(req);

    console.log('Reset Response:', data);

    return data;
  } catch (e: any) {
    console.error('========== RESET ERROR ==========');
    console.error('Code:', e?.code);
    console.error('Message:', e?.message);
    console.error('Details:', e?.details);
    console.error('Full Error:', e);

    const message =
      e?.details?.message ||
      e?.message ||
      'Password reset failed.';

    throw new Error(message);
  }
}