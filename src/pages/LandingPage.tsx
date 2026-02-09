import {
    ArrowRight,
    CheckCircle,
    Heart,
    LogIn,
    Phone,
    ShoppingBag,
    Star,
    Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Footer } from '@/components/shop/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
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
              <Button
              onClick={handleLoginClick}
              className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
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
            with Every Purchase
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join our Loyalty Program and start earning Surabhi Coins for every purchase - by you and
            your referrals! Also earn Seva Coins when you shop and contribute to community welfare
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleLoginClick}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg"
            >
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Button>

            <Button
              onClick={() => navigate('/shop')}
              size="lg"
              variant="outline"
              className="border-2 hover:bg-purple-50 text-purple-700 font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-lg"
            >
              <ShoppingBag className="h-5 w-5" />
              Shop Now
            </Button>

            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Need help? Call 9606979530</span>
            </div>
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

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-amber-500 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to start the journey?</h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of satisfied customers who are already earning rewards with every
            purchase.
          </p>
          <Button
            onClick={handleLoginClick}
            size="lg"
            variant="secondary"
            className="bg-white text-purple-600 hover:bg-gray-100 font-medium px-8 py-4 rounded-lg transition-all duration-200 flex items-center gap-2 mx-auto text-lg"
          >
            <LogIn className="h-5 w-5" />
            Login to Your Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
