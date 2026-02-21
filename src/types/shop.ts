export interface Product {
    id: string;
    name: string;
    description: string;
    price: number; // Original Price (MRP)
    sellingPrice: number; // Selling Price (after discount)
    weight: string; // @deprecated - use quantity field. Kept for backward compatibility
    quantity?: string; // Product quantity e.g., "500g", "1kg", "12 pcs"
    weightInKg?: number; // Weight in kilograms for delivery cost calculation
    stock: number;
    images: string[];
    categoryId: string;
    categoryName: string; // Denormalized for easy display
    brandId: string;
    brandName: string; // Denormalized for easy display
    isActive: boolean;
    isFeatured?: boolean;
    freeShipping?: boolean;
    unitsOfMeasure?: string;
    variantType?: string;
    isVisible?: boolean;
    displayOrder?: number;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    spv?: number; // Sales Point Value
    trackInventory?: boolean;
    placeOfOrigin?: string[]; // Multiple places of origin
    averageRating?: number;
    totalReviews?: number;
}

export interface ProductReview {
    id: string;
    productId: string;
    customerId: string;
    customerName: string;
    rating: number; // 1-5
    reviewText: string;
    createdAt: any; // Firestore Timestamp
}

export interface Brand {
    id: string;
    name: string;
    description?: string;
    logo: string; // @deprecated - use images[0], kept for backward compatibility
    images?: string[]; // Multiple images support
    categoryId?: string; // @deprecated - use categoryIds
    categoryName?: string; // @deprecated
    categoryIds?: string[]; // New: List of category IDs this brand belongs to
    categoryOrders?: { [categoryId: string]: number }; // New: Map of CategoryID -> OrderIndex
    isActive: boolean;
    displayOrder?: number; // @deprecated - use categoryOrders for specific contexts
    shippingPercentage?: number; // New: Percentage for shipping credits earning
    createdAt: any;
    updatedAt: any;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    image?: string; // @deprecated - use images[0], kept for backward compatibility
    images?: string[]; // Multiple images support
    isActive: boolean;
    displayOrder?: number;
    createdAt?: any;
    updatedAt?: any;
}

export interface CartItem {
    productId: string;
    quantity: number;
    name: string;
    price: number;
    image: string;
    maxStock: number;
    brandName?: string; // Brand name for delivery breakdown
    brandId?: string; // Brand ID for grouping
    freeShipping?: boolean;
    spv?: number;
    placeOfOrigin?: string[]; // Multiple places of origin
    weight?: string; // @deprecated - use productQuantity
    productQuantity?: string; // Product quantity display (e.g., "500g")
    weightInKg?: number; // Weight in kg for delivery calculation
    unitsOfMeasure?: string;
}

export interface WishlistItem {
    productId: string;
    name: string;
    price: number;
    image: string;
    stock: number;
}

export interface FilterOptions {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    inStock?: boolean;
    sort?: 'price_asc' | 'price_desc' | 'newest' | 'order' | 'spv_asc' | 'spv_desc';
    includeInactive?: boolean;
}

export interface Address {
    fullName: string;
    mobile: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    landmark?: string;
}

export interface Order {
    id: string;
    userId: string;
    items: CartItem[];
    totalAmount: number;
    status: 'payment_pending' | 'received' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
    paymentMethod: 'cod' | 'online';
    paymentStatus: 'pending' | 'paid' | 'failed';
    shippingAddress: Address;
    timeline: {
        status: string;
        timestamp: any;
        note?: string;
    }[];
    cancelReason?: string;
    surabhiCoinsUsed?: number;
    shippingPointsEarned?: number;
    shippingPointsUsed?: number;
    netShippingCharges?: number;
    surabhiCoinsEarned?: number;
    sevaCoinsEarned?: number;
    adminShippingAdjustment?: number;
    createdAt: any;
    updatedAt: any;
}

export interface Origin {
    id: string;
    name: string;
    zone: string; // A, B, C, D, E
}
