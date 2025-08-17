import { sendPasswordResetEmail } from 'firebase/auth';
import { Coins, Eye, EyeOff, Lock, Mail, Phone, Shield, UserCircle, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
import { getCustomerByMobile } from '@/lib/db';
import { auth } from '@/lib/firebase';

const Index = () => {
  const [showPassword, setShowPassword] = useState(false);
  interface FormData {
    mobile: string;
    password: string;
    role: 'customer' | 'staff' | 'admin';
  }

  const [formData, setFormData] = useState<FormData>({
    mobile: '',
    password: '',
    role: 'customer',
  });
  console.log('The role selected is', formData.role);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  const { login, isLoading, isAuthenticated, isInitialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Combined redirection useEffect - this fixes the hooks error
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      // Get the intended path from location state or use role-based default
      const redirectPath =
        location.state?.from?.pathname ||
        (formData.role === 'admin'
          ? '/admin/dashboard'
          : formData.role === 'staff'
            ? '/staff/dashboard'
            : '/customer/dashboard');

      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, isInitialized, formData.role, navigate, location]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-amber-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Update the handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.role) {
      toast.error('Please select your role');
      return;
    }

    try {
      const user = await login(formData.mobile, formData.password, formData.role);

      if (user.role !== formData.role) {
        toast.error(`Access denied. You are not registered as ${formData.role}`);
        return;
      }

      // Don't navigate here - let the useEffect handle it
      toast.success('Login successful!');
    } catch (error) {
      toast.error('Invalid credentials. Please try again.');
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.mobile) {
      toast.error('Please enter your mobile number first');
      return;
    }

    if (!formData.role) {
      toast.error('Please select your role first');
      return;
    }

    try {
      setIsLoadingEmail(true);

      if (formData.role === 'admin') {
        toast.info('Please contact the developer for password reset');
        return;
      }

      if (formData.role === 'staff') {
        toast.info('Please contact your admin for password reset');
        return;
      }

      const customer = await getCustomerByMobile(formData.mobile);
      if (!customer) {
        toast.error('No customer found with this mobile number');
        return;
      }

      setForgotPasswordMode(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Error processing your request. Please try again.');
      } else {
        toast.error('Error processing your request. Please try again.');
      }
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const sendResetEmail = async () => {
    try {
      if (!customerEmail) {
        toast.error('No email registered for this account');
        return;
      }

      await sendPasswordResetEmail(auth, customerEmail);
      toast.success(`Password reset email sent to ${customerEmail}`);
      setForgotPasswordMode(false);
      setCustomerEmail('');
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || 'Failed to send reset email. Please try again.');
      } else {
        toast.error('Failed to send reset email. Please try again.');
      }
    }
  };

  const cancelForgotPassword = () => {
    setForgotPasswordMode(false);
    setCustomerEmail('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1.5 sm:p-2 rounded-lg">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Surabhi Loyalty</h1>
              <p className="text-xs sm:text-sm text-gray-600">Retail Business Platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
                {forgotPasswordMode ? 'Reset Password' : 'Welcome Back'}
              </CardTitle>
              <CardDescription className="text-gray-600">
                {forgotPasswordMode
                  ? "We'll send a reset link to your registered email"
                  : 'Sign in to access the application'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {forgotPasswordMode ? (
                <div className="space-y-4 sm:space-y-5">
                  <div className="p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-700">
                          Registered Email
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {isLoadingEmail ? 'Loading...' : customerEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <Button
                      onClick={cancelForgotPassword}
                      variant="outline"
                      className="flex-1 h-10 sm:h-12 text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={sendResetEmail}
                      disabled={isLoadingEmail || !customerEmail}
                      className="flex-1 h-10 sm:h-12 text-sm bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium rounded-lg"
                    >
                      Send Reset Link
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-medium text-gray-700">
                      Select Your Role
                    </Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: 'customer' | 'staff' | 'admin') =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger className="h-10 sm:h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-xs sm:text-sm">
                        <div className="flex items-center gap-4 sm:gap-5">
                          <UserCircle className="h-4 sm:h-5 w-4 sm:w-5 text-gray-400 flex-shrink-0" />
                          <SelectValue placeholder="Choose your role" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Users className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />
                            <span className="text-xs sm:text-sm">Customer</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="staff">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Shield className="h-4 sm:h-5 w-4 sm:w-5 text-blue-600" />
                            <span className="text-xs sm:text-sm">Store</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Shield className="h-4 sm:h-5 w-4 sm:w-5 text-red-600" />
                            <span className="text-xs sm:text-sm">Admin</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                      Mobile Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 sm:h-5 w-4 sm:w-5 text-gray-400" />
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="Enter your mobile number"
                        value={formData.mobile}
                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                        className="pl-12 sm:pl-16 h-10 sm:h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 sm:h-5 w-4 sm:w-5 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="pl-12 sm:pl-16 pr-10 sm:pr-12 h-10 sm:h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-xs sm:text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 sm:h-5 w-4 sm:w-5" />
                        ) : (
                          <Eye className="h-4 sm:h-5 w-4 sm:w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isLoadingEmail}
                      className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      {isLoadingEmail ? 'Loading...' : 'Forgot Password?'}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 sm:h-12 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-white mr-2"></div>
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Features Section */}
          {!forgotPasswordMode && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white/60 rounded-lg backdrop-blur-sm">
                <div className="bg-purple-100 p-3 rounded-full w-fit mx-auto mb-2">
                  <Coins className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium text-gray-900">Surabhi Coins</h3>
                <p className="text-sm text-gray-600">Earn coins on every purchase</p>
              </div>

              <div className="text-center p-4 bg-white/60 rounded-lg backdrop-blur-sm">
                <div className="bg-amber-100 p-3 rounded-full w-fit mx-auto mb-2">
                  <Users className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="font-medium text-gray-900">Referral System</h3>
                <p className="text-sm text-gray-600">Earn from referrals</p>
              </div>

              <div className="text-center p-4 bg-white/60 rounded-lg backdrop-blur-sm">
                <div className="bg-red-100 p-3 rounded-full w-fit mx-auto mb-2">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-medium text-gray-900">Seva Pool</h3>
                <p className="text-sm text-gray-600">Community contributions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
