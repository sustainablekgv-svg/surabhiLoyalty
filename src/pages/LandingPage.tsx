import {
  ArrowRight,
  CheckCircle,
  Coins,
  Gift,
  Heart,
  LogIn,
  Phone,
  Shield,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  const features = [
    {
      icon: Coins,
      title: 'Surabhi Coins',
      description:
        'Earn coins on every purchase and recharge. Build your wealth with every transaction.',
      color: 'from-purple-600 to-purple-700',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
    },
    {
      icon: Users,
      title: 'Referral Rewards',
      description:
        'Invite friends and family to earn bonus coins. Grow your network, grow your rewards.',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-600',
    },
    {
      icon: Heart,
      title: 'Seva Pool',
      description:
        'Contribute to community welfare and earn special recognition for your social impact.',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-100',
      textColor: 'text-red-600',
    },
    {
      icon: Wallet,
      title: 'Digital Wallet',
      description:
        'Secure digital wallet for all your transactions. Easy recharge, instant payments.',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      icon: TrendingUp,
      title: 'Quarterly Targets',
      description: 'Achieve quarterly goals to unlock exclusive benefits and premium rewards.',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      icon: Gift,
      title: 'Exclusive Benefits',
      description:
        'Access special discounts, early sales, and member-only offers throughout the year.',
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-600',
    },
  ];

  const benefits = [
    'Earn coins on every purchase',
    'Get referral bonuses',
    'Access exclusive discounts',
    'Contribute to community welfare',
    'Track your spending and savings',
    'Secure digital transactions',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1.5 sm:p-2 rounded-lg">
                <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Surabhi Loyalty</h1>
                <p className="text-xs sm:text-sm text-gray-600">Retail Business Platform</p>
              </div>
            </div>
            <Button
              onClick={handleLoginClick}
              className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-amber-100 px-4 py-2 rounded-full text-sm font-medium text-purple-700 mb-4">
              <Star className="h-4 w-4" />
              Welcome to Surabhi Loyalty Program
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
            Join our loyalty program and start earning Surabhi Coins, refer friends for bonuses, and
            contribute to community welfare while shopping.
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
            Why Choose Surabhi Loyalty?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience a comprehensive loyalty program designed to reward your purchases and build
            community connections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-amber-500 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Earning?</h2>
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
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
                  <Coins className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Surabhi Loyalty</h3>
                  <p className="text-sm text-gray-400">Retail Business Platform</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Building stronger communities through rewarding customer relationships and social
                impact initiatives.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contact Information</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a href="tel:9606979530" className="hover:text-white transition-colors">
                    9606979530
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Secure & Trusted Platform</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Program Features</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Surabhi Coins Rewards</li>
                <li>• Referral System</li>
                <li>• Seva Pool Contributions</li>
                <li>• Digital Wallet</li>
                <li>• Quarterly Targets</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} Surabhi Loyalty Program. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
