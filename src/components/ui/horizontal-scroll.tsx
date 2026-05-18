import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';

interface HorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({ 
  children, 
  className,
  itemClassName 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    // Small delay to ensure layout has settled
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={cn("relative group", className)}>
      {showLeftArrow && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center bg-gradient-to-r from-background/80 via-background/20 to-transparent pr-8 pointer-events-none">
            <Button
                variant="outline"
                size="icon"
                className="rounded-full shadow-lg bg-background/90 border-border h-10 w-10 hover:bg-accent transition-all pointer-events-auto ml-1 border"
                onClick={() => scroll('left')}
            >
                <ChevronLeft className="h-6 w-6 text-primary" />
            </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn(
          "overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth px-4",
          itemClassName || "flex gap-4"
        )}
      >
        {children}
      </div>

      {showRightArrow && (
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center bg-gradient-to-l from-background/80 via-background/20 to-transparent pl-8 pointer-events-none">
            <Button
                variant="outline"
                size="icon"
                className="rounded-full shadow-lg bg-background/90 border-border h-10 w-10 hover:bg-accent transition-all pointer-events-auto mr-1 border"
                onClick={() => scroll('right')}
            >
                <ChevronRight className="h-6 w-6 text-primary" />
            </Button>
        </div>
      )}
    </div>
  );
};
