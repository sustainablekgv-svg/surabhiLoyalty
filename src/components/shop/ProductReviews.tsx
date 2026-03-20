import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { ProductReview } from '@/types/shop';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Check, Pencil, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProductReviewsProps {
  productId: string;
  productName: string;
  onReviewAdded?: (newAverage: number, newTotal: number) => void;
}

export const ProductReviews = ({ productId, productName, onReviewAdded }: ProductReviewsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRated, setHasRated] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [currentUserReviewId, setCurrentUserReviewId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'product_reviews'),
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetchedReviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductReview[];
      
      setReviews(fetchedReviews);
      
      if (user) {
        const userId = (user as any).uid || (user as any).id;
        const userReview = fetchedReviews.find(r => r.customerId === userId);
        if (userReview) {
          setCurrentUserReviewId(userReview.id);
          setHasRated(!!userReview.rating);
          setHasReviewed(!!userReview.reviewText?.trim());
          if (userReview.rating) setRating(userReview.rating);
          if (userReview.reviewText) setReviewText(userReview.reviewText);
        } else {
          setCurrentUserReviewId(null);
          setHasRated(false);
          setHasReviewed(false);
        }
      }
    } catch (error) {
      console.error("Error fetching reviews", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNewAverages = (updatedReview: Omit<ProductReview, 'id'>, existingReviews: ProductReview[], isNewRecord: boolean) => {
    let allReviews = [...existingReviews];
    if (isNewRecord) {
        // Add new
        allReviews.push(updatedReview as ProductReview);
    } else {
        // Update existing in calculation
        const userId = updatedReview.customerId;
        allReviews = allReviews.map(r => r.customerId === userId ? { ...r, ...updatedReview } : r);
    }

    const ratedReviews = allReviews.filter(r => (r.rating || 0) > 0);
    const totalReviews = allReviews.length;
    const totalRatingSum = ratedReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = ratedReviews.length > 0 
        ? Number((totalRatingSum / ratedReviews.length).toFixed(1)) 
        : 0;

    return { averageRating, totalReviews };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to submit a review.");
      return;
    }
    // reviewText is now optional as per user request

    setIsSubmitting(true);
    try {
        const userId = (user as any).uid || (user as any).id;
        const isNewRecord = !currentUserReviewId;
        
        const reviewData: any = {
          productId,
          customerId: userId,
          customerName: (user as any).displayName || (user as any).customerName || 'Anonymous User',
          updatedAt: serverTimestamp()
        };

        // Only update rating if not already rated and a rating was selected
        if (!hasRated && rating > 0) {
            reviewData.rating = rating;
        }

        // Only update review text if not already reviewed and text was provided
        const trimmedText = reviewText.trim();
        if (!hasReviewed && trimmedText) {
            reviewData.reviewText = trimmedText;
        }

        // Must submit at least one piece of data if it's a new record
        if (isNewRecord && !reviewData.rating && !reviewData.reviewText) {
            toast.error("Please provide either a rating or review text.");
            setIsSubmitting(false);
            return;
        }

        if (isNewRecord) {
            reviewData.createdAt = serverTimestamp();
            const docRef = await addDoc(collection(db, 'product_reviews'), reviewData);
            setCurrentUserReviewId(docRef.id);
            
            const localReview = {
                ...reviewData,
                id: docRef.id,
                createdAt: { toDate: () => new Date() }
            } as ProductReview;
            setReviews(prev => [localReview, ...prev]);
        } else {
            await updateDoc(doc(db, 'product_reviews', currentUserReviewId), reviewData);
            setReviews(prev => prev.map(r => r.id === currentUserReviewId ? { ...r, ...reviewData } : r));
        }

        if (reviewData.rating) setHasRated(true);
        if (reviewData.reviewText) setHasReviewed(true);
        
        toast.success(isNewRecord ? "Review published!" : "Feedback updated!");

        // Update Product Averages
        const { averageRating, totalReviews } = calculateNewAverages(reviewData, reviews, isNewRecord);
        await updateDoc(doc(db, 'products', productId), {
            averageRating,
            totalReviews
        });

        if (onReviewAdded) {
            onReviewAdded(averageRating, totalReviews);
        }

    } catch (error) {
      console.error("Error submitting review", error);
      toast.error("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Stars Helper
  const renderStars = (count: number, interactive = false) => {
    return Array(5).fill(0).map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${i < count ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
        onClick={() => interactive && setRating(i + 1)}
      />
    ));
  };

  return (
    <div className="mt-16 border-t border-slate-100 pt-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Customer Experience</h3>
          <p className="text-sm text-slate-500 font-medium">Real stories from real users who purchased this product.</p>
        </div>
        {!hasReviewed && user && (
            <Badge variant="outline" className="w-fit h-6 border-indigo-100 text-indigo-600 bg-indigo-50/50 font-bold uppercase tracking-wider text-[10px]">
                Verified Purchase Review
            </Badge>
        )}
      </div>
      
      <div className="grid lg:grid-cols-[380px_1fr] gap-12 items-start">
        
        {/* Write a Review Section */}
        <div className="sticky top-24">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="bg-slate-50 border-b border-slate-100 p-6">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-600" />
                        Share Your Thoughts
                    </h4>
                </div>
                
                <div className="p-6">
                {!user ? (
                    <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <div className="bg-white h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                            <Star className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-slate-600 text-sm font-medium mb-4 leading-relaxed">Please log in to share your experience with {productName}.</p>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-full px-6 font-bold text-xs uppercase tracking-wider border-slate-300"
                            onClick={() => navigate('/login')}
                        >
                            Log In to Review
                        </Button>
                    </div>
                ) : (hasRated && hasReviewed) ? (
                    <div className="text-center py-10 px-6 bg-emerald-50/50 text-emerald-800 rounded-2xl border border-emerald-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform scale-150 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                             <Check className="h-24 w-24" />
                        </div>
                        <div className="bg-white h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md border border-emerald-100">
                            <Star className="h-8 w-8 text-emerald-500 fill-current" />
                        </div>
                        <p className="font-black text-xl tracking-tight mb-2">Thank You!</p>
                        <p className="text-sm text-emerald-700 font-medium leading-relaxed">
                            You've shared your full experience. Your feedback helps our community flourish.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {!hasRated && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Overall Rating</label>
                                <div className="flex gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 justify-center">
                                {renderStars(rating, true)}
                                </div>
                            </div>
                        )}
                        
                        {!hasReviewed && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Your Detailed Review <span className="text-[10px] lowercase font-medium opacity-60">(Optional)</span></label>
                                <div className="relative">
                                    <Textarea 
                                        placeholder={`What was your favorite thing about this product?`}
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        className="min-h-[160px] bg-slate-50 border-slate-200 focus-visible:ring-indigo-500/50 rounded-2xl p-4 text-sm leading-relaxed resize-none shadow-inner"
                                        maxLength={500}
                                    />
                                    <div className={`absolute bottom-3 right-3 text-[10px] font-mono font-bold px-2 py-1 rounded-full border ${reviewText.length > 450 ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white text-slate-400 border-slate-100'}`}>
                                        {reviewText.length}/500
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className="w-full h-12 rounded-2xl font-black text-sm uppercase tracking-[0.1em] bg-slate-900 hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100" 
                            disabled={isSubmitting || (!hasRated && rating === 0 && !hasReviewed && !reviewText.trim())}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Publishing...
                                </span>
                            ) : (!hasRated && rating > 0 && !hasReviewed && reviewText.trim()) ? "Post Both" : 
                                (!hasRated && rating > 0) ? "Submit Rating" : 
                                (!hasReviewed && reviewText.trim()) ? "Post Review" : 
                                (hasRated && !hasReviewed) ? "Add Review Text" :
                                (!hasRated && hasReviewed) ? "Add Rating" : "Publish Review"}
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 font-medium px-4">
                            By publishing, you agree to our community guidelines regarding product feedback.
                        </p>
                    </form>
                )}
                </div>
            </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-8">
          {loading ? (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-50 rounded-3xl animate-pulse" />
                ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-20 bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
              <div className="bg-white h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                <Star className="h-10 w-10 text-slate-200" />
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight mb-2">Experience Gap</p>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">This product hasn't been reviewed yet. Your story could be the first one told!</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {reviews.map((review) => {
                const isCurrentUser = user && ((user as any).uid === review.customerId || (user as any).id === review.customerId);
                return (
                    <div 
                        key={review.id} 
                        className={`group p-6 md:p-8 rounded-[32px] border transition-all duration-300 ${isCurrentUser ? 'bg-indigo-50/30 border-indigo-100 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md'}`}
                    >
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center font-black text-sm border-2 ${isCurrentUser ? 'bg-white border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                    {review.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900 tracking-tight">{review.customerName}</span>
                                        {isCurrentUser && (
                                            <span className="text-[10px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Your Review</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex gap-0.5">
                                            {renderStars(review.rating)}
                                        </div>
                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently Published'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {review.reviewText && (
                            <div className="relative">
                                <p className="text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium pl-2 border-l-2 border-slate-100 group-hover:border-indigo-200 transition-colors">
                                    {review.reviewText}
                                </p>
                            </div>
                        )}
                    </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
