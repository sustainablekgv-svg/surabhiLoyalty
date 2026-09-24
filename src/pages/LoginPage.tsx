import { ArrowLeft, Coins, Eye, EyeOff, Loader2, Shield, Store, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { OtpVerifyDialog } from '@/components/auth/OtpVerifyDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/auth-context';
import { getUserName } from '@/lib/userUtils';
import { resetCustomerPassword } from '@/services/otpService';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Determine role based on the current pathname
  const getRoleFromPath = (path: string): 'customer' | 'admin' | 'staff' => {
    if (path.startsWith('/admin')) {
      return 'admin';
    }
    if (path.startsWith('/shop/login')) {
      return 'staff';
    }
    return 'customer';
  };

  const currentRole = getRoleFromPath(location.pathname);

  const [formData, setFormData] = useState({
    mobile: '',
    password: '',
    role: currentRole,
  });

  // Sync role if pathname changes
  useEffect(() => {
    const pathRole = getRoleFromPath(location.pathname);
    setFormData(prev => ({ ...prev, role: pathRole }));
  }, [location.pathname]);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [logoClicks, setLogoClicks] = useState(0);
  const [exclusiveMode, setExclusiveMode] = useState(
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/shop/login')
  );

  // Keyboard shortcut Ctrl + Shift + H to toggle exclusive mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setExclusiveMode(prev => {
          const next = !prev;
          if (next) {
            toast.info('Exclusive Portal Access Mode Enabled', {
              description: 'You can now toggle between Customer, Store, and Admin portals.',
            });
          } else {
            toast.info('Exclusive Portal Access Mode Disabled');
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset logo clicks timer
  useEffect(() => {
    if (logoClicks > 0) {
      const timer = setTimeout(() => setLogoClicks(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [logoClicks]);

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setExclusiveMode(prevExclusive => {
          const nextExclusive = !prevExclusive;
          if (nextExclusive) {
            toast.info('Exclusive Portal Access Mode Enabled', {
              description: 'You can now toggle between Customer, Store, and Admin portals.',
            });
          } else {
            toast.info('Exclusive Portal Access Mode Disabled');
          }
          return nextExclusive;
        });
        return 0;
      }
      return next;
    });
  };



  // Forgot-password OTP flow
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [resetOtpDialogOpen, setResetOtpDialogOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'mobile') {
      // Strip country code prefixes (+91, 0091, 91+10 digits) and non-digits, cap at 10
      const digits = value
        .replace(/\D/g, '')
        .replace(/^(?:0{0,2}91)?(\d{10})$/, '$1')
        .slice(0, 10);
      setFormData(prev => ({ ...prev, mobile: digits }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
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

      const actualRole = user.role;
      const greetingName = getUserName(user) || 'User';
      toast.success(`Login successful! Welcome, ${greetingName}`);

      // Reset popup flag
      sessionStorage.removeItem('coinsPopupShown');

      // Navigate based on verified role and previous location
      let redirectPath;

      const from = location.state?.from;
      const fromPath = typeof from === 'string' ? from : from?.pathname || '';
      
      if (actualRole === 'customer' && fromPath && !fromPath.startsWith('/login')) {
          redirectPath = fromPath + (from?.search || '');
      } else {
          redirectPath =
            actualRole === 'admin'
              ? '/admin/dashboard'
              : actualRole === 'staff'
                ? '/staff/dashboard'
                : '/customer/dashboard';
      }

      navigate(redirectPath, { replace: true });
    } catch (error: any) {
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

  const roleConfig = {
    customer: {
      title: showForgotPassword ? 'Reset Password' : 'Customer Sign In',
      description: showForgotPassword
        ? 'Enter your mobile number to reset your password'
        : 'Sign in to your customer account to continue',
      colorClass: 'from-purple-600 to-amber-500',
    },
    admin: {
      title: showForgotPassword ? 'Forgot Password' : 'Admin Sign In',
      description: showForgotPassword
        ? 'Password reset instructions'
        : 'Sign in to the administration panel',
      colorClass: 'from-purple-600 to-amber-500',
    },
    staff: {
      title: showForgotPassword ? 'Forgot Password' : 'Shop Sign In',
      description: showForgotPassword
        ? 'Password reset instructions'
        : 'Sign in to the shop management panel',
      colorClass: 'from-purple-600 to-amber-500',
    },
  };

  const config = roleConfig[formData.role as 'customer' | 'admin' | 'staff'] || roleConfig.customer;

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

          <div 
            className="flex items-center justify-center gap-3 mb-4 cursor-pointer select-none active:scale-95 transition-transform"
            onClick={handleLogoClick}
          >
            <div className={`bg-gradient-to-br ${config.colorClass} p-2 rounded-lg transition-colors duration-300`}>
              {formData.role === 'admin' ? (
                <Shield className="h-6 w-6 text-white" />
              ) : formData.role === 'staff' ? (
                <Store className="h-6 w-6 text-white" />
              ) : (
                <Coins className="h-6 w-6 text-white" />
              )}
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
              {config.title}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {config.description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!showForgotPassword && (
              <div className="mb-6 bg-purple-50/50 backdrop-blur-sm border border-purple-100 rounded-xl p-1.5 flex justify-around gap-1.5 shadow-inner animate-in fade-in duration-350">
                {[
                  { role: 'customer', label: 'Customer', icon: UserCircle, color: 'text-purple-600', activeBg: 'text-purple-700 bg-white border border-gray-200/50 shadow-sm' },
                  { role: 'staff', label: 'Store Portal', icon: Store, color: 'text-purple-600', activeBg: 'text-purple-700 bg-white border border-gray-200/50 shadow-sm' },
                  { role: 'admin', label: 'Admin Portal', icon: Shield, color: 'text-purple-600', activeBg: 'text-purple-700 bg-white border border-gray-200/50 shadow-sm' },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = formData.role === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, role: item.role as any }));
                        if (item.role === 'customer') navigate('/login', { replace: true });
                        else if (item.role === 'staff') navigate('/shop/login', { replace: true });
                        else if (item.role === 'admin') navigate('/admin/login', { replace: true });
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border border-transparent ${
                        isActive
                          ? `${item.activeBg} font-bold`
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${item.color}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}

            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Mobile Number */}
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      className="pl-3 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      autoComplete="username"
                      inputMode="numeric"
                      maxLength={10}
                      required
                    />
                  </div>
                  {formData.mobile.length > 0 && formData.mobile.length < 10 && (
                    <p className="text-xs text-amber-600">{10 - formData.mobile.length} more digit{10 - formData.mobile.length !== 1 ? 's' : ''} needed</p>
                  )}

                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-3 pr-10 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
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
                  className={`w-full bg-gradient-to-r ${config.colorClass} hover:opacity-90 text-white font-medium py-3 rounded-lg transition-all duration-200`}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>

                {/* Sign Up Link (Customer Only) */}
                {formData.role === 'customer' && (
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
                )}
              </form>
            ) : (
              formData.role === 'customer' ? (
                /* Customer Forgot Password Section: enter mobile + new password, then verify via OTP. */
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
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={forgotMobile}
                      onChange={e => {
                        const digits = e.target.value
                          .replace(/\D/g, '')
                          .replace(/^(?:0{0,2}91)?(\d{10})$/, '$1')
                          .slice(0, 10);
                        setForgotMobile(digits);
                      }}
                      className="h-12"
                      required
                    />
                    {forgotMobile.length > 0 && forgotMobile.length < 10 && (
                      <p className="text-xs text-amber-600">{10 - forgotMobile.length} more digit{10 - forgotMobile.length !== 1 ? 's' : ''} needed</p>
                    )}
                    {forgotMobile.length === 10 && (
                      <p className="text-xs text-green-600">✓ Valid mobile number</p>
                    )}
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
              ) : (
                /* Non-Customer Forgot Password Section */
                <div className="space-y-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    Password resets for administrators and store staff are managed centrally. Please contact the system administrator to reset your credentials.
                  </div>
                  <Button
                    type="button"
                    onClick={handleBackToLogin}
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Button>
                </div>
              )
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
