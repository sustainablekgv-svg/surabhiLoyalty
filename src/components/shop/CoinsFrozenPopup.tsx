import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  spent: number;
  target: number;
}

export const CoinsFrozenPopup = ({ open, onClose, spent, target }: Props) => {
  if (!open) return null;

  const remaining = Math.max(target - spent, 0);
  const progress = target > 0 ? Math.min((spent / target) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-orange-600">
              🔒 Your Surabhi Coins are Frozen
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Your lifetime spend hasn’t reached the target yet.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Lifetime Spent</p>
            <p className="text-lg font-bold text-gray-800">
              ₹{spent.toLocaleString()}
            </p>
          </div>

          <div className="border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Lifetime Target</p>
            <p className="text-lg font-bold text-gray-800">
              ₹{target.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>

          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-yellow-800">
            🛍 Shop ₹{remaining.toLocaleString()} more to unlock your coins
          </p>
          <p className="text-yellow-700 mt-1">
            Your earned coins will unlock automatically once you reach your target.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>

          <Button
            onClick={() => {
              onClose();
              window.location.href = '/shop';
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Shop Now
          </Button>
        </div>
      </div>
    </div>
  );
};