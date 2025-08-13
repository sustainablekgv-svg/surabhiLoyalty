import React, { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { startPerformanceTrace } from '@/lib/firebase';

interface PerformanceRouteWrapperProps {
  children: ReactNode;
  traceName?: string;
}

/**
 * A wrapper component that automatically tracks performance metrics
 * for routes using Firebase Performance Monitoring
 *
 * Usage example:
 * <Route path="/path" element={<PerformanceRouteWrapper><YourComponent /></PerformanceRouteWrapper>} />
 */
export const PerformanceRouteWrapper: React.FC<PerformanceRouteWrapperProps> = ({
  children,
  traceName,
}) => {
  const location = useLocation();
  const routeName = traceName || `route_${location.pathname}`;

  useEffect(() => {
    // Only measure performance in production
    if (import.meta.env.PROD) {
      const trace = startPerformanceTrace(routeName);

      return () => {
        if (trace) {
          trace.stop();
        }
      };
    }
  }, [routeName, location.pathname]);

  return <>{children}</>;
};
