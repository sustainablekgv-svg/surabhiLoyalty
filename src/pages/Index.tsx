import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Shield, Users, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    mobile: '',
    password: ''
  });
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login(formData.mobile, formData.password);
      toast.success('Login successful!');

      // Redirect based on user role
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'staff') {
        navigate('/staff/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (error) {
      toast.error('Invalid credentials. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    if (!formData.mobile) {
      toast.error('Please enter your mobile number first');
      return;
    }
    // Implement forgot password functionality
    toast.success('Password reset link sent to your email');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Loyalty Rewards</h1>
              <p className="text-sm text-gray-600">Retail Business Platform</p>
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
                Welcome Back
              </CardTitle>
              <CardDescription className="text-gray-600">
                Sign in to access your loyalty rewards
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="login" className="data-[state=active]:bg-purple-100">
                    Sign In
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4 mt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                        Mobile Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="mobile"
                          type="tel"
                          placeholder="Enter your mobile number"
                          value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          className="pl-10 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="pl-10 pr-10 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium rounded-lg transition-all duration-200"
                    >
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Features Section */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/60 rounded-lg backdrop-blur-sm">
              <div className="bg-purple-100 p-3 rounded-full w-fit mx-auto mb-2">
                <Coins className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900">Loyalty Rewards</h3>
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
              <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-2">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900">Secure Platform</h3>
              <p className="text-sm text-gray-600">Your data is protected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
