import { useAuth } from '@/hooks/auth-context';
import {
  ArrowRight,
  CheckCircle,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Phone,
  ShoppingBag,
  Star,
  Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { FloatingWhatsApp } from '@/components/shop/FloatingWhatsApp';
import { Footer } from '@/components/shop/Footer';
import { ProductCard } from '@/components/shop/ProductCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFeaturedProducts } from '@/services/shop';
import { Product } from '@/types/shop';

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout, isAuthenticated } = useAuth();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin/dashboard';
      case 'staff': return '/staff/dashboard';
      case 'customer': return '/customer/dashboard';
      default: return '/customer/dashboard';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      navigate(`/signup?ref=${ref}`);
    }

    const fetchFeatured = async () => {
        try {
            const products = await getFeaturedProducts();
            setFeaturedProducts(products);
        } catch (error) {
            console.error("Error fetching featured products", error);
        } finally {
            setLoading(false);
        }
    };
    fetchFeatured();
  }, [searchParams, navigate]);

  const handleLoginClick = () => {
    navigate('/login', { state: { from: location } });
  };

  const features = [

    {
      icon: Users,
      title: 'Surabhi Coins',
      description:
        'Earn Surabhi Coins on every amount spent - by you and your referrals! Redeem your coins easily on your next purchase - 1 Coin = ₹1.',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-600',
    },
    {
      icon: Heart,
      title: 'Seva Coins - Shop with Purpose',
      description:
        'Each Seva Coin represents your contribution - every coin equals one rupee given back to the community',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
    },
  ];

  const benefits = [
    'Shop and redeem at all registered partner stores',
    'No expiry on your Surabhi Coins - use them anytime!',
    'Access top-quality products & services',
    'One-time registration, lifetime rewards',
    'Easy tracking of coins & referrals',
    'Be part of a community that gives back - earn Seva Coins and support social causes',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1.5 sm:p-2 rounded-lg">
                <img src="/kgv.png" alt="Sustainable KGV" className="h-8 sm:h-10" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Sustainable KGV</h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Connecting Krishi Goraksya Vanijyam
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/shop')}
                className="font-medium text-gray-700 hover:text-purple-600 transition-colors hidden sm:flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop Now
              </Button>
              
              {isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(getDashboardPath())}
                    className="font-medium text-gray-700 hover:text-purple-600 transition-colors hidden sm:flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleLoginClick}
                  className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Login</span>
                </Button>
              )}
            </div>
        </div>
      </div>
    </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-amber-100 px-4 py-2 rounded-full text-sm font-medium text-purple-700 mb-4">
              <Star className="h-4 w-4" />
              Welcome to SLL -  Surabhi Loyalty League
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Earn{' '}
            <span className="bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
              Rewards
            </span>{' '}
            With Every Rupee Spent
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join our Loyalty Program and start earning Surabhi Coins for every purchase - by you and
            your referrals! Also earn Seva Coins when you shop and contribute to community welfare
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <Button
                onClick={() => navigate(getDashboardPath())}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg shadow-lg hover:shadow-xl"
              >
                Go to Dashboard
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                onClick={handleLoginClick}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}

            <Button
              onClick={() => navigate('/shop')}
              size="lg"
              variant="outline"
              className="border-2 hover:bg-purple-50 text-purple-700 font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg"
            >
              <ShoppingBag className="h-5 w-5" />
              Shop Now
            </Button>

            {isAuthenticated && (
              <Button
                onClick={handleLogout}
                size="lg"
                variant="ghost"
                className="text-gray-500 hover:text-red-600 font-medium px-6 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </Button>
            )}

            {!isAuthenticated && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                <span className="text-sm">Need help? Call 9606979530</span>
              </div>
            )}
          </div>
        </div>
      </section>



      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Why Choose Sustainable KGV?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience a comprehensive loyalty program designed to empower local businesses and
            build stronger communities - together
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 group"
            >
              <CardHeader className="text-center pb-4">
                <div
                  className={`${feature.bgColor} p-4 rounded-full w-fit mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`h-8 w-8 ${feature.textColor}`} />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 text-center leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white/60 backdrop-blur-sm py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Member Benefits</h2>
              <p className="text-lg text-gray-600">
                Unlock exclusive advantages when you join our loyalty program
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm"
                >
                  <div className="bg-green-100 p-2 rounded-full flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="text-gray-700 font-medium">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Coins Image and Milestones */}
            <div className="flex flex-col items-center mt-12 space-y-8">
              <div className="relative w-full max-w-sm mx-auto rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <img
                  src="/coins.jpeg"
                  alt="Surabhi Coins and Seva Coins"
                  className="w-full h-auto object-cover"
                />
              </div>

              <div className="max-w-4xl mx-auto text-center space-y-8 bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-purple-100">
                <div className="space-y-4">
                  <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-700 to-amber-600 bg-clip-text text-transparent">
                    The 7 Milestones of SLL – Surabhi Loyalty League
                  </h3>
                  <p className="text-gray-600 italic">
                    ✨ These 7 milestones are inspired by the Saptagiri — the sacred 7 Hills of Tirumala, symbolising spiritual ascent and commitment.
                  </p>
                </div>

                <div className="space-y-6">
                  <h4 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
                    <span className="text-2xl">🏔️</span> 
                    SLL Milestones (Lifetime Surabhi Coins)
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
                    {[
                      { name: 'Seshadrian', coins: '5,001' },
                      { name: 'Neeladrian', coins: '10,001' },
                      { name: 'Garudadrian', coins: '20,001' },
                      { name: 'Anjanadrian', coins: '40,001' },
                      { name: 'Vrushabadrian', coins: '60,001' },
                      { name: 'Narayanadrian', coins: '80,001' },
                      { name: 'Venkatadrian', coins: '1,00,001' },
                    ].map((milestone, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-purple-100 flex items-center justify-between hover:scale-105 transition-transform">
                        <span className="font-semibold text-purple-700">{milestone.name}</span>
                        <span className="font-bold text-amber-600">{milestone.coins} Coins</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-gray-700 font-medium pt-4 flex items-center justify-center gap-2">
                    <span className="text-2xl">🙏</span>
                    Each milestone reflects progress, dedication, and seva — just as one ascends the sacred hills to seek the darshan of the Lord.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Vertical Scroll Section */}
      {!loading && featuredProducts.length > 0 && (
          <section className="container mx-auto px-4 py-16 border-t border-purple-100">
              <div className="flex flex-col gap-8 mx-auto w-full max-w-7xl">
                  <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Featured Products</h2>
                      <p className="text-gray-600">Handpicked premium products just for you</p>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-50/20 via-transparent to-amber-50/20 p-4 border border-purple-50 shadow-inner group">
                      {/* Fade masks for smooth scroll effect */}
                      <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-white/90 to-transparent z-10 pointer-events-none" />
                      
                      <div className="animate-marquee-horizontal flex flex-row gap-6 w-max">
                          {/* Original Set */}
                          {featuredProducts.map(product => (
                              <div key={`orig-${product.id}`} className="flex-shrink-0 w-[280px]">
                                  <ProductCard product={product} />
                              </div>
                          ))}
                          {/* Duplicated Set for Seamless Infinite Loop */}
                          {featuredProducts.map(product => (
                              <div key={`dup-${product.id}`} className="flex-shrink-0 w-[280px] pointer-events-none">
                                  <ProductCard product={product} />
                              </div>
                          ))}
                      </div>

                      <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-white/90 to-transparent z-10 pointer-events-none" />
                  </div>

                  <div className="text-center">
                    <Button 
                        size="lg"
                        onClick={() => navigate('/shop')}
                        className="bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800 font-bold px-8 shadow-sm transition-all"
                    >
                        View All Featured Products →
                    </Button>
                  </div>
              </div>
          </section>
      )}

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-amber-500 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {isAuthenticated ? 'Continue your journey' : 'Ready to start the journey?'}
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of satisfied customers who are already earning rewards with every purchase.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button
              onClick={() => navigate(isAuthenticated ? getDashboardPath() : '/login')}
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-50 font-black px-10 py-5 rounded-2xl transition-all duration-300 flex items-center gap-3 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              {isAuthenticated ? (
                <>
                  <LayoutDashboard className="h-6 w-6 text-purple-600" />
                  Go to Dashboard
                </>
              ) : (
                <>
                  <LogIn className="h-6 w-6 text-purple-600" />
                  Start the Journey
                </>
              )}
            </Button>
            
            <Button
              onClick={() => navigate('/shop')}
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-50 font-black px-10 py-5 rounded-2xl transition-all duration-300 flex items-center gap-3 text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
                <ShoppingBag className="h-6 w-6 text-purple-600" />
                Shop Now
            </Button>

            {isAuthenticated && (
              <Button
                onClick={handleLogout}
                size="lg"
                variant="outline"
                className="bg-slate-900/40 text-white border-2 border-white/40 hover:bg-slate-900/60 hover:border-white/60 font-black px-10 py-5 rounded-2xl transition-all duration-300 flex items-center gap-3 text-lg backdrop-blur-md shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                <LogOut className="h-6 w-6 text-amber-400" />
                Logout Now
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};

export default LandingPage;
