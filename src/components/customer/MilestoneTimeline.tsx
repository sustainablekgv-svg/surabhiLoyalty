import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// 🖼️ Import icons
import seshadrianIcon from '@/assets/milestones/seshadrian.png';
import neeladrianIcon from '@/assets/milestones/neeladrian.png';
import garudadrianIcon from '@/assets/milestones/garudadrian.png';
import anjanadrianIcon from '@/assets/milestones/anjanadrian.png';
import vrushabadrianIcon from '@/assets/milestones/vrushabadrian.png';
import narayanadrianIcon from '@/assets/milestones/narayanadrian.png';
import venkatadrianIcon from '@/assets/milestones/venkatadrian.png';

interface Props {
  amount: number;
}

const milestones = [
  { name: 'Seshadrian', value: 5001, icon: seshadrianIcon },
  { name: 'Neeladrian', value: 10001, icon: neeladrianIcon },
  { name: 'Garudadrian', value: 20001, icon: garudadrianIcon },
  { name: 'Anjanadrian', value: 40001, icon: anjanadrianIcon },
  { name: 'Vrushabadrian', value: 60001, icon: vrushabadrianIcon },
  { name: 'Narayanadrian', value: 80001, icon: narayanadrianIcon },
  { name: 'Venkatadrian', value: 100001, icon: venkatadrianIcon },
];

export const MilestoneTimeline = ({ amount }: Props) => {
  const coins = amount || 0;

  const maxValue = milestones[milestones.length - 1].value;
  const progress = Math.min((coins / maxValue) * 100, 100);

  const getStatus = (value: number, index: number) => {
    if (coins >= value) return 'completed';

    const prev = milestones[index - 1]?.value || 0;
    if (coins >= prev && coins < value) return 'active';

    return 'locked';
  };

  const nextMilestone = milestones.find(m => coins < m.value);

  return (
    <Card className="shadow-lg border-0 bg-white">

      <CardContent className="space-y-4">

  {/* TITLE */}
  <div className="text-center text-sm sm:text-base font-semibold text-gray-800">
    🏔️ Surabhi Milestones
  </div>

  {/* COINS */}
  <div className="flex items-center justify-center gap-2">

    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-100">
      🪙
    </div>

    <div className="text-lg sm:text-xl font-bold text-gray-800">
      Current Coins:{" "}
      <span className="text-purple-600">
        {coins.toLocaleString()}
      </span>
    </div>

  </div>

        {/* Progress */}
       {/* 🔥 CUSTOM PROGRESS BAR */}
<div className="space-y-2">

  {/* Percentage Label */}
  <div className="flex justify-start">
    <div className="px-3 py-1 text-[10px] sm:text-xs font-semibold text-white rounded-full bg-gradient-to-r from-purple-500 to-orange-400 shadow">
      {progress.toFixed(1)}% Progress
    </div>
  </div>

  {/* Progress Track */}
  <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">

    {/* Gradient Fill */}
    <div
      className="h-full bg-gradient-to-r from-purple-500 to-orange-400 transition-all duration-500"
      style={{ width: `${progress}%` }}
    />

    {/* Moving Indicator */}
    <div
      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-4 border-orange-400 rounded-full shadow-md transition-all duration-500"
      style={{ left: `calc(${progress}% - 10px)` }}
    />
  </div>
</div>

        {/* Milestones */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {milestones.map((m, i) => {
            const status = getStatus(m.value, i);

            return (
              <div
                key={m.name}
                className={`p-2 rounded-lg border text-center text-[10px] sm:text-xs transition-all
                  ${
                    status === 'completed'
                      ? 'bg-purple-100 border-purple-400'
                      : status === 'active'
                      ? 'bg-amber-100 border-amber-400 shadow-md scale-105'
                      : 'bg-gray-100 border-gray-300 opacity-60'
                  }`}
              >

                {/* 🔥 ICON DISPLAY */}
                <div className="flex justify-center mb-2">
  <div className="w-20 h-20 rounded-full overflow-hidden border bg-white">
    <img
      src={m.icon}
      alt={m.name}
      className="w-full h-full object-contain scale-110"
    />
  </div>
</div>

                <div className="font-semibold">{m.name}</div>

                <div className="text-gray-600">
                  ₹{m.value.toLocaleString()}
                </div>

                {status === 'completed' && (
                  <Badge className="mt-1 text-[9px]">Completed</Badge>
                )}

                {status === 'active' && (
                  <Badge variant="secondary" className="mt-1 text-[9px]">
                    Current
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};