import { ArrowLeft, Coins, Eye, EyeOff, Phone, Shield, UserCircle, Users } from 'lucide-react';
import { useState } from 'react';
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

      // Navigate based on role and previous location
      let redirectPath;

      if (formData.role === 'customer' && location.state?.from?.pathname) {
          redirectPath = location.state.from.pathname;
      } else {
          redirectPath =
            formData.role === 'admin'
              ? '/admin/dashboard'
              : formData.role === 'staff'
                ? '/staff/dashboard'
                : '/customer/dashboard';
      }

      navigate(redirectPath, { replace: true });
    } catch (error) {
      toast.error('Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
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
              /* Forgot Password Section */
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Contact Admin</h3>
                  <p className="text-blue-800 text-sm mb-3">
                    To reset your password, please contact the administrator:
                  </p>
                  <div className="flex items-center gap-2 text-blue-900">
                    <Phone className="h-4 w-4" />
                    <a href="tel:9606979530" className="font-medium hover:underline">
                      9606979530
                    </a>
                  </div>
                </div>

                <Button onClick={handleBackToLogin} variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
