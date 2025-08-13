import { logError, startPerformanceTrace } from './firebase';

/**
 * Wraps a fetch call with performance monitoring
 * @param url The URL to fetch
 * @param options Fetch options
 * @param traceName Custom name for the trace (defaults to the URL path)
 * @returns The fetch response
 */
export const monitoredFetch = async (
  url: string,
  options?: RequestInit,
  traceName?: string
): Promise<Response> => {
  // Extract path from URL for trace name if not provided
  const urlObj = new URL(url, window.location.origin);
  const path = urlObj.pathname;
  const name = traceName || `fetch_${path}`;

  // Start performance trace
  const perfTrace = startPerformanceTrace(name);
  // No need to call start() as it's already called in startPerformanceTrace

  try {
    // Make the fetch request
    const response = await fetch(url, options);

    // Add custom metrics to the trace
    if (perfTrace) {
      perfTrace.putMetric('status_code', response.status);
      perfTrace.putMetric(
        'response_size',
        parseInt(response.headers.get('content-length') || '0', 10)
      );
    }

    return response;
  } catch (error) {
    // Log error to Crashlytics
    if (error instanceof Error) {
      logError(error, { url, method: options?.method || 'GET' });
    }

    // Add error metric to trace
    if (perfTrace) {
      perfTrace.putMetric('error', 1);
    }

    throw error;
  } finally {
    // Stop the trace
    if (perfTrace) perfTrace.stop();
  }
};

/**
 * Creates a monitored version of any async function
 * @param fn The function to monitor
 * @param traceName Name for the performance trace
 * @returns A monitored version of the function
 */
export function createMonitoredFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  traceName: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const perfTrace = startPerformanceTrace(traceName);

    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      // Log error to Crashlytics
      if (error instanceof Error) {
        logError(error, { function: fn.name || traceName, args: JSON.stringify(args) });
      }

      throw error;
    } finally {
      if (perfTrace) perfTrace.stop();
    }
  }) as T;
}
