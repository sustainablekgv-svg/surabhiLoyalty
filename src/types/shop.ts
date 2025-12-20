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
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export interface Brand {
    id: string;
    name: string;
    description?: string;
    logo: string;
    isActive: boolean;
    createdAt: any;
    updatedAt: any;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    image?: string;
    isActive: boolean;
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
    sort?: 'price_asc' | 'price_desc' | 'newest';
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
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    paymentMethod: 'cod' | 'online';
    paymentStatus: 'pending' | 'paid' | 'failed';
    shippingAddress: Address;
    createdAt: any;
    updatedAt: any;
}

