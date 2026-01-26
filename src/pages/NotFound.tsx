import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl text-center relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>

        <div className="relative">
          <h1 className="text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 mb-2">
            404
          </h1>
          <div className="h-1 w-20 bg-primary mx-auto rounded-full mb-8"></div>
          
          <h2 className="text-3xl font-bold text-gray-800 mb-4 tracking-tight">
            Lost in Space?
          </h2>
          <p className="text-gray-500 mb-10 text-lg leading-relaxed">
            The page you're searching for seems to have vanished or never existed. 
            Let's get you back on track.
          </p>

          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              onClick={() => navigate('/')} 
              className="w-full gap-2 rounded-xl text-lg h-14"
            >
              <Home className="h-5 w-5" />
              Go to Homepage
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate(-1)} 
              className="w-full gap-2 rounded-xl text-lg h-14"
            >
              <ArrowLeft className="h-5 w-5" />
              Go Back
            </Button>
          </div>
        </div>

        <p className="mt-12 text-gray-400 text-sm italic">
          Surabhi Loyalty &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default NotFound;
