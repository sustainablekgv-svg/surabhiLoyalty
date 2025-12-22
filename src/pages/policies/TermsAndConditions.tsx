
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-6">Terms and Conditions</h1>
        <div className="prose max-w-none text-gray-700 space-y-4">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.</p>

          <h2 className="text-xl font-semibold">2. Use License</h2>
          <p>Permission is granted to temporarily download one copy of the materials (information or software) on Surabhi Loyalty's website for personal, non-commercial transitory viewing only.</p>

          <h2 className="text-xl font-semibold">3. Disclaimer</h2>
          <p>The materials on Surabhi Loyalty's website are provided on an 'as is' basis. Surabhi Loyalty makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

          <h2 className="text-xl font-semibold">4. Limitations</h2>
          <p>In no event shall Surabhi Loyalty or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Surabhi Loyalty's website.</p>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
