
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <div className="prose max-w-none text-gray-700 space-y-4">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-semibold">1. Introduction</h2>
          <p>Welcome to Surabhi Loyalty. We respect your privacy and are committed to protecting your personal data.</p>

          <h2 className="text-xl font-semibold">2. Data We Collect</h2>
          <p>We may collect personal identification information from Users in a variety of ways, including, but not limited to, when Users visit our site, register on the site, place an order, and in connection with other activities, services, features or resources we make available on our Site.</p>

          <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
          <p>We collect and use Users personal information for the following purposes:</p>
          <ul className="list-disc pl-5">
            <li>To improve customer service</li>
            <li>To personalize user experience</li>
            <li>To process payments</li>
            <li>To send periodic emails</li>
          </ul>

          <h2 className="text-xl font-semibold">4. Data Protection</h2>
          <p>We adopt appropriate data collection, storage and processing practices and security measures to protect against unauthorized access, alteration, disclosure or destruction of your personal information.</p>

          <h2 className="text-xl font-semibold">5. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
