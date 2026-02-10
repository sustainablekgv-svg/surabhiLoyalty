
import { db } from '@/lib/firebase';
import { Brand, Category, Order, Product } from '@/types/shop';
import { CustomerType, StoreType } from '@/types/types';
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
    where,
    writeBatch
} from 'firebase/firestore';
import { processSaleTransaction } from './sales';

// --- Display Order Helper ---
const swapDisplayOrder = async (collectionName: string, id1: string, order1: number, id2: string, order2: number) => {
    const batch = writeBatch(db);
    const ref1 = doc(db, collectionName, id1);
    const ref2 = doc(db, collectionName, id2);
    batch.update(ref1, { displayOrder: order2, updatedAt: serverTimestamp() });
    batch.update(ref2, { displayOrder: order1, updatedAt: serverTimestamp() });
    await batch.commit();
};

export const initializeDisplayOrder = async (collectionName: string, parentField?: { field: string, value: string }) => {
    let q;
    if (parentField) {
        q = query(collection(db, collectionName), where(parentField.field, '==', parentField.value));
    } else {
        q = query(collection(db, collectionName));
    }
    
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() as any }));

    // Sort in memory to ensure everything gets an order, even if createdAt is missing
    docs.sort((a, b) => {
        const timeA = a.data.createdAt?.seconds || 0;
        const timeB = b.data.createdAt?.seconds || 0;
        if (timeA === timeB) {
            return a.id.localeCompare(b.id); // Stable fallback
        }
        return timeA - timeB;
    });

    // Batch update in chunks of 500
    const chunks = [];
    const workingDocs = [...docs];
    while (workingDocs.length > 0) {
        chunks.push(workingDocs.splice(0, 500));
    }

    let globalIndex = 1;
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((doc) => {
            batch.update(doc.ref, { displayOrder: globalIndex++, updatedAt: serverTimestamp() });
        });
        await batch.commit();
    }
};

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
    } else if (filters?.sort === 'spv_asc') {
        constraints.push(orderBy('spv', 'asc'));
    } else if (filters?.sort === 'spv_desc') {
        constraints.push(orderBy('spv', 'desc'));
    } else if (filters?.sort === 'order') {
        constraints.push(orderBy('displayOrder', 'asc'));
    } else {
        // Default to Order if exists, else Create Date
        // Note: Client fetcher usually passes 'newest' or similar. 
        // If 'newest' is passed:
        if (filters?.sort === 'newest') {
            constraints.push(orderBy('createdAt', 'desc'));
        } else {
            // Default Admin / Shop behavior if specified
            constraints.push(orderBy('displayOrder', 'asc')); 
            // Warning: If displayOrder is mixed missing/present, this might drop items.
            // Client should request 'order' explicitly if they want it.
        }
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
  // Note: Removed orderBy from query to avoid need for Composite Index (isActive + isVisible + displayOrder)
  // We sort client-side instead.
  const q = query(
      collection(db, 'products'), 
      where('isActive', '==', true),
      where('isVisible', '==', true)
  );
  const snapshot = await getDocs(q);
  const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  
  // Client-side sort
  return products.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
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
  // Get max order
  const q = query(collection(db, 'products'), orderBy('displayOrder', 'desc'), limit(1));
  const snap = await getDocs(q);
  const maxOrder = snap.empty ? 0 : (snap.docs[0].data().displayOrder || 0);

  const docRef = await addDoc(collection(db, 'products'), {
    ...product,
    displayOrder: maxOrder + 1,
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

export const reorderProduct = async (id: string, currentOrder: number, direction: 'up' | 'down', brandId?: string) => {
    // Determine neighbor
    const op = direction === 'up' ? '<' : '>';
    const sort = direction === 'up' ? 'desc' : 'asc';
    
    let q;
    
    if (brandId) {
        // Find neighbor in SAME brand
        q = query(
            collection(db, 'products'), 
            where('brandId', '==', brandId),
            where('displayOrder', op, currentOrder), 
            orderBy('displayOrder', sort), 
            limit(1)
        );
    } else {
        // Find neighbor GLOBALLY
        q = query(
            collection(db, 'products'), 
            where('displayOrder', op, currentOrder), 
            orderBy('displayOrder', sort), 
            limit(1)
        );
    }
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const neighbor = snapshot.docs[0];
        const neighborData = neighbor.data() as Product;
        const neighborOrder = neighborData.displayOrder || 0; // Fallback 0
        await swapDisplayOrder('products', id, currentOrder, neighbor.id, neighborOrder);
    }
};

// --- Categories ---
export const getCategories = async (
    pageSize: number = 100, // Default large for dropdowns, but can be limited for table
    lastDoc?: any,
    search?: string
): Promise<{ categories: Category[]; lastDoc: any }> => {
    const q = query(collection(db, 'categories'));
    const snapshot = await getDocs(q);
    
    let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    
    // In-memory sort to handle missing displayOrder
    categories.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));

    if (search) {
        categories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }

    const start = lastDoc ? categories.findIndex(c => c.id === (typeof lastDoc === 'string' ? lastDoc : lastDoc.id)) + 1 : 0;
    const paginated = categories.slice(start, start + pageSize);
    const newLastDoc = paginated[paginated.length - 1];

    return { categories: paginated, lastDoc: newLastDoc };
};

export const createCategory = async (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const q = query(collection(db, 'categories'), orderBy('displayOrder', 'desc'), limit(1));
    const snap = await getDocs(q);
    const maxOrder = snap.empty ? 0 : (snap.docs[0].data().displayOrder || 0);

    const docRef = await addDoc(collection(db, 'categories'), {
        ...category,
        displayOrder: maxOrder + 1,
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

export const reorderCategory = async (id: string, currentOrder: number, direction: 'up' | 'down') => {
    const op = direction === 'up' ? '<' : '>';
    const sort = direction === 'up' ? 'desc' : 'asc';
    
    const q = query(
        collection(db, 'categories'), 
        where('displayOrder', op, currentOrder), 
        orderBy('displayOrder', sort), 
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const neighbor = snapshot.docs[0];
        await swapDisplayOrder('categories', id, currentOrder, neighbor.id, neighbor.data().displayOrder);
    }
};


// --- Brands ---

export const getBrands = async (categoryId?: string): Promise<Brand[]> => {
    try {
        let q;
        if (categoryId && categoryId !== 'all') {
             // Query brands where categoryIds array contains the requested categoryId
             q = query(collection(db, 'brands'), where('categoryIds', 'array-contains', categoryId));
        } else {
             q = query(collection(db, 'brands'), orderBy('displayOrder', 'asc'));
        }
        const snapshot = await getDocs(q);
        const brands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Brand));

        // Client-side sort based on the specific category context
        if (categoryId && categoryId !== 'all') {
            return brands.sort((a, b) => {
                const orderA = a.categoryOrders?.[categoryId] ?? a.displayOrder ?? 0;
                const orderB = b.categoryOrders?.[categoryId] ?? b.displayOrder ?? 0;
                return orderA - orderB;
            });
        }
        
        // Return sorted by global displayOrder (or migration fallback)
        return brands.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    } catch (e) {
        console.warn("getBrands query failed, falling back to basic fetch", e);
        const q = query(collection(db, 'brands'));
        const snapshot = await getDocs(q);
        const brands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Brand));
        
        // Basic filtered fallback
        let filtered = brands;
        if (categoryId && categoryId !== 'all') {
            filtered = brands.filter(b => b.categoryIds?.includes(categoryId) || b.categoryId === categoryId);
        }
        
        return filtered.sort((a, b) => {
             const orderA = (categoryId ? a.categoryOrders?.[categoryId] : null) ?? a.displayOrder ?? 0;
             const orderB = (categoryId ? b.categoryOrders?.[categoryId] : null) ?? b.displayOrder ?? 0;
             return orderA - orderB;
        });
    }
};

export const getBrandsPaginated = async (
    pageSize: number = 10,
    lastDoc?: any,
    search?: string
): Promise<{ brands: Brand[]; lastDoc: any }> => {
    const constraints: any[] = [orderBy('displayOrder', 'asc')];

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

// Helper to get Brands filtered (for Admin List)
// We reuse getBrandsPaginated but add filtering logic
export const getBrandsFiltered = async (
    pageSize: number = 10,
    lastDoc?: any,
    search?: string,
    categoryId?: string
): Promise<{ brands: Brand[]; lastDoc: any }> => {
    const constraints: any[] = [];
    
    if (categoryId && categoryId !== 'all') {
        constraints.push(where('categoryId', '==', categoryId));
        constraints.push(orderBy('displayOrder', 'asc'));
    } else {
        constraints.push(orderBy('displayOrder', 'asc')); 
    }

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
    const q = query(collection(db, 'categories'));
    const snapshot = await getDocs(q);
    let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    
    // Sort by creation date or fallback
    categories.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 1;
        return timeB - timeA;
    });

    if (search) {
        categories = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    }
    
    const start = lastDoc ? categories.findIndex(c => c.id === (typeof lastDoc === 'string' ? lastDoc : lastDoc.id)) + 1 : 0;
    const paginated = categories.slice(start, start + pageSize);
    const newLastDoc = paginated[paginated.length - 1];

    return { categories: paginated, lastDoc: newLastDoc };
}

export const createBrand = async (brand: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    // 1. Initialize orders for each category
    const categoryOrders: { [key: string]: number } = {};
    const categoryIds = brand.categoryIds || (brand.categoryId ? [brand.categoryId] : []);
    
    // We'll calculate max order for each category. This assumes low concurrency.
    // Ideally we'd use a transaction or aggregation, but for this scale, client-side max finding via query is okay.
    for (const catId of categoryIds) {
        try {
            // Find max order in this category
            // Fallback: fetch all active brands in this category and find max
            // Note: Optimizing to just fetch fields if possible, but Firestore fetches full docs.
            const q = query(collection(db, 'brands'), where('categoryIds', 'array-contains', catId));
            const snap = await getDocs(q);
            
            let maxOrder = 0;
            if (!snap.empty) {
                // Parse and find max
                 const orders = snap.docs.map(d => {
                     const b = d.data();
                     return b.categoryOrders?.[catId] ?? b.displayOrder ?? 0;
                 });
                 maxOrder = Math.max(...orders);
            }
            categoryOrders[catId] = maxOrder + 1;
        } catch (e) {
            console.error(`Failed to calc order for cat ${catId}`, e);
            categoryOrders[catId] = 1;
        }
    }

    // Determine primary displayOrder (legacy fallback)
    const primaryOrder = Object.values(categoryOrders).length > 0 ? Math.max(...Object.values(categoryOrders)) : 0;

    const docRef = await addDoc(collection(db, 'brands'), {
        ...brand,
        categoryIds, // Ensure this array is present
        categoryOrders,
        displayOrder: primaryOrder, // Legacy fallback
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

export const reorderBrand = async (id: string, currentOrder: number, direction: 'up' | 'down', categoryId?: string) => {
    // Global Reorder
    if (!categoryId) {
        const op = direction === 'up' ? '<' : '>';
        const sort = direction === 'up' ? 'desc' : 'asc';
        
        const q = query(
            collection(db, 'brands'), 
            where('displayOrder', op, currentOrder), 
            orderBy('displayOrder', sort), 
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const neighbor = snapshot.docs[0];
            const neighborData = neighbor.data() as Brand;
            await swapDisplayOrder('brands', id, currentOrder, neighbor.id, neighborData.displayOrder || 0);
        }
        return;
    }

    // Contextual Reorder (Category Specific)
    const q = query(collection(db, 'brands'), where('categoryIds', 'array-contains', categoryId));
    const snapshot = await getDocs(q);
    const brands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    brands.sort((a, b) => {
        const orderA = a.categoryOrders?.[categoryId] ?? a.displayOrder ?? 0;
        const orderB = b.categoryOrders?.[categoryId] ?? b.displayOrder ?? 0;
        return orderA - orderB;
    });

    const currentIndex = brands.findIndex(b => b.id === id);
    if (currentIndex === -1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= brands.length) return; 

    const targetBrand = brands[swapIndex];
    
    const brandOrder = brands[currentIndex].categoryOrders?.[categoryId] ?? brands[currentIndex].displayOrder ?? 0;
    const targetOrder = targetBrand.categoryOrders?.[categoryId] ?? targetBrand.displayOrder ?? 0;

    const batch = writeBatch(db);
    const brandRef = doc(db, 'brands', id);
    const targetRef = doc(db, 'brands', targetBrand.id);

    batch.update(brandRef, { [`categoryOrders.${categoryId}`]: targetOrder, updatedAt: serverTimestamp() });
    batch.update(targetRef, { [`categoryOrders.${categoryId}`]: brandOrder, updatedAt: serverTimestamp() });

    await batch.commit();
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

export const updateOrderTotal = async (orderId: string, newTotal: number) => {
    const docRef = doc(db, 'orders', orderId);
    await updateDoc(docRef, {
        totalAmount: newTotal,
        updatedAt: serverTimestamp()
    });
};

const getStoreByLocation = async (location: string): Promise<StoreType | null> => {
    try {
        const q = query(collection(db, 'stores'), where('storeLocation', '==', location));
        const snap = await getDocs(q);
        if (!snap.empty) {
            return { id: snap.docs[0].id, ...snap.docs[0].data() } as StoreType;
        }
        // Fallback to Main Store or Demo Store if not found
        const q2 = query(collection(db, 'stores'), limit(1)); // Just get first one? Or strict?
        const snap2 = await getDocs(q2);
        if(!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() } as StoreType;
        return null;
    } catch (e) {
        console.error("Error fetching store", e);
        return null;
    }
};

const getCustomerById = async (userId: string): Promise<CustomerType | null> => {
    try {
        const docRef = doc(db, 'Customers', userId);
        const snap = await getDoc(docRef);
        if (snap.exists()) return { id: snap.id, ...snap.data() } as CustomerType;
        
        // Fallback search by userId as customerMobile? No, userId should be doc ID.
        // But if auth is via phone, generic userId might not match docId if different auth system.
        // Assuming userId IS Customer Doc ID (as per AuthContext).
        return null;
    } catch (e) {
        console.error("Error fetching customer", e);
        return null;
    }
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

    const updates: any = {
        status,
        timeline: newTimeline,
        updatedAt: serverTimestamp()
    };

    // Trigger Rewards processing on Confirmation
    if (status === 'confirmed' && !(currentOrder as any).rewardsProcessed) {
        try {
            const customer = await getCustomerById(currentOrder.userId);
            if (customer) {
                // Determine Store
                // Use customer store location, or fallback
                const storeLocation = customer.storeLocation || 'Main Store'; 
                const store = await getStoreByLocation(storeLocation);
                
                if (store) {
                    await processSaleTransaction({
                        orderId: currentOrder.id,
                        invoiceId: `INV-${currentOrder.id.slice(0,6).toUpperCase()}`,
                        amount: currentOrder.totalAmount,
                        customer: customer,
                        storeDetails: store,
                        user: { staffName: 'Online Admin', role: 'admin' },
                        paymentMethod: currentOrder.paymentMethod || 'online',
                        totalSpv: currentOrder.items.reduce((acc, item) => acc + (Number(item.spv || 0) * item.quantity), 0), // Calculate Total SPV from items
                        surabhiCoinsUsed: currentOrder.surabhiCoinsUsed || 0
                    });
                    updates.rewardsProcessed = true;
                    // Note: Activity log is added by processSaleTransaction
                } else {
                    console.error("Store not found for rewards processing");
                    updates.rewardsError = "Store not found";
                }
            } else {
                console.error("Customer not found for rewards processing");
                updates.rewardsError = "Customer not found";
            }
        } catch (error) {
            console.error("Error processing rewards", error);
            updates.rewardsError = "Processing Failed";
        }
    }

    await updateDoc(docRef, updates);
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
