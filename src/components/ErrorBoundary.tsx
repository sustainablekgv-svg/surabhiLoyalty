import { Component, ErrorInfo, ReactNode } from 'react';

import { logError } from '@/lib/firebase';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in its child component tree,
 * logs those errors to Firebase Crashlytics, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to Firebase Crashlytics
    logError(error, {
      componentStack: errorInfo.componentStack,
      errorInfo: errorInfo.toString(),
    });

    // console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <div className="p-3 xs:p-4 bg-red-50 border border-red-200 rounded-md">
            <h2 className="text-base xs:text-lg font-semibold text-red-800">
              Something went wrong
            </h2>
            <p className="text-xs xs:text-sm text-red-600 mt-0.5 xs:mt-1">
              The application encountered an error. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 xs:mt-3 px-3 xs:px-4 py-1.5 xs:py-2 bg-red-100 text-red-800 rounded-md text-xs xs:text-sm hover:bg-red-200 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
