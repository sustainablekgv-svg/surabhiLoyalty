# Firebase Monitoring Integration Guide

This document provides an overview of the Firebase monitoring features integrated into the application and how to use them.

## Available Monitoring Features

### 1. Firebase Analytics

Firebase Analytics is used to track user behavior and app usage. The following analytics features are available:

- Automatic page view tracking via `AnalyticsProvider`
- Custom event tracking via `useAnalytics` hook
- User interaction tracking (button clicks, form submissions, searches, etc.)

### 2. Firebase Performance Monitoring

Performance monitoring helps identify bottlenecks and performance issues:

- Component render performance tracking via `withPerformanceMonitoring` HOC
- Route performance tracking via `PerformanceRoute` component
- API call performance tracking via `monitoredFetch` and `createMonitoredFunction`

### 3. Error Tracking

Error tracking helps identify and fix issues in the application:

- Global error boundary via `ErrorBoundary` component
- Error logging via `logError` function

## How to Use

### Analytics

```tsx
// Track button clicks
import { useAnalytics } from '@/hooks/useAnalytics';

const MyComponent = () => {
  const { trackButtonClick } = useAnalytics();

  return (
    <button onClick={() => trackButtonClick('submit_button', { page: 'checkout' })}>Submit</button>
  );
};

// Track form submissions
const { trackFormSubmission } = useAnalytics();

const handleSubmit = async data => {
  try {
    await submitForm(data);
    trackFormSubmission('login_form', true);
  } catch (error) {
    trackFormSubmission('login_form', false, { error: error.message });
  }
};
```

### Performance Monitoring

```tsx
// Monitor component performance
import { withPerformanceMonitoring } from '@/components/withPerformanceMonitoring';

const ExpensiveComponent = () => {
  // Component implementation
};

export default withPerformanceMonitoring(ExpensiveComponent, 'ExpensiveComponent');

// Monitor API calls
import { monitoredFetch } from '@/lib/performanceUtils';

const fetchData = async () => {
  const response = await monitoredFetch('/api/data', { method: 'GET' }, 'fetch_data');
  return response.json();
};
```

### Error Tracking

```tsx
// Log errors
import { logError } from '@/lib/firebase';

try {
  // Some operation that might fail
} catch (error) {
  logError(error, { context: 'fetchUserData', userId: user.id });
}

// Use error boundary for component error handling
import { ErrorBoundary } from '@/components/ErrorBoundary';

const App = () => (
  <ErrorBoundary fallback={<ErrorPage />}>
    <MyComponent />
  </ErrorBoundary>
);
```

## Best Practices

1. **Be selective with analytics events** - Track important user interactions but avoid tracking everything to prevent analytics noise.

2. **Use meaningful names** - Use descriptive names for events, traces, and error contexts to make analysis easier.

3. **Include relevant context** - Add contextual information to events and errors to help with debugging and analysis.

4. **Monitor performance critical paths** - Focus performance monitoring on user-facing operations and expensive computations.

5. **Handle errors gracefully** - Use error boundaries to prevent the entire app from crashing when components fail.

## Firebase Console

To view the collected data, visit the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to the appropriate section:
   - Analytics: Click on "Analytics" in the left sidebar
   - Performance: Click on "Performance" in the left sidebar
   - Crashlytics: Click on "Crashlytics" in the left sidebar
