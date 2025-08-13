import React, { ComponentType, useEffect } from 'react';

import { startPerformanceTrace } from '@/lib/firebase';

/**
 * Higher-Order Component that adds performance monitoring to a component
 * @param WrappedComponent The component to wrap with performance monitoring
 * @param componentName Optional custom name for the component in performance traces
 */
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName?: string
) {
  // Use the component's display name, the provided name, or a fallback
  const displayName =
    componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  // Create a wrapper component with the same props
  const WithPerformanceMonitoring = (props: P) => {
    useEffect(() => {
      // Only measure performance in production
      if (import.meta.env.PROD) {
        const trace = startPerformanceTrace(`render_${displayName}`);

        return () => {
          if (trace) {
            trace.stop();
          }
        };
      }
    }, []);

    // Render the wrapped component with its props
    return <WrappedComponent {...props} />;
  };

  // Set display name for debugging
  WithPerformanceMonitoring.displayName = `WithPerformanceMonitoring(${displayName})`;

  return WithPerformanceMonitoring;
}
