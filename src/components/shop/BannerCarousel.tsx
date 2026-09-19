import React, { useEffect, useCallback, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Banner } from '@/types/shop';
import { getActiveBanners } from '@/services/banner';

export const BannerCarousel = () => {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const fetchedBanners = await getActiveBanners();
                setBanners(fetchedBanners);
            } catch (error) {
                console.error("Error fetching banners:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBanners();
    }, []);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi, setSelectedIndex]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect);
        emblaApi.on('reInit', onSelect);
        
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    // Autoplay logic
    useEffect(() => {
        if (!emblaApi || banners.length <= 1) return;
        
        const autoplay = setInterval(() => {
            if (emblaApi.canScrollNext()) {
                emblaApi.scrollNext();
            } else {
                emblaApi.scrollTo(0);
            }
        }, 5000);

        return () => clearInterval(autoplay);
    }, [emblaApi, banners.length]);

    if (loading) {
        return (
            <div className="w-full h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px] bg-gray-100 animate-pulse flex items-center justify-center">
                <span className="text-gray-400">Loading banners...</span>
            </div>
        );
    }

    if (banners.length === 0) {
        return null;
    }

    return (
        <div className="overflow-hidden w-full relative group bg-gray-100" ref={emblaRef}>
            <div className="flex w-full h-[200px] sm:h-[250px] md:h-[300px] lg:h-[350px]">
                {banners.map((banner) => (
                    <div className="flex-[0_0_100%] min-w-0 h-full relative flex items-center justify-center" key={banner.id}>
                        {banner.linkUrl ? (
                            <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                <img 
                                    src={banner.imageUrl} 
                                    alt="Banner" 
                                    className="w-full h-full object-contain" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/kgv.png'; // Fallback
                                    }}
                                />
                            </a>
                        ) : (
                            <img 
                                src={banner.imageUrl} 
                                alt="Banner" 
                                className="w-full h-full object-contain" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/kgv.png'; // Fallback
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>
            
            {/* Dots indicator */}
            {banners.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                selectedIndex === index 
                                    ? 'bg-white w-4' 
                                    : 'bg-white/50 hover:bg-white/80'
                            }`}
                            onClick={() => emblaApi?.scrollTo(index)}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
