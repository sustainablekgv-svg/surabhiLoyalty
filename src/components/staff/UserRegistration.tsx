import { useState, useEffect } from 'react';
import {
  UserPlus,
  Phone,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  Link2,
  Loader2,
  Search,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { auth, db } from '@/lib/firebase';
import { 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  Timestamp
} from 'firebase/firestore';

import { Customer, UserRegistrationProps } from '@/types/types';

export const UserRegistration = ({ storeLocation }: UserRegistrationProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [referralName, setReferralName] = useState<string | null>(null);
  const [isFetchingReferral, setIsFetchingReferral] = useState(false);
  const [isElgibleForReferral, setIsElgibleForReferral] = useState(false);
  const [isReferralEntered, setIsReferralEntered] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    referredBy: '',
    tpin: ''
  });

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        toast.success('Authentication ready');
      } else {
        signInAnonymously(auth)
          .then(() => toast.success('Anonymous session started'))
          .catch(error => {
            toast.error('Failed to start anonymous session');
            console.error('Anonymous auth error:', error);
          });
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Fetch referral name when mobile number is entered
  useEffect(() => {
    const fetchReferralName = async () => {
      if (formData.referredBy?.length === 10 && /^\d+$/.test(formData.referredBy)) {
        setIsFetchingReferral(true);
        try {
          const customersCollection = collection(db, 'customers');
          const referralQuery = query(
            customersCollection,
            where('mobile', '==', formData.referredBy)
          );
          const querySnapshot = await getDocs(referralQuery);
          
          if (!querySnapshot.empty) {
          const referralData = querySnapshot.docs[0].data() as Customer;
            console.log("THe referral Data is", referralData);
          // Check if wallet recharge is done
          if (referralData.walletRechargeDone === false || referralData.saleElgibility == false) {
          setReferralName(null);
          if(referralData.walletRechargeDone === false){
          toast.error('This customer is not eligible for referral (wallet recharge not done)');
          }else{
          toast.error('This customer is not eligible for referral (no sale is done)');
          }} 
          else {
          setReferralName(referralData.name);
          setIsElgibleForReferral(true);
          toast.success(`Referral found: ${referralData.name}`);
          }
          } else {
          setReferralName(null);
          toast.error('No customer found with this mobile number');
          }
        } catch (error) {
          console.error('Error fetching referral:', error);
          toast.error('Failed to check referral');
          setReferralName(null);
        } finally {
          setIsFetchingReferral(false);
        }
      } else {
        setReferralName(null);
      }
    };

    const timer = setTimeout(() => {
      if (formData.referredBy?.length === 10) {
        fetchReferralName();
      } else {
        setReferralName(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData.referredBy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthReady) {
      toast.error('System is not ready yet. Please try again.');
      return;
    }

    if (!formData.name || !formData.mobile || !formData.email || !formData.password || !formData.tpin) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!/^\d{10}$/.test(formData.mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!/^\d{4}$/.test(formData.tpin)) {
      toast.error('TPIN must be 4 digits');
      return;
    }

    if (formData.referredBy && !/^\d{10}$/.test(formData.referredBy)) {
      toast.error('Referral number must be 10 digits');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Checking details...');

    try {
      const customersCollection = collection(db, 'customers');

      // Check if email already exists
      const emailQuery = query(customersCollection, where('email', '==', formData.email));
      const emailSnap = await getDocs(emailQuery);
      if (!emailSnap.empty) {
        toast.error('This email is already registered.', { id: toastId });
        setIsLoading(false);
        return;
      }

      // Check if mobile number already exists
      const mobileQuery = query(customersCollection, where('mobile', '==', formData.mobile));
      const mobileSnap = await getDocs(mobileQuery);
      if (!mobileSnap.empty) {
        toast.error('This mobile number is already registered.', { id: toastId });
        setIsLoading(false);
        return;
      }

      // Proceed with registration
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const newUserUid = userCredential.user.uid;

      const walletId = `WALLET-${newUserUid.substring(0, 8).toUpperCase()}`;
      const newUserData: Customer = {
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        walletRechargeDone: false,
        storeLocation,
        walletBalance: 0,
        walletBalanceCurrentMonth: 0,
        surabhiCoins: 0,
        surabhiCoinsCurrentMonth: 0,
        sevaCoinsTotal: 0,
        sevaCoinsCurrentMonth: 0,
        createdAt: Timestamp.fromDate(new Date()),
        role: 'customer',
        walletId,
        customerPassword: formData.password,
        tpin: formData.tpin,
        saleElgibility: false,
        registered: true,
        lastTransactionDate: null,
        referredBy: formData.referredBy || null,
        referralSurabhi: null,
        referredUsers: null,
        quarterlyPurchaseTotal: 0,
        coinsFrozen:true,
        currentQuarterStart: null,
        lastQuarterCheck: null
      };

      await setDoc(doc(customersCollection, newUserUid), newUserData);

      // Handle referral if exists
      if (formData.referredBy && referralName) {
        const referrerQuery = query(
          customersCollection,
          where('mobile', '==', formData.referredBy)
        );
        const referrerSnapshot = await getDocs(referrerQuery);

        if (!referrerSnapshot.empty) {
          const referrerDoc = referrerSnapshot.docs[0];
          await updateDoc(doc(customersCollection, referrerDoc.id), {
            referredUsers: arrayUnion({
              mobile: formData.mobile,
              referralDate: Timestamp.fromDate(new Date())
            })
          });
          toast.success(`User registered! Referral recorded.`, { id: toastId });
        }
      } else {
        toast.success('User registered successfully!', { id: toastId });
      }

      // Reset form
      setFormData({
        name: '',
        mobile: '',
        email: '',
        password: '',
        referredBy: '',
        tpin: ''
      });
      setReferralName(null);

    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'permission-denied':
          errorMessage = 'You don&apos;t have permission to perform this action.';
          break;
      }

      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePassword = () => {
    if (!formData.name || !formData.mobile || !formData.email) {
      toast.error('Please fill name, mobile and email first');
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    toast.success('Secure password generated!');
  };

  const generateTPIN = () => {
    if (!formData.name || !formData.mobile || !formData.email || !formData.password) {
      toast.error('Please fill name, mobile and email first');
      return;
    } 
    const tpin = Math.floor(1000 + Math.random() * 9000).toString();
    setFormData({ ...formData, tpin });
    toast.success('4-digit TPIN generated!');
  };

  const clearReferral = () => {
    setFormData({ ...formData, referredBy: '' });
    setReferralName(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
          <div className="bg-blue-100 p-3 rounded-full">
            <UserPlus className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Registration</h1>
            <p className="text-gray-600">Register new customers for {storeLocation}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Registration Form */}
          <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="p-6 pb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Details
              </h2>
            </div>

            <div className="p-6 pt-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      placeholder="Enter customer name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Mobile Field */}
                <div className="space-y-2">
                  <label htmlFor="mobile" className="block text-sm font-medium text-gray-700">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="mobile"
                      type="tel"
                      placeholder="Enter 10-digit number"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter email address"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      disabled={!formData.name || !formData.mobile || !formData.email}
                      className={`text-xs px-2 py-1 rounded ${
                        !formData.name || !formData.mobile || !formData.email
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      Generate Password
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-10 pr-10 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* TPIN Field */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="tpin" className="block text-sm font-medium text-gray-700">
                      TPIN (4 digits) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateTPIN}
                      disabled={!formData.name || !formData.mobile || !formData.email || !formData.password}
                      className={`text-xs px-2 py-1 rounded ${
                        !formData.name || !formData.mobile || !formData.email || !formData.password
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      Generate TPIN
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="tpin"
                      type="password"
                      placeholder="Enter 4-digit TPIN"
                      value={formData.tpin}
                      onChange={(e) => setFormData({ ...formData, tpin: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                {/* Referral Field */}
                <div className="space-y-2">
                  <label htmlFor="referredBy" className="block text-sm font-medium text-gray-700">
                    Referred By Mobile (Optional)
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      id="referredBy"
                      type="tel"
                      placeholder="Enter referrer's mobile number"
                      value={formData.referredBy}
                      onChange={(e) => {
                        if(formData.referredBy.length == 10){
                          setIsReferralEntered(true);
                        }
                        setFormData({ ...formData, referredBy: e.target.value })}}
                      className="w-full pl-10 pr-10 py-2 h-12 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={10}
                    />
                    {formData.referredBy && (
                      <button
                        type="button"
                        onClick={clearReferral}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {isFetchingReferral && formData.referredBy.length === 10 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking referral...</span>
                    </div>
                  )}
                  {referralName && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Referral: {referralName}</span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !isAuthReady || (!isElgibleForReferral && formData.referredBy.length > 0)}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-medium rounded-lg transition-all duration-200 shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                        <span>Registering...</span>
                      </>
                    ) : (
                      'Register Customer'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
            <div className="p-6 pb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Registration Benefits
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                What customers get when they register
              </p>
            </div>

            <div className="p-6 pt-0 space-y-4">
              {/* Wallet Benefit */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="bg-blue-100 p-2 rounded-full mt-1 flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900">Digital Wallet</h3>
                  <p className="text-sm text-blue-700">Secure storage for your money with 1:1 value</p>
                </div>
              </div>

              {/* Coins Benefit */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="bg-amber-100 p-2 rounded-full mt-1 flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-medium text-amber-900">Reward Coins</h3>
                  <p className="text-sm text-amber-700">Earn Surabhi coins on every wallet recharge</p>
                </div>
              </div>

              {/* Referral Benefit */}
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="bg-green-100 p-2 rounded-full mt-1 flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900">Referral Program</h3>
                  <p className="text-sm text-green-700">Earn bonus when you refer friends</p>
                </div>
              </div>

              {/* Seva Benefit */}
              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="bg-purple-100 p-2 rounded-full mt-1 flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-purple-900">Community Support</h3>
                  <p className="text-sm text-purple-700">Fraction of a recharges support community welfare</p>
                </div>
              </div>

              {/* Important Notes */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">Important Notes:</h3>
                <ul className="text-sm text-gray-700 space-y-1.5 pl-4 list-disc">
                  <li>Email is required for account recovery</li>
                  <li>Mobile number must be verified for transactions</li>
                  <li>Each customer gets a unique Wallet ID</li>
                  <li>Initial coins balance will be zero</li>
                  <li>Referrals must be existing customers</li>
                  <li>Password must be at least 6 characters</li>
                  <li>TPIN is required for secure transactions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};