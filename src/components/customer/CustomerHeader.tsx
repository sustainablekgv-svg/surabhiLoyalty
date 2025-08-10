import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  LogOut, 
  User,
} from 'lucide-react';

interface CustomerHeaderProps {
  user: {
    name?: string;
    mobile: string;
    role: string;
  };
  onLogout: () => void;
}

export const CustomerHeader = ({ user, onLogout }: CustomerHeaderProps) => {
  return (
    <div className="bg-white shadow-sm border-b w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          {/* Logo/Brand Section */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1.5 sm:p-2 rounded-lg">
                <Coins className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Loyalty Rewards</h1>
                <p className="text-xs sm:text-sm text-gray-600">My Account</p>
              </div>
            </div>
            
            {/* Mobile logout button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="sm:hidden text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          
          {/* User Info Section */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-center sm:text-right">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] sm:max-w-full">
                  {user.name || 'Customer'}
                </p>
                <div className="flex items-center justify-center sm:justify-end gap-1 sm:gap-2">
                  <Badge variant="default" className="text-[10px] sm:text-xs bg-gradient-to-r from-purple-600 to-amber-500">
                    MEMBER
                  </Badge>
                  <span className="text-[10px] sm:text-xs text-gray-600 hidden sm:inline">{user.mobile}</span>
                </div>
              </div>
              
              {/* Desktop logout button */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                className="hidden sm:flex text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
