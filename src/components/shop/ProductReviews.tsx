import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { ProductReview } from '@/types/shop';
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ProductReviewsProps {
  productId: string;
  productName: string;
  onReviewAdded?: (newAverage: number, newTotal: number) => void;
}

export const ProductReviews = ({ productId, productName, onReviewAdded }: ProductReviewsProps) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

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
        // Check if current user has already reviewed
        const userId = (user as any).uid || (user as any).id;
        const userReview = fetchedReviews.find(r => r.customerId === userId);
        if (userReview) {
          setHasReviewed(true);
        }
      }
    } catch (error) {
      console.error("Error fetching reviews", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNewAverages = (newReview: Omit<ProductReview, 'id'>, existingReviews: ProductReview[]) => {
    const totalReviews = existingReviews.length + 1;
    const totalRatingSum = existingReviews.reduce((sum, r) => sum + r.rating, 0) + newReview.rating;
    const averageRating = Number((totalRatingSum / totalReviews).toFixed(1));
    return { averageRating, totalReviews };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to submit a review.");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("Please enter a review text.");
      return;
    }

    setIsSubmitting(true);
    try {
        const userId = (user as any).uid || (user as any).id;
        // Double check they haven't reviewed yet
        const checkQ = query(
            collection(db, 'product_reviews'), 
            where('productId', '==', productId), 
            where('customerId', '==', userId)
        );
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
            toast.error("You have already reviewed this product.");
            setHasReviewed(true);
            setIsSubmitting(false);
            return;
        }

        const newReviewData = {
          productId,
          customerId: userId,
          customerName: (user as any).displayName || (user as any).customerName || 'Anonymous User',
          rating,
          reviewText: reviewText.trim(),
          createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'product_reviews'), newReviewData);
        
        // Add locally formatted review
        const localReview = {
            ...newReviewData,
            id: docRef.id,
            createdAt: { toDate: () => new Date() } // Mock timestamp for immediate UI update
        } as ProductReview;

        setReviews(prev => [localReview, ...prev]);
        setHasReviewed(true);
        setReviewText('');
        toast.success("Review submitted successfully!");

        // Update Product Averages
        const { averageRating, totalReviews } = calculateNewAverages(newReviewData, reviews);
        await updateDoc(doc(db, 'products', productId), {
            averageRating,
            totalReviews
        });

        if (onReviewAdded) {
            onReviewAdded(averageRating, totalReviews);
        }

    } catch (error) {
      console.error("Error submitting review", error);
      toast.error("Failed to submit review. Please try again.");
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
    <div className="mt-12 border-t pt-8">
      <h3 className="text-2xl font-bold mb-6">Customer Reviews</h3>
      
      <div className="grid md:grid-cols-[1fr_2fr] gap-8">
        
        {/* Write a Review Section */}
        <div className="bg-gray-50 p-6 rounded-xl border h-fit">
          <h4 className="font-semibold text-lg mb-4">Write a Review</h4>
          
          {!user ? (
            <div className="text-center py-6 bg-white rounded-lg border border-dashed">
                <p className="text-gray-600 mb-4">Please log in to share your thoughts.</p>
                {/* Depending on app setup, this could be a link to login */}
            </div>
          ) : hasReviewed ? (
            <div className="text-center py-6 bg-green-50 text-green-800 rounded-lg border border-green-200">
                <Star className="h-8 w-8 mx-auto mb-2 text-green-600 fill-current" />
                <p className="font-medium">Thanks for your review!</p>
                <p className="text-sm">You've already reviewed this product.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Overall Rating</label>
                <div className="flex gap-1">
                  {renderStars(rating, true)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <Textarea 
                  placeholder={`What did you like or dislike about ${productName}?`}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="min-h-[100px] bg-white resize-none"
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {reviewText.length}/500
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !reviewText.trim()}>
                {isSubmitting ? "Submitting..." : "Submit Review"}
              </Button>
            </form>
          )}
        </div>

        {/* Reviews List */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed text-gray-500">
              <Star className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-700">No reviews yet</p>
              <p className="text-sm">Be the first to review this product!</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-white p-5 rounded-lg border shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-semibold text-gray-900">{review.customerName}</span>
                    <span className="text-xs text-gray-500 ml-2">
                        {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {renderStars(review.rating)}
                  </div>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{review.reviewText}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
