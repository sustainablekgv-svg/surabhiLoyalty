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
    // We store minimal details to display cart without fetching every product immediately, 
    // but typically we fetch latest price at checkout.
    name: string;
    price: number; 
    image: string;
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

