export interface Product {
    id: string;
    name: string;
    description: string;
    price: number; // Original Price (MRP)
    sellingPrice: number; // Selling Price (after discount)
    weight: string; // e.g., "500g", "1kg"
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
}

export interface Brand {
    id: string;
    name: string;
    description?: string;
    logo: string;
    categoryId?: string; // @deprecated - use categoryIds
    categoryName?: string; // @deprecated
    categoryIds?: string[]; // New: List of category IDs this brand belongs to
    categoryOrders?: { [categoryId: string]: number }; // New: Map of CategoryID -> OrderIndex
    isActive: boolean;
    displayOrder?: number; // @deprecated - use categoryOrders for specific contexts
    createdAt: any;
    updatedAt: any;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    image?: string;
    isActive: boolean;
    displayOrder?: number;
}

export interface CartItem {
    productId: string;
    quantity: number;
    name: string;
    price: number;
    image: string;
    maxStock: number;
    freeShipping?: boolean;
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
    sort?: 'price_asc' | 'price_desc' | 'newest' | 'order';
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
    createdAt: any;
    updatedAt: any;
}

