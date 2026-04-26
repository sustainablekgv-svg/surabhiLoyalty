import { ArrowLeft, CheckCircle, Coins, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { OtpVerifyDialog } from '@/components/auth/OtpVerifyDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registerCustomer } from '@/lib/authService';

// import { PasswordStrengthIndicator } from '@/components/ui/password-strength';
import { db } from '@/lib/firebase';
import { CustomerType } from '@/types/types';
import { collection, getDocs, query, where } from 'firebase/firestore';


const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  
  const from = location.state?.from;
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerMobile: '',
    customerPassword: '',
    confirmPassword: '',
    gender: '',
    dateOfBirth: '',
    storeLocation: 'Sustainable KGV Online',
    referredBy: referralCode || '',

  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'customerMobile') {
      // Strip country code prefixes (+91, 0091, 91 followed by 10 digits) and non-digits, cap at 10
      const stripped = value
        .replace(/\D/g, '')
        .replace(/^(?:0{0,2}91)?(\d{10})$/, '$1');
      const digits = stripped.slice(0, 10);
      setFormData(prev => ({ ...prev, customerMobile: digits }));
      return;
    }

    if (name === 'referredBy') {
      // If it looks like a phone number, strip country codes; allow REF- codes as-is
      const isPhone = /^[\d+\s-]+$/.test(value);
      if (isPhone) {
        const stripped = value
          .replace(/\D/g, '')
          .replace(/^(?:0{0,2}91)?(\d{10})$/, '$1')
          .slice(0, 10);
        setFormData(prev => ({ ...prev, referredBy: stripped }));
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value,
    }));
  };
  
  const [stores, setStores] = useState<string[]>([]);
  const [referralName, setReferralName] = useState<string | null>(null);
  const [referralNotFound, setReferralNotFound] = useState(false);
  const [isFetchingReferral, setIsFetchingReferral] = useState(false);

  // Fetch stores dynamically removed - hardcoded to Sustainable KGV Online

  // Fetch referral details
  useEffect(() => {
    const fetchReferralName = async () => {
      const refInput = formData.referredBy?.trim();
      if (!refInput) {
        setReferralName(null);
        setReferralNotFound(false);
        return;
      }

      const isFullPhone = /^\d{10}$/.test(refInput);
      const isRefCode = refInput.startsWith('REF-');
      if (!isFullPhone && !isRefCode) {
        // Still typing — don't flash "not found" yet
        setReferralName(null);
        setReferralNotFound(false);
        return;
      }

      setIsFetchingReferral(true);
      setReferralNotFound(false);
      try {
        const customersCollection = collection(db, 'Customers');
        // Check by referral code first, then by mobile
        let q = query(customersCollection, where('referralCode', '==', refInput));
        let snapshot = await getDocs(q);

        if (snapshot.empty && isFullPhone) {
          q = query(customersCollection, where('customerMobile', '==', refInput));
          snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as CustomerType;
          setReferralName(data.customerName);
          setReferralNotFound(false);
        } else {
          setReferralName(null);
          setReferralNotFound(true);
        }
      } catch (error) {
        console.error('Error fetching referral:', error);
        setReferralName(null);
        setReferralNotFound(false);
      } finally {
        setIsFetchingReferral(false);
      }
    };

    const timer = setTimeout(fetchReferralName, 600);
    return () => clearTimeout(timer);
  }, [formData.referredBy]);

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [isPasswordTouched, setIsPasswordTouched] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);

  const validateForm = (): boolean => {
    setIsPasswordTouched(true);

    if (formData.customerPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    if (
      !formData.customerName ||
      !formData.customerMobile ||
      !formData.dateOfBirth ||
      !formData.gender ||
      !formData.storeLocation ||
      !formData.customerPassword
    ) {
      toast.error('All fields are mandatory');
      return false;
    }

    const cleanedMobile = formData.customerMobile.replace(/\D/g, '');
    if (cleanedMobile.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return false;
    }

    return true;
  };

  // Step 1: validate locally → open OTP dialog. The dialog auto-issues an OTP
  // to the entered mobile (server enforces "phone not already registered").
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setOtpDialogOpen(true);
  };

  // Step 2: only after the OTP is verified do we actually create the account.
  const handleOtpVerified = async () => {
    setIsLoading(true);
    try {
      const isStudent = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) < 25 : false;

      await registerCustomer({
        customerName: formData.customerName,
        customerMobile: formData.customerMobile,
        customerPassword: formData.customerPassword,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        storeLocation: formData.storeLocation,
        referredBy: formData.referredBy || null,
        isStudent: isStudent,
        demoStore: false,
      });

      toast.success('Mobile verified — registration successful! Please login.');
      navigate('/login', { state: { from } });
    } catch (error: any) {
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { state: { from } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
            <Button
                variant="ghost"
                onClick={handleBackToLogin}
                className="mb-4 text-gray-600 hover:text-gray-900"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
            </Button>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Surabhi Loyalty</h1>
              <p className="text-sm text-gray-600">Join our community</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Create Account</CardTitle>
            <CardDescription className="text-gray-600">Enter your details to register</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Full Name *</Label>
                <div className="relative">
                    {/* <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input id="customerName" name="customerName" placeholder="Enter your full name" value={formData.customerName} onChange={handleInputChange} className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerMobile">Mobile Number *</Label>
                <div className="relative">
                    <Input
                      id="customerMobile"
                      name="customerMobile"
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={formData.customerMobile}
                      onChange={handleInputChange}
                      maxLength={10}
                      className="h-12"
                      required
                    />
                </div>
                {formData.customerMobile.length > 0 && formData.customerMobile.length < 10 && (
                  <p className="text-xs text-amber-600">{10 - formData.customerMobile.length} more digit{10 - formData.customerMobile.length !== 1 ? 's' : ''} needed</p>
                )}
                {formData.customerMobile.length === 10 && (
                  <p className="text-xs text-green-600">✓ Valid mobile number</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <div className="relative">
                        <Input
                            type="date"
                            id="dateOfBirth"
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleInputChange}
                            className="w-full h-12 px-3 text-base text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                            required
                        />
                        {/* Custom styling placeholder handled by native input placeholder semantics if needed */}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <div className="relative">
                        {/* <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" /> */}
                        <Select value={formData.gender} onValueChange={handleGenderChange}>
                            <SelectTrigger className="h-12 w-full pl-10">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
              </div>

              {/* <div className="space-y-2">
                <Label htmlFor="storeLocation">Store Location *</Label>
                <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        value={formData.storeLocation} 
                        readOnly 
                        className="pl-10 bg-gray-50 text-gray-500 cursor-not-allowed" 
                    />
                </div>
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="referredBy">Referral Code / Number (Optional)</Label>
                <div className="relative">
                    <Input
                        id="referredBy"
                        name="referredBy"
                        type="text"
                        inputMode="text"
                        placeholder="Referral code or 10-digit mobile"
                        value={formData.referredBy}
                        onChange={handleInputChange}
                        className="h-12 pr-10"
                    />
                    {isFetchingReferral && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        </div>
                    )}
                    {!isFetchingReferral && referralName && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                    )}
                </div>
                {!isFetchingReferral && referralName && (
                    <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Referrer: <strong>{referralName}</strong>
                    </p>
                )}
                {!isFetchingReferral && referralNotFound && (
                    <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        ⚠️ No referrer found — you have not got any referrer. You can still sign up.
                    </p>
                )}
                {!isFetchingReferral && !referralName && !referralNotFound && !formData.referredBy && (
                    <p className="text-xs text-gray-400 mt-1">You have not got any referrer (optional).</p>
                )}
              </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPassword">Password *</Label>
                  <div className="relative">
                      {/* <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                      <Input 
                        id="customerPassword" 
                        name="customerPassword" 
                        type="password" 
                        placeholder="Create password" 
                        value={formData.customerPassword} 
                        onChange={handleInputChange} 
                        onBlur={() => setIsPasswordTouched(true)}
                        className="pl-10 h-12" 
                        required 
                      />
                  </div>
                  {/* <PasswordStrengthIndicator 
                    password={formData.customerPassword} 
                    onValidationChange={setIsPasswordValid} 
                    showError={isPasswordTouched}
                  /> */}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                   <div className="relative">
                      {/* <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                      <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm password" value={formData.confirmPassword} onChange={handleInputChange} className="pl-10" required />
                  </div>
                </div>


              <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium py-3 rounded-lg mt-4" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Verify Mobile & Sign Up'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <OtpVerifyDialog
        open={otpDialogOpen}
        onOpenChange={setOtpDialogOpen}
        phone={formData.customerMobile}
        context="signup"
        onVerified={handleOtpVerified}
      />
    </div>
  );
};

export default SignupPage;
