import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { Megaphone } from 'lucide-react';

export const PauseAnnouncement = () => {
    const { settings } = useGlobalSettings();

    if (!settings.pauseOrders) return null;

    return (
        <div className="relative w-full bg-amber-600 text-white overflow-hidden py-2 shadow-md">
            <div className="flex whitespace-nowrap animate-marquee">
                <div className="flex items-center gap-4 px-4">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-wider">
                        {settings.pauseMessage || 'Orders are temporarily paused. We will be back soon!'}
                    </span>
                </div>
                <div className="flex items-center gap-4 px-4">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-wider">
                        {settings.pauseMessage || 'Orders are temporarily paused. We will be back soon!'}
                    </span>
                </div>
                 <div className="flex items-center gap-4 px-4">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-wider">
                        {settings.pauseMessage || 'Orders are temporarily paused. We will be back soon!'}
                    </span>
                </div>
                <div className="flex items-center gap-4 px-4">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-bold uppercase tracking-wider">
                        {settings.pauseMessage || 'Orders are temporarily paused. We will be back soon!'}
                    </span>
                </div>
            </div>
        </div>
    );
};
