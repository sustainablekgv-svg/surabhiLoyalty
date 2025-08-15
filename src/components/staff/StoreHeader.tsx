import { Coins, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';

import { StoreSettings } from './StoreSettings';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaffHeaderProps } from '@/types/types';

export const StoreHeader = ({ user, onLogout }: StaffHeaderProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="bg-white shadow-sm border-b w-full">
      <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-2 xs:py-3 sm:py-4">
        <div className="flex flex-col xs:flex-row items-center justify-between gap-2 xs:gap-3 sm:gap-0">
          {/* Logo/Brand Section */}
          <div className="flex items-center gap-1 xs:gap-2 sm:gap-4 w-full xs:w-auto justify-between xs:justify-start">
            <div className="flex items-center gap-1 xs:gap-2 sm:gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-1 xs:p-1.5 sm:p-2 rounded-lg">
                <Coins className="h-4 xs:h-5 sm:h-6 w-4 xs:w-5 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">
                  Loyalty Rewards
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 hidden xs:block">Store Portal</p>
              </div>
            </div>

            {/* Mobile buttons */}
            <div className="flex xs:hidden items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 p-1.5 xs:p-2"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 xs:p-2"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* User Info Section */}
          <div className="flex items-center gap-1 xs:gap-2 sm:gap-4 w-full xs:w-auto justify-end">
            <div className="flex items-center gap-1 xs:gap-2 sm:gap-3">
              <div className="text-right hidden xs:block">
                <p className="text-xs xs:text-sm font-medium text-gray-900 truncate max-w-[100px] sm:max-w-[120px] md:max-w-[180px]">
                  {user.name || 'Store Member'}
                </p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Badge
                    variant="secondary"
                    className="text-[10px] xs:text-xs py-0 xs:py-0.5 h-4 xs:h-5"
                  >
                    {user.role.toUpperCase() === 'STAFF' ? 'STORE' : 'CUSTOMER'}
                  </Badge>
                  <span className="text-[10px] xs:text-xs text-gray-600 hidden md:inline">
                    {user.mobile}
                  </span>
                </div>
              </div>

              {/* Desktop buttons */}
              <div className="hidden xs:flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-7 xs:h-8 sm:h-9 text-xs sm:text-sm px-2 xs:px-2.5 sm:px-3"
                >
                  <Settings className="h-3.5 xs:h-4 w-3.5 xs:w-4" />
                  <span className="ml-1 xs:ml-1.5 sm:ml-2 hidden md:inline text-xs sm:text-sm">
                    Settings
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 xs:h-8 sm:h-9 text-xs sm:text-sm px-2 xs:px-2.5 sm:px-3"
                >
                  <LogOut className="h-3.5 xs:h-4 w-3.5 xs:w-4" />
                  <span className="ml-1 xs:ml-1.5 sm:ml-2 hidden md:inline text-xs sm:text-sm">
                    Logout
                  </span>
                </Button>
              </div>

              {/* Mobile user info (collapsed) */}
              <div className="xs:hidden flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                  {user.role.toUpperCase()}
                </Badge>
                <span className="text-[10px] text-gray-600 truncate max-w-[60px]">
                  {user.name?.split(' ')[0] || 'Store'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Settings Dialog */}
      <StoreSettings user={user} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
};
