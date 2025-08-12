import { useCallback } from 'react';
import { logAnalyticsEvent } from '@/lib/firebase';

/**
 * Custom hook for tracking user interactions with Firebase Analytics
 */
export const useAnalytics = () => {
  /**
   * Track a button click event
   * @param buttonName Name of the button
   * @param additionalParams Additional parameters to track
   */
  const trackButtonClick = useCallback((buttonName: string, additionalParams: Record<string, any> = {}) => {
    logAnalyticsEvent('button_click', {
      button_name: buttonName,
      ...additionalParams
    });
  }, []);

  /**
   * Track a form submission event
   * @param formName Name of the form
   * @param success Whether the submission was successful
   * @param additionalParams Additional parameters to track
   */
  const trackFormSubmission = useCallback(
    (formName: string, success: boolean, additionalParams: Record<string, any> = {}) => {
      logAnalyticsEvent('form_submission', {
        form_name: formName,
        success,
        ...additionalParams
      });
    },
    []
  );

  /**
   * Track a search event
   * @param searchTerm The search term
   * @param additionalParams Additional parameters to track
   */
  const trackSearch = useCallback(
    (searchTerm: string, additionalParams: Record<string, any> = {}) => {
      logAnalyticsEvent('search', {
        search_term: searchTerm,
        ...additionalParams
      });
    },
    []
  );

  /**
   * Track a user login event
   * @param method The login method used
   * @param additionalParams Additional parameters to track
   */
  const trackLogin = useCallback(
    (method: string, additionalParams: Record<string, any> = {}) => {
      logAnalyticsEvent('login', {
        method,
        ...additionalParams
      });
    },
    []
  );

  /**
   * Track a feature usage event
   * @param featureName Name of the feature
   * @param additionalParams Additional parameters to track
   */
  const trackFeatureUsage = useCallback(
    (featureName: string, additionalParams: Record<string, any> = {}) => {
      logAnalyticsEvent('feature_use', {
        feature_name: featureName,
        ...additionalParams
      });
    },
    []
  );

  return {
    trackButtonClick,
    trackFormSubmission,
    trackSearch,
    trackLogin,
    trackFeatureUsage
  };
};