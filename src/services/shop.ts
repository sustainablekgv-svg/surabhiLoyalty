
import { db } from '@/lib/firebase';
import { Brand, Category, Order, Product } from '@/types/shop';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';

// --- Products ---

export const getProducts = async (
    filters?: import('@/types/shop').FilterOptions,
    lastDoc?: any,
    pageSize: number = 12
): Promise<{ products: Product[]; lastDoc: any }> => {
    const constraints: any[] = [];
    if (!filters?.includeInactive) {
        constraints.push(where('isActive', '==', true));
    }

    if (filters?.category) {
        constraints.push(where('categoryId', '==', filters.category));
    }

    if (filters?.brand) {
        constraints.push(where('brandId', '==', filters.brand));
    }

    if (filters?.minPrice !== undefined) {
        constraints.push(where('sellingPrice', '>=', filters.minPrice));
    }

    if (filters?.maxPrice !== undefined) {
         constraints.push(where('sellingPrice', '<=', filters.maxPrice));
    }

    if (filters?.inStock) {
         constraints.push(where('stock', '>', 0));
    }

    if (filters?.sort === 'price_asc') {
        constraints.push(orderBy('sellingPrice', 'asc'));
    } else if (filters?.sort === 'price_desc') {
        constraints.push(orderBy('sellingPrice', 'desc'));
    } else {
        constraints.push(orderBy('createdAt', 'desc'));
    }

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    constraints.push(limit(pageSize));

    const q = query(collection(db, 'products'), ...constraints);

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];

    return { products, lastDoc: newLastDoc };
};

export const getActiveProducts = async (): Promise<Product[]> => {
  const q = query(
      collection(db, 'products'), 
      where('isActive', '==', true),
      where('isVisible', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const docRef = doc(db, 'products', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Product;
  }
  return null;
};

export const createProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'products'), {
    ...product,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
  const docRef = doc(db, 'products', id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'products', id));
};

// --- Categories ---

// --- Categories ---
export const getCategories = async (
    pageSize: number = 100, // Default large for dropdowns, but can be limited for table
    lastDoc?: any,
    search?: string
): Promise<{ categories: Category[]; lastDoc: any }> => {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    
    // Note: Firestore doesn't support native partial text search.
    // We will do basic pagination here. Client side search or separate Index needed for robust search.
    // For admin tables, we might just fetch latest.
    
    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }
    
    constraints.push(limit(pageSize));
    
    const q = query(collection(db, 'categories'), ...constraints);
    const snapshot = await getDocs(q);
    
    let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

    // Simple Client-side filter for current page (limited utility with pagination but better than nothing without Algolia)
    // Ideally we fetch all for dropdowns, but paginate for Table.
    if (search) {
        categories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }

    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
    return { categories, lastDoc: newLastDoc };
};

export const createCategory = async (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'categories'), {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<void> => {
    const docRef = doc(db, 'categories', id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
};

export const deleteCategory = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'categories', id));
};

// --- Brands ---

export const getBrands = async (): Promise<Brand[]> => {
    const q = query(collection(db, 'brands'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));
};

export const getBrandsPaginated = async (
    pageSize: number = 10,
    lastDoc?: any,
    search?: string
): Promise<{ brands: Brand[]; lastDoc: any }> => {
    const constraints: any[] = [orderBy('createdAt', 'desc')];

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'brands'), ...constraints);
    const snapshot = await getDocs(q);
    let brands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));

    if (search) {
        brands = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
    return { brands, lastDoc: newLastDoc };
}

export const getCategoriesPaginated = async (
    pageSize: number = 10,
    lastDoc?: any,
    search?: string
): Promise<{ categories: Category[]; lastDoc: any }> => {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'categories'), ...constraints);
    const snapshot = await getDocs(q);
    let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    
    if (search) {
        categories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
    return { categories, lastDoc: newLastDoc };
}

export const createBrand = async (brand: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'brands'), {
        ...brand,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateBrand = async (id: string, updates: Partial<Brand>): Promise<void> => {
    const docRef = doc(db, 'brands', id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
};

export const deleteBrand = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'brands', id));
};


// --- Orders ---

export const createOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'timeline'>) => {
    const timestamp = new Date();
    const docRef = await addDoc(collection(db, 'orders'), {
        ...order,
        status: 'received',
        timeline: [
            { status: 'received', timestamp, note: 'Order placed successfully' }
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const getOrders = async (
    pageSize: number = 10,
    lastDoc?: any,
    status?: string,
    search?: string
): Promise<{ orders: Order[]; lastDoc: any }> => {
    const constraints: any[] = [orderBy('createdAt', 'desc')];

    if (status && status !== 'all') {
        constraints.push(where('status', '==', status));
    }

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }
    
    constraints.push(limit(pageSize));

    const q = query(collection(db, 'orders'), ...constraints);
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

    if (search) {
        // Client side search for ID or Name
        const lowerSearch = search.toLowerCase();
        orders = orders.filter(o => 
            o.id.toLowerCase().includes(lowerSearch) || 
            o.shippingAddress.fullName.toLowerCase().includes(lowerSearch) ||
            o.shippingAddress.mobile.includes(search)
        );
    }

    const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
    return { orders, lastDoc: newLastDoc };
};

export const getOrdersByUser = async (userId: string): Promise<Order[]> => {
    const q = query(collection(db, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
};

export const updateOrderStatus = async (orderId: string, status: Order['status'], note?: string) => {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) throw new Error("Order not found");
    
    const currentOrder = docSnap.data() as Order;
    const newTimeline = [
        ...(currentOrder.timeline || []),
        { status, timestamp: new Date(), note: note || `Status updated to ${status}` }
    ];

    await updateDoc(docRef, {
        status,
        timeline: newTimeline,
        updatedAt: serverTimestamp()
    });
};

export const cancelOrder = async (orderId: string, reason: string) => {
    const docRef = doc(db, 'orders', orderId);
    
    // Fetch to get current timeline
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Order not found");
    
    const currentOrder = docSnap.data() as Order;
    
    if (currentOrder.status !== 'received') {
        throw new Error("Order cannot be cancelled at this stage");
    }

    const newTimeline = [
        ...(currentOrder.timeline || []),
        { status: 'cancelled', timestamp: new Date(), note: `Cancelled by user: ${reason}` }
    ];

    await updateDoc(docRef, {
        status: 'cancelled',
        cancelReason: reason,
        timeline: newTimeline,
        updatedAt: serverTimestamp()
    });
};

export const updateOrderAddress = async (orderId: string, newAddress: import('@/types/shop').Address) => {
     const docRef = doc(db, 'orders', orderId);
     const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error("Order not found");
    
    const currentOrder = docSnap.data() as Order;
     if (currentOrder.status !== 'received') {
        throw new Error("Order details cannot be edited at this stage");
    }

    await updateDoc(docRef, {
        shippingAddress: newAddress,
        updatedAt: serverTimestamp()
    });
};
