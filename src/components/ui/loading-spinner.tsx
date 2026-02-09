import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: number;
}

export const LoadingSpinner = ({ className, size = 24, ...props }: LoadingSpinnerProps) => {
    return (
        <div className={cn("flex justify-center items-center w-full py-4", className)} {...props}>
            <Loader2 className="animate-spin text-primary" size={size} />
        </div>
    );
};

export const PageLoader = () => {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <LoadingSpinner size={48} />
                <p className="text-sm text-gray-500 font-medium animate-pulse">Loading...</p>
            </div>
        </div>
    );
};
