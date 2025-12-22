
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CancellationRefund = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Button>
        <h1 className="text-3xl font-bold mb-6">Cancellation & Refund Policy</h1>
        <div className="prose max-w-none text-gray-700 space-y-4">
          
          <h2 className="text-xl font-semibold">1. Cancellation Policy</h2>
          <p>Customers can cancel their order at any time before the order has been processed by the admin (Status: Received). Once the order is confirmed or shipped, cancellations may not be allowed via the dashboard.</p>
          <p>To cancel an order, navigate to "My Orders", view the order details, and click "Cancel Order" if available.</p>
          
          <h2 className="text-xl font-semibold">2. Refund Policy</h2>
          <p>Refunds will be processed under the following/below mentioned circumstances:</p>
          <ul className="list-disc pl-5">
            <li>Order is cancelled before processing.</li>
            <li>Product received is damaged or defective.</li>
            <li>Incorrect product received.</li>
          </ul>

          <h2 className="text-xl font-semibold">3. Refund Timeline</h2>
          <p>Refunds will be processed within 5-7 business days of approval. The amount will be credited back to the original source of payment.</p>

          <h2 className="text-xl font-semibold">4. Contact Used</h2>
          <p>For any cancellation or refund related queries, please contact our support team.</p>
        </div>
      </div>
    </div>
  );
};

export default CancellationRefund;
