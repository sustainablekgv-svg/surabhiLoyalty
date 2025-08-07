import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, LogOut } from 'lucide-react';
import { StaffHeaderProps } from '@/types/types';

export const StaffHeader = ({ user, onLogout }: StaffHeaderProps) => {
  return (
    <div className="bg-white shadow-sm border-b w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          {/* Logo/Brand Section */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1 sm:p-2 rounded-lg">
                <Coins className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Loyalty Rewards</h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Staff Portal</p>
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
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] md:max-w-[180px]">
                  {user.name || 'Staff Member'}
                </p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {user.role.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-600 hidden md:inline">
                    {user.mobile}
                  </span>
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
                <span className="ml-2 hidden md:inline">Logout</span>
              </Button>
              
              {/* Mobile user info (collapsed) */}
              <div className="sm:hidden flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {user.role.toUpperCase()}
                </Badge>
                <span className="text-xs text-gray-600 truncate max-w-[80px]">
                  {user.name?.split(' ')[0] || 'Staff'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};