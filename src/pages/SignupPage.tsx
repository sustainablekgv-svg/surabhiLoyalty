import { ArrowLeft, CheckCircle, Coins, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

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
    tpin: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
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
  const [isFetchingReferral, setIsFetchingReferral] = useState(false);

  // Fetch stores dynamically removed - hardcoded to Sustainable KGV Online

  // Fetch referral details
  useEffect(() => {
      const fetchReferralName = async () => {
        const refInput = formData.referredBy?.trim();
        if (refInput && (refInput.length === 10 || refInput.startsWith('REF-'))) {
          setIsFetchingReferral(true);
          try {
            const customersCollection = collection(db, 'Customers');
            // Check by Code first, then Mobile
            let q = query(customersCollection, where('referralCode', '==', refInput));
            let snapshot = await getDocs(q);

            if (snapshot.empty && /^\d{10}$/.test(refInput)) {
                 q = query(customersCollection, where('customerMobile', '==', refInput));
                 snapshot = await getDocs(q);
            }

            if (!snapshot.empty) {
              const data = snapshot.docs[0].data() as CustomerType;
              setReferralName(data.customerName);
            } else {
              setReferralName(null);
            }
          } catch (error) {
            console.error('Error fetching referral:', error);
            setReferralName(null);
          } finally {
            setIsFetchingReferral(false);
          }
        } else {
          setReferralName(null);
        }
      };

      const timer = setTimeout(() => {
        if (formData.referredBy) {
          fetchReferralName();
        } else {
          setReferralName(null);
        }
      }, 500);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPasswordTouched(true);

    if (formData.customerPassword !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // if (!isPasswordValid) {
    //     toast.error("Please choose a stronger password");
    //     return;
    // }

    if (!formData.customerName || !formData.customerMobile || !formData.dateOfBirth || !formData.gender || !formData.storeLocation || !formData.customerPassword || !formData.tpin) {
        toast.error("All fields are mandatory");
        return;
    }

    if (!/^\d{4}$/.test(formData.tpin)) {
        toast.error("TPIN must be exactly 4 digits");
        return;
    }

    if (!formData.storeLocation) {
        toast.error("Please select a store location");
        return;
    }

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
        tpin: formData.tpin, 
        // Initial defaults handled in service
      });

      toast.success('Registration successful! Please login.');
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
                    {/* <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input id="customerMobile" name="customerMobile" type="tel" placeholder="Enter mobile number" value={formData.customerMobile} onChange={handleInputChange} className="pl-10" required />
                </div>
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
                    {/* <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input 
                        id="referredBy" 
                        name="referredBy" 
                        placeholder="Referral Code / Mobile Number" 
                        value={formData.referredBy} 
                        onChange={handleInputChange} 
                        className="pl-10" 
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
                {referralName && (
                    <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                        Referrer: {referralName}
                    </p>
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

              <div className="space-y-2">
                <Label htmlFor="tpin">TPIN (4 Digits) *</Label>
                 <div className="relative">
                    {/* <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /> */}
                    <Input 
                        id="tpin" 
                        name="tpin" 
                        type="password" 
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Set 4-digit PIN" 
                        value={formData.tpin} 
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            handleInputChange({ target: { name: 'tpin', value: val } } as any);
                        }} 
                        className="pl-10" 
                        required 
                    />
                </div>
                <p className="text-xs text-muted-foreground">Used for verifying transactions</p>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium py-3 rounded-lg mt-4" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
