import { Loader2, Phone, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpContext, sendPhoneOtp, verifyPhoneOtp } from '@/services/otpService';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  context: OtpContext;
  /** Re-rendered into the `coin_redemption` / `sales_return` template body. */
  amount?: number;
  coins?: number;
  /** Title shown above the OTP input. Falls back to a context-aware default. */
  title?: string;
  /** Called once the OTP is verified successfully. */
  onVerified: (verificationToken: string | undefined) => void | Promise<void>;
};

const RESEND_SECONDS = 30;

export function OtpVerifyDialog({
  open,
  onOpenChange,
  phone,
  context,
  amount,
  coins,
  title,
  onVerified,
}: Props) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [issued, setIssued] = useState(false);

  useEffect(() => {
    if (!open) {
      setOtp('');
      setIssued(false);
      setSecondsLeft(0);
    }
  }, [open]);

  // Auto-issue the first OTP when dialog opens.
  useEffect(() => {
    if (open && !issued && phone) {
      void issueOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phone]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const issueOtp = async () => {
    if (!phone || sending) return;
    setSending(true);
    try {
      await sendPhoneOtp({ phone, context, amount, coins });
      toast.success(`OTP sent to +91 ${phone.replace(/\D/g, '').slice(-10)}`);
      setIssued(true);
      setSecondsLeft(RESEND_SECONDS);
    } catch (e: any) {
      toast.error(e?.message || 'Could not send OTP. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.replace(/\D/g, '').length !== 6) {
      toast.error('Please enter the 6-digit OTP.');
      return;
    }
    setVerifying(true);
    try {
      const { success, verificationToken } = await verifyPhoneOtp({
        phone,
        otp: otp.replace(/\D/g, ''),
        context,
      });
      if (!success) {
        toast.error('Verification failed. Please try again.');
        return;
      }
      await onVerified(verificationToken);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'OTP verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const defaultTitle =
    context === 'reset'
      ? 'Reset Password — Verify OTP'
      : context === 'signup'
        ? 'Verify Mobile Number'
        : context === 'coin_redemption'
          ? 'Authorize Coin Redemption'
          : context === 'sales_return'
            ? 'Authorize Sales Return'
            : 'Verify OTP';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            We've sent a 6-digit OTP to{' '}
            <span className="font-medium text-gray-900">
              +91 {phone.replace(/\D/g, '').slice(-10)}
            </span>
            . Enter it below to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="otp">6-digit OTP</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="otp"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="pl-10 tracking-[0.4em] text-center font-medium text-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {secondsLeft > 0
                ? `Resend in ${secondsLeft}s`
                : issued
                  ? 'Didn\'t get the code?'
                  : 'Tap resend if needed.'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={issueOtp}
              disabled={sending || secondsLeft > 0}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend OTP'}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={verifying}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={verifying || otp.length !== 6}
            className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…
              </>
            ) : (
              'Verify & Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
