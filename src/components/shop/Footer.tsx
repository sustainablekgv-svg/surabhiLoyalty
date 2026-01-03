
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Surabhi Loyalty League</h3>
            <p className="text-sm text-muted-foreground">
              Connecting Local Businesses with Local Communities
            </p>
          </div>
          
          <div className="space-y-3">
            <h3 className="tex-sm font-medium">Customer Service</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact-us" className="hover:text-foreground">Contact Us</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-foreground">Shipping Policy</Link></li>
              <li><Link to="/cancellation-refund" className="hover:text-foreground">Returns & Refunds</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
             <h3 className="tex-sm font-medium">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link to="/terms-conditions" className="hover:text-foreground">Terms & Conditions</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="tex-sm font-medium">Connect</h3>
            <p className="text-sm text-muted-foreground">
              Follow us on social media for updates and offers.
            </p>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Surabhi Loyalty. All rights reserved.
        </div>
      </div>
    </footer>
  );
};
