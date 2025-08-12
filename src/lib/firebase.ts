// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, logEvent } from "firebase/analytics";
import { getPerformance, trace } from "firebase/performance";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { FirebaseError } from "firebase/app";
// Firebase v11 imports for monitoring and analytics

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);  
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics - only in browser environments
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Performance monitoring - only in browser environments
export const performance = typeof window !== 'undefined' ? getPerformance(app) : null;

// Helper functions for analytics
export const logAnalyticsEvent = (eventName: string, eventParams: Record<string, any> = {}) => {
  if (analytics) {
    logEvent(analytics, eventName, eventParams);
  }
};

// Helper functions for performance monitoring
export const startPerformanceTrace = (traceName: string) => {
  if (performance) {
    return trace(performance, traceName);
  }
  return null;
};

// Helper function for error logging
export const logError = (error: Error, additionalData: Record<string, any> = {}) => {
  // Log to console in development
  console.error('Error logged:', error, additionalData);
  
  // In production, we would log to Firebase Crashlytics
  // This is a placeholder for actual Crashlytics implementation
  if (import.meta.env.PROD && analytics) {
    // Log error as an analytics event for now
    logAnalyticsEvent('app_error', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack,
      ...additionalData
    });
  }
  return null;
};
