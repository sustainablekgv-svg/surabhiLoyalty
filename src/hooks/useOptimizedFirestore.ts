import { onSnapshot, Query, DocumentReference, Unsubscribe } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';

import { sessionManager } from '@/lib/sessionManager';
import { tabSync } from '@/lib/tabSync';

// Global registry to track active listeners across all components
const listenerRegistry = new Map<
  string,
  {
    unsubscribe: Unsubscribe;
    tabId: string;
    componentCount: number;
    lastUsed: number;
  }
>();

// Cleanup inactive listeners periodically
setInterval(() => {
  const now = Date.now();
  const activeTabs = tabSync.getActiveTabs();

  listenerRegistry.forEach((listener, key) => {
    // Remove listeners from inactive tabs or unused for more than 5 minutes
    if (!activeTabs.includes(listener.tabId) || now - listener.lastUsed > 300000) {
      listener.unsubscribe();
      listenerRegistry.delete(key);
    }
  });
}, 60000); // Check every minute

interface UseOptimizedFirestoreOptions {
  enabled?: boolean;
  onlyMainTab?: boolean;
  cacheKey?: string;
}

/**
 * Optimized Firestore hook that prevents duplicate listeners across tabs
 * and manages memory efficiently
 */
export const useOptimizedFirestore = <T>(
  query: Query | DocumentReference | null,
  options: UseOptimizedFirestoreOptions = {}
) => {
  const { enabled = true, onlyMainTab = false, cacheKey } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const listenerKeyRef = useRef<string | null>(null);
  const currentTabId = tabSync.getTabId();

  useEffect(() => {
    if (!query || !enabled) {
      setLoading(false);
      return;
    }

    // If onlyMainTab is true, only the main tab should create listeners
    if (onlyMainTab && !sessionManager.isMainTab()) {
      setLoading(false);
      return;
    }

    const queryKey = cacheKey || `${query.toString()}_${currentTabId}`;
    listenerKeyRef.current = queryKey;

    // Check if listener already exists for this query
    const existingListener = listenerRegistry.get(queryKey);
    if (existingListener) {
      existingListener.componentCount++;
      existingListener.lastUsed = Date.now();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = onSnapshot(
        query as Query,
        snapshot => {
          try {
            if ('docs' in snapshot) {
              // Query snapshot
              const newData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              })) as T[];
              setData(newData);
            } else {
              // Document snapshot
              if (snapshot && (snapshot as any).exists) {
                const newData = [
                  {
                    id: (snapshot as any).id,
                    ...(snapshot as any).data(),
                  },
                ] as T[];
                setData(newData);
              } else {
                setData([]);
              }
            }
            setLoading(false);
            setError(null);
          } catch (err) {
            // console.error('Error processing Firestore snapshot:', err);
            setError(err as Error);
            setLoading(false);
          }
        },
        err => {
          // console.error('Firestore listener error:', err);
          setError(err as Error);
          setLoading(false);
        }
      );

      // Register the listener
      listenerRegistry.set(queryKey, {
        unsubscribe,
        tabId: currentTabId,
        componentCount: 1,
        lastUsed: Date.now(),
      });

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      // console.error('Error creating Firestore listener:', err);
      setError(err as Error);
      setLoading(false);
    }

    return () => {
      if (listenerKeyRef.current) {
        const listener = listenerRegistry.get(listenerKeyRef.current);
        if (listener) {
          listener.componentCount--;
          if (listener.componentCount <= 0) {
            listener.unsubscribe();
            listenerRegistry.delete(listenerKeyRef.current);
          }
        }
      }
    };
  }, [query, enabled, onlyMainTab, cacheKey, currentTabId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerKeyRef.current) {
        const listener = listenerRegistry.get(listenerKeyRef.current);
        if (listener) {
          listener.componentCount--;
          if (listener.componentCount <= 0) {
            listener.unsubscribe();
            listenerRegistry.delete(listenerKeyRef.current);
          }
        }
      }
    };
  }, []);

  return { data, loading, error };
};

/**
 * Hook for single document listening with optimization
 */
export const useOptimizedDocument = <T>(
  docRef: DocumentReference | null,
  options: UseOptimizedFirestoreOptions = {}
) => {
  const result = useOptimizedFirestore<T>(docRef, options);
  return {
    ...result,
    data: result.data[0] || null,
  };
};

/**
 * Get current listener statistics (for debugging)
 */
export const getListenerStats = () => {
  return {
    activeListeners: listenerRegistry.size,
    listeners: Array.from(listenerRegistry.entries()).map(([key, listener]) => ({
      key,
      tabId: listener.tabId,
      componentCount: listener.componentCount,
      lastUsed: new Date(listener.lastUsed).toISOString(),
    })),
  };
};
