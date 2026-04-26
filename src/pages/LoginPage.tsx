import { ArrowLeft, Coins, Eye, EyeOff, Loader2, Shield, UserCircle, Users } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { OtpVerifyDialog } from '@/components/auth/OtpVerifyDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/auth-context';
import { resetCustomerPassword } from '@/services/otpService';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    mobile: '',
    password: '',
    role: 'customer',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Forgot-password OTP flow
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [resetOtpDialogOpen, setResetOtpDialogOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      role: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.role) {
      toast.error('Please select your role');
      return;
    }

    setIsLoading(true);

    try {
      const user = await login(formData.mobile, formData.password, formData.role);

      if (user.role !== formData.role) {
        toast.error(`Access denied. You are not registered as ${formData.role}`);
        setIsLoading(false);
        return;
      }

      toast.success('Login successful!');

      //Reset popup flag
      sessionStorage.removeItem('coinsPopupShown');

      // Navigate based on role and previous location
      let redirectPath;

      const from = location.state?.from;
      const fromPath = typeof from === 'string' ? from : from?.pathname || '';
      
      if (fromPath.startsWith('/shop')) {
          redirectPath = fromPath + (from?.search || '');
      } else {
          redirectPath =
            formData.role === 'admin'
              ? '/admin/dashboard'
              : formData.role === 'staff'
                ? '/staff/dashboard'
                : '/';
      }

      navigate(redirectPath, { replace: true });
    } catch (error: any) {
      // Surface the underlying reason — generic "Invalid credentials" hides
      // password-mismatch vs. user-not-found vs. network problems vs. disabled
      // staff/store, which makes login bugs nearly impossible to diagnose.
      const raw =
        (typeof error?.message === 'string' && error.message.trim()) ||
        (typeof error === 'string' && error) ||
        'Invalid credentials. Please try again.';
      const friendly = /invalid credentials/i.test(raw)
        ? 'Invalid mobile number or password. Please try again.'
        : raw;
      console.warn('[LoginPage] login failed:', error);
      toast.error(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setForgotMobile(formData.mobile || '');
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotNewPassword('');
    setForgotConfirmPassword('');
  };

  const handleSendResetOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = forgotMobile.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    if (forgotNewPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setResetOtpDialogOpen(true);
  };

  const handleResetVerified = async (verificationToken: string | undefined) => {
    if (!verificationToken) {
      toast.error('Verification token missing. Please request a new OTP.');
      return;
    }
    setResettingPassword(true);
    try {
      await resetCustomerPassword({
        phone: forgotMobile,
        newPassword: forgotNewPassword,
        verificationToken,
      });
      toast.success('Password reset successful. Please login with your new password.');
      setShowForgotPassword(false);
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setFormData(prev => ({ ...prev, mobile: forgotMobile, password: '' }));
    } catch (e: any) {
      toast.error(e?.message || 'Could not reset password. Please try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleBackToLanding = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={handleBackToLanding}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Surabhi Loyalty</h1>
              <p className="text-sm text-gray-600">Retail Business Platform</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              {showForgotPassword ? 'Forgot Password' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {showForgotPassword
                ? 'Contact admin to reset your password'
                : 'Sign in to your account to continue'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Role Selection */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                    Select Your Role
                  </Label>
                  <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger className="h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500">
                      <div className="flex items-center gap-3">
                        <UserCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <SelectValue placeholder="Choose your role" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-green-600" />
                          <span>Customer</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="staff">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-blue-600" />
                          <span>Store</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-red-600" />
                          <span>Admin</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Number */}
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    {/* <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      placeholder="Enter your mobile number"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="pl-10 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      autoComplete="username"
                      inputMode="numeric"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    {/* <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-10 pr-10 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-right">  
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium py-3 rounded-lg transition-all duration-200"
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>

                {/* Sign Up Link */}
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/signup')}
                      className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                    >
                      Sign up
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              /* Forgot Password Section: enter mobile + new password, then verify via OTP. */
              <form onSubmit={handleSendResetOtp} className="space-y-5">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
                  We will send a 6-digit OTP to your registered mobile number.
                  Enter it on the next screen to reset your password.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgotMobile">Registered Mobile Number</Label>
                  <Input
                    id="forgotMobile"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={forgotMobile}
                    onChange={e => setForgotMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="h-12"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgotNewPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="forgotNewPassword"
                      type={forgotShowPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={forgotNewPassword}
                      onChange={e => setForgotNewPassword(e.target.value)}
                      className="h-12 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPassword(!forgotShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {forgotShowPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forgotConfirmPassword">Confirm New Password</Label>
                  <Input
                    id="forgotConfirmPassword"
                    type={forgotShowPassword ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={forgotConfirmPassword}
                    onChange={e => setForgotConfirmPassword(e.target.value)}
                    className="h-12"
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={resettingPassword}
                  className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium py-3 rounded-lg"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    'Send OTP & Reset Password'
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleBackToLogin}
                  variant="outline"
                  className="w-full"
                  disabled={resettingPassword}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <OtpVerifyDialog
          open={resetOtpDialogOpen}
          onOpenChange={setResetOtpDialogOpen}
          phone={forgotMobile}
          context="reset"
          onVerified={handleResetVerified}
        />

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>
            Need help? Call{' '}
            <a href="tel:9606979530" className="text-purple-600 hover:underline font-medium">
              9606979530
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
