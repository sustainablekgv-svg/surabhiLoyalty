import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  LogOut,
} from 'lucide-react';

import { StaffHeaderProps } from '@/types/types';
export const StaffHeader = ({ user, onLogout }: StaffHeaderProps) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-600 to-amber-500 p-2 rounded-lg">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Loyalty Rewards</h1>
              <p className="text-sm text-gray-600">Staff Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                1
              </span>
            </Button> */}

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.name || 'Staff Member'}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {user.role.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-600">{user.mobile}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
