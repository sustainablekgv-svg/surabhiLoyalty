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
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import SEO from '@/components/SEO';


const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');
  
  const from = location.state?.from;
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingMobile, setIsCheckingMobile] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<'none' | 'available' | 'exists' | 'error'>('none');
  const [formData, setFormData] = useState({
  customerName: 'Valued Customer',
  customerMobile: '',
  customerPassword: '',
  confirmPassword: '',
  gender: 'other',
  dateOfBirth: '',
  storeLocation: 'Sustainable KGV Online',
  referredBy: referralCode || '',
});

 
  useEffect(() => {
    const checkMobileAvailability = async () => {
      const cleaned = formData.customerMobile.replace(/\D/g, '');
      if (cleaned.length !== 10) {
        setMobileStatus('none');
        return;
      }

      setIsCheckingMobile(true);
      setMobileStatus('none');

      try {
        const customersCollection = collection(db, 'Customers');
        const q = query(customersCollection, where('customerMobile', '==', cleaned));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setMobileStatus('exists');
        } else {
          setMobileStatus('available');
        }
      } catch (err) {
        console.error('Error prechecking mobile number:', err);
        setMobileStatus('error');
      } finally {
        setIsCheckingMobile(false);
      }
    };

    const timer = setTimeout(checkMobileAvailability, 500);
    return () => clearTimeout(timer);
  }, [formData.customerMobile]);


  const { settings } = useGlobalSettings();

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

  const [referralName, setReferralName] = useState<string | null>(null);
  const [referralNotFound, setReferralNotFound] = useState(false);
  const [isFetchingReferral, setIsFetchingReferral] = useState(false);

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
      const isRefCodeWithPrefix = refInput.toUpperCase().startsWith('REF-');
      const isShortCode = /^[a-zA-Z0-9]{4,10}$/.test(refInput) && !isFullPhone;

      if (!isFullPhone && !isRefCodeWithPrefix && !isShortCode) {
        // Still typing — don't flash "not found" yet
        setReferralName(null);
        setReferralNotFound(false);
        return;
      }

      setIsFetchingReferral(true);
      setReferralNotFound(false);
      try {
        const customersCollection = collection(db, 'Customers');
        
        let snapshot;
        if (isFullPhone) {
           let q = query(customersCollection, where('customerMobile', '==', refInput));
           snapshot = await getDocs(q);
        } else {
           const upperInput = refInput.toUpperCase();
           const searchCodes = isRefCodeWithPrefix ? [upperInput] : [upperInput, `REF-${upperInput}`];
           let q = query(customersCollection, where('referralCode', 'in', searchCodes));
           snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as CustomerType;
          if (
            data.walletRechargeDone === true ||
            data.saleElgibility === true ||
            settings?.allowReferralsWithoutPurchase
          ) {
            setReferralName(data.customerName);
            setReferralNotFound(false);
          } else {
            setReferralName(null);
            setReferralNotFound(true);
            toast.error('This customer is not eligible for referral (no purchases made)');
          }
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
  }, [formData.referredBy, settings?.allowReferralsWithoutPurchase]);

  const [isPasswordTouched, setIsPasswordTouched] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);

  const validateForm = (): boolean => {
    setIsPasswordTouched(true);

    if (formData.customerPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }

    if (mobileStatus === 'exists') {
      toast.error('This mobile number is already registered. Please login.');
      return false;
    }

    if (
      !formData.customerMobile ||
      !formData.customerPassword
    ) {
      toast.error('Mobile number and password are required');
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
      let finalReferredBy = formData.referredBy?.trim() || null;
      if (finalReferredBy) {
        const isShortCode = /^[a-zA-Z0-9]{5}$/.test(finalReferredBy);
        if (isShortCode) {
          finalReferredBy = `REF-${finalReferredBy.toUpperCase()}`;
        } else if (finalReferredBy.toUpperCase().startsWith('REF-')) {
          finalReferredBy = finalReferredBy.toUpperCase();
        }
      }

      await registerCustomer({
        customerName: formData.customerName,
        customerMobile: formData.customerMobile,
        customerPassword: formData.customerPassword,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        storeLocation: formData.storeLocation,
        referredBy: finalReferredBy,
        isStudent: false,
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
      <SEO 
        title="Join Sustainable KGV"
        description="Sign up for Sustainable KGV. Support farmers, gopalaks, and earn rewards while shopping for premium organic products."
        keywords="signup, loyalty program, surabhi, organic rewards"
      />
      <div className="w-full max-w-md">
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
              <h1 className="text-xl font-bold text-gray-900">Sustainable KGV</h1>
              <p className="text-sm text-gray-600">Join our community</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Create Account</CardTitle>
            <CardDescription className="text-gray-600">Verify your mobile to join instantly</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="h-12 text-base rounded-[6px]"
                      required
                    />
                </div>
                {formData.customerMobile.length > 0 && formData.customerMobile.length < 10 && (
                  <p className="text-xs text-amber-600">{10 - formData.customerMobile.length} more digit{10 - formData.customerMobile.length !== 1 ? 's' : ''} needed</p>
                )}
                {formData.customerMobile.length === 10 && (
                  <>
                    {isCheckingMobile && (
                      <p className="text-xs text-purple-600 flex items-center gap-1 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
                        Checking mobile availability...
                      </p>
                    )}
                    {!isCheckingMobile && mobileStatus === 'available' && (
                      <p className="text-xs text-green-600 font-medium">✓ Available for signup</p>
                    )}
                    {!isCheckingMobile && mobileStatus === 'exists' && (
                      <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                        ⚠️ This mobile number is already registered. Please login instead.
                      </p>
                    )}
                    {!isCheckingMobile && mobileStatus === 'error' && (
                      <p className="text-xs text-amber-600">Could not verify registration state</p>
                    )}
                  </>
                )}
              </div>

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
                      readOnly={!!referralCode}
                      className={`h-12 pr-10 text-base rounded-[6px] ${
                        referralCode ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
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
                        ⚠️ No referrer found — you can still sign up.
                    </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPassword">Password *</Label>
                <div className="relative">
                    <Input 
                      id="customerPassword" 
                      name="customerPassword" 
                      type="password" 
                      placeholder="Create login password" 
                      value={formData.customerPassword} 
                      onChange={handleInputChange} 
                      onBlur={() => setIsPasswordTouched(true)}
                      className="h-12 text-base rounded-[6px]" 
                      required 
                    />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                 <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      type="password" 
                      placeholder="Confirm password" 
                      value={formData.confirmPassword} 
                      onChange={handleInputChange} 
                      className="h-12 text-base rounded-[6px]" 
                      required 
                    />
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-semibold py-3 rounded-lg mt-4 h-12" disabled={isLoading}>
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
