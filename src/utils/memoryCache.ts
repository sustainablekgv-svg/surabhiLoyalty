/**
 * Memory cache utility for frequently accessed static data
 * Implements LRU (Least Recently Used) cache with TTL (Time To Live)
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const itemTTL = ttl || this.defaultTTL;

    // Remove expired items before adding new one
    this.cleanup();

    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: itemTTL,
      accessCount: 0,
      lastAccessed: now,
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    
    // Check if item has expired
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccessed = now;

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const items = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalAccessCount: items.reduce((sum, item) => sum + item.accessCount, 0),
      averageAge: items.length > 0 
        ? items.reduce((sum, item) => sum + (Date.now() - item.timestamp), 0) / items.length
        : 0,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < lruTime) {
        lruTime = item.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}

// Create singleton instances for different data types
export const storeCache = new MemoryCache(50, 10 * 60 * 1000); // 10 minutes TTL for stores
export const productCache = new MemoryCache(200, 15 * 60 * 1000); // 15 minutes TTL for products
export const customerCache = new MemoryCache(100, 5 * 60 * 1000); // 5 minutes TTL for customers
export const configCache = new MemoryCache(20, 30 * 60 * 1000); // 30 minutes TTL for config data

// Utility functions for common cache operations
export const cacheUtils = {
  // Store-related caching
  getStore: (storeId: string) => storeCache.get(`store_${storeId}`),
  setStore: (storeId: string, store: any) => storeCache.set(`store_${storeId}`, store),
  getActiveStores: () => storeCache.get('active_stores'),
  setActiveStores: (stores: any[]) => storeCache.set('active_stores', stores),

  // Product-related caching
  getProduct: (productId: string) => productCache.get(`product_${productId}`),
  setProduct: (productId: string, product: any) => productCache.set(`product_${productId}`, product),
  getProductsByStore: (storeId: string) => productCache.get(`products_store_${storeId}`),
  setProductsByStore: (storeId: string, products: any[]) => 
    productCache.set(`products_store_${storeId}`, products),

  // Customer-related caching
  getCustomer: (customerId: string) => customerCache.get(`customer_${customerId}`),
  setCustomer: (customerId: string, customer: any) => 
    customerCache.set(`customer_${customerId}`, customer),
  getCustomerByMobile: (mobile: string) => customerCache.get(`customer_mobile_${mobile}`),
  setCustomerByMobile: (mobile: string, customer: any) => 
    customerCache.set(`customer_mobile_${mobile}`, customer),

  // Configuration caching
  getConfig: (key: string) => configCache.get(`config_${key}`),
  setConfig: (key: string, value: any) => configCache.set(`config_${key}`, value),

  // Clear all caches
  clearAll: () => {
    storeCache.clear();
    productCache.clear();
    customerCache.clear();
    configCache.clear();
  },

  // Get overall cache statistics
  getAllStats: () => ({
    stores: storeCache.getStats(),
    products: productCache.getStats(),
    customers: customerCache.getStats(),
    config: configCache.getStats(),
  }),
};

export default MemoryCache;