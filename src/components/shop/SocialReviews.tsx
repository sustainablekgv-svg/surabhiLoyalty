import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { ProductReview } from '@/types/shop';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Quote, ShieldCheck, Star } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const FEMALE_NAME_HINTS = new Set([
  'anusha',
  'bhargavi',
  'bhavya',
  'bindu',
  'deepika',
  'divya',
  'durga',
  'geetha',
  'harika',
  'haritha',
  'hema',
  'jyothi',
  'kalyani',
  'kavya',
  'keerthi',
  'lakshmi',
  'lavanya',
  'latha',
  'madhavi',
  'mahalakshmi',
  'manjula',
  'nirmala',
  'nisha',
  'padma',
  'pooja',
  'priya',
  'ramya',
  'rani',
  'rashmi',
  'revathi',
  'sandhya',
  'sangeetha',
  'shilpa',
  'sindhu',
  'sindhura',
  'sneha',
  'sowjanya',
  'sowmya',
  'sravani',
  'sreelatha',
  'srilatha',
  'sruthi',
  'sujatha',
  'swathi',
  'tejaswini',
  'usha',
  'vaishnavi',
]);

const getReviewerAvatarUrl = (customerName: string) => {
  const normalizedName = customerName.trim();
  const nameParts = normalizedName.toLowerCase().match(/[a-z]+/g) || [];
  const isLikelyFemale = nameParts.some((part) => FEMALE_NAME_HINTS.has(part));
  if (isLikelyFemale) {
    return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(normalizedName)}`;
  }

  const maleAvatarParams = new URLSearchParams({
    seed: normalizedName,
    style: 'circle',
    top: 'shortFlat,shortRound,theCaesar,theCaesarAndSidePart',
    accessoriesProbability: '0',
    facialHairProbability: '0',
    clothing: 'shirtCrewNeck,shirtVNeck,graphicShirt',
    clothesColor: 'ff488e,ff5c5c,929598',
    eyebrows: 'defaultNatural,flatNatural',
    eyes: 'default,happy,squint',
    mouth: 'default,smile,twinkle',
    hairColor: '2c1b18,4a312c,724133',
  });

  return `https://api.dicebear.com/9.x/avataaars/svg?${maleAvatarParams.toString()}`;
};

interface SocialReviewsProps {
  productId: string;
}

export const SocialReviews: React.FC<SocialReviewsProps> = ({ productId }) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopReviews = async () => {
      try {
        const q = query(
          collection(db, 'product_reviews'),
          where('productId', '==', productId),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const fetchedReviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductReview[];

        const topProductReviews = fetchedReviews
          .filter(r => (r.rating || 0) >= 4 && r.reviewText && r.reviewText.length > 10)
          .sort((a, b) => {
            const ratingDiff = (b.rating || 0) - (a.rating || 0);
            if (ratingDiff !== 0) return ratingDiff;

            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, 6);

        setReviews(topProductReviews);
      } catch (error) {
        console.error("Error fetching social reviews", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopReviews();
  }, [productId]);

  if (loading) {
      return (
          <div className="py-16 container px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="h-64 bg-slate-50 rounded-[32px] animate-pulse border border-slate-100" />
                  ))}
              </div>
          </div>
      );
  }

  if (reviews.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
            The Community Voice
          </h2>
          <p className="text-slate-500 font-medium max-w-2xl mx-auto">
            Discover why conscious shoppers choose Surabhi for their daily essentials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reviews.map((t) => (
            <div 
              key={t.id}
              className="relative group bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-full border-2 border-primary/20 overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img 
                    src={getReviewerAvatarUrl(t.customerName)}
                    alt={t.customerName} 
                    className="h-full w-full object-cover" 
                  />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 leading-none">{t.customerName}</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" /> Verified Customer
                  </p>
                </div>
              </div>

              <div className="flex gap-1 mb-4">
                {Array(5).fill(0).map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "h-4 w-4",
                      i < t.rating ? "fill-yellow-400 text-yellow-400" : "fill-slate-100 text-slate-200"
                    )}
                  />
                ))}
              </div>

              <div className="relative min-h-[80px]">
                <Quote className="absolute -top-2 -left-2 h-8 w-8 text-primary/5 -z-0" />
                <p className="text-slate-600 font-medium leading-relaxed italic relative z-10 line-clamp-4">
                  "{t.reviewText}"
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Recently'}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary italic">
                  <span>Verified Experience</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
