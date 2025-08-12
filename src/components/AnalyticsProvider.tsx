import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logAnalyticsEvent } from '@/lib/firebase';

interface AnalyticsProviderProps {
  children: ReactNode;
}

/**
 * AnalyticsProvider component that tracks page views and provides analytics context
 */
export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const location = useLocation();

  // Track page views
  useEffect(() => {
    // Only track in production or when analytics is enabled
    if (import.meta.env.PROD) {
      logAnalyticsEvent('page_view', {
        page_path: location.pathname,
        page_location: window.location.href,
        page_title: document.title || 'Loyalty App'
      });
    }
  }, [location]);

  // Track app initialization
  useEffect(() => {
    if (import.meta.env.PROD) {
      logAnalyticsEvent('app_initialized', {
        timestamp: new Date().toISOString(),
        app_version: import.meta.env.VITE_APP_VERSION || '1.0.0'
      });
    }
  }, []);

  return <>{children}</>;
};