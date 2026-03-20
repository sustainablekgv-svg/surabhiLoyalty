import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const ReferralRedirect = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (code) {
            navigate(`/signup?ref=${code}`, { replace: true });
        } else {
            navigate('/signup', { replace: true });
        }
    }, [code, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-amber-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
    );
};

export default ReferralRedirect;
