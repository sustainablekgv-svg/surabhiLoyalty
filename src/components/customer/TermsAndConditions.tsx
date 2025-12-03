import { FileText } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const TermsAndConditions = () => {
  return (
    <Card className="shadow-lg border-0 bg-white">
      <CardHeader className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 sm:py-6">
        <CardTitle className="flex items-center gap-2 text-lg xs:text-xl sm:text-2xl font-bold text-gray-900">
          <FileText className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 text-blue-600" />
          Terms and Conditions (T & C)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 xs:px-4 sm:px-6 pb-4 xs:pb-5 sm:pb-6 pt-0">
        <div className="space-y-4 xs:space-y-5 sm:space-y-6">
          <div className="space-y-3 xs:space-y-4">
            {/* <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                1
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                Each recharge transaction must have a minimum value of ₹2,000
              </p>
            </div> */}

            {/* <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                2
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                Wallet recharge and redemption are only available at your registered store location.
              </p>
            </div> */}

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                1
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                You may refer others only if you have purchased aleast ₹ 999. For students, the product purchase requirement is reduced to ₹500.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                2
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                Coins can be redeemed from the quarter of joining without any target. From the
                following quarter onwards, coins will remain frozen until the cumulative purchase
                target is achieved, with ₹2,000 added to the target value each quarter.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                3
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                The company reserves the right to utilize Seva Coins, in full or in part, for social
                or charitable causes at its discretion.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                4
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                The company reserves the right to modify the Surabhi Loyalty Program at its
                discretion.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                5
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                Misuse of the program or violation of these terms may result in suspension of membership.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5">
                6
              </span>
              <p className="text-sm xs:text-base text-gray-700 leading-relaxed">
                Decisions made by the company regarding eligibility, redemption, or disputes shall
                be final and binding.
              </p>
            </div>
          </div>

          <div className="mt-6 xs:mt-7 sm:mt-8 p-3 xs:p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs xs:text-sm text-amber-800 font-medium">
              <strong>Note:</strong> These terms and conditions are subject to change. Please review
              them periodically for updates.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
