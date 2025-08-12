import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics, logAnalyticsEvent, performance, startPerformanceTrace, logError } from './firebase';

/**
 * Hook to track page views in Firebase Analytics
 */
export const usePageViewTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view with Firebase Analytics
    logAnalyticsEvent('page_view', {
      page_path: location.pathname,
      page_location: window.location.href,
      page_title: document.title
    });
  }, [location]);
};

/**
 * Hook to measure component render performance
 * @param componentName Name of the component to track
 */
export const useComponentPerformance = (componentName: string) => {
  useEffect(() => {
    const perfTrace = startPerformanceTrace(`component_render_${componentName}`);
    
    return () => {
      if (perfTrace) {
        perfTrace.stop();
      }
    };
  }, [componentName]);
};

/**
 * Track a custom event in Firebase Analytics
 * @param eventName Name of the event
 * @param eventParams Additional parameters for the event
 */
export const trackEvent = (eventName: string, eventParams: Record<string, any> = {}) => {
  logAnalyticsEvent(eventName, eventParams);
};

/**
 * Track an error in Firebase Analytics
 * @param error Error object
 * @param additionalData Additional context about the error
 */
export const trackError = (error: Error, additionalData: Record<string, any> = {}) => {
  logError(error, additionalData);
};

/**
 * Start a performance trace
 * @param traceName Name of the trace
 * @returns Trace object with stop method
 */
export const usePerformanceTrace = (traceName: string) => {
  // Create and return the performance trace
  const trace = startPerformanceTrace(traceName);
  
  // Return the trace object so the caller can stop it when needed
  return trace;
};