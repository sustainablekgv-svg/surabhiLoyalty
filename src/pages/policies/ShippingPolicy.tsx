
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShippingPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-6">Shipping & Delivery Policy</h1>
        <div className="prose max-w-none text-gray-700 space-y-4">
          
          <h2 className="text-xl font-semibold">1. Processing Time</h2>
          <p>All orders are processed within 1-2 business days. Orders are not shipped or delivered on weekends or holidays.</p>

          <h2 className="text-xl font-semibold">2. Shipping Rates & Delivery Estimates</h2>
          <p>Shipping charges for your order will be calculated and displayed at checkout.</p>
          <ul className="list-disc pl-5">
              <li>Standard Shipping: 3-5 business days</li>
          </ul>

          <h2 className="text-xl font-semibold">3. Shipment Confirmation & Order Tracking</h2>
          <p>You can track your order status in the "My Orders" section of your dashboard. We will also update the status as "In Transit" when the order is shipped.</p>

          <h2 className="text-xl font-semibold">4. Damages</h2>
          <p>Incase if you receive damaged goods, contact the customer care.</p>
        </div>
      </div>
    </div>
  );
};

export default ShippingPolicy;
