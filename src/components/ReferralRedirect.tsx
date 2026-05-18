import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SEO from './SEO';

const ReferralRedirect = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (code) {
            // Give a small delay for SEO crawlers if they wait
            const timer = setTimeout(() => {
                navigate(`/signup?ref=${code}`, { replace: true });
            }, 500);
            return () => clearTimeout(timer);
        } else {
            navigate('/signup', { replace: true });
        }
    }, [code, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-amber-50">
            <SEO 
                title="Join Surabhi Loyalty League"
                description="Join SLL - Surabhi Loyalty League and support farmers, gopalaks, and local business owners! Shop premium organic products and earn lifetime rewards."
                keywords="referral, loyalty program, surabhi, organic shopping, community rewards"
            />
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
    );
};

export default ReferralRedirect;
