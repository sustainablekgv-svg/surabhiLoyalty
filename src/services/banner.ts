import { db } from '@/lib/firebase';
import { Banner } from '@/types/shop';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    writeBatch
} from 'firebase/firestore';

const BANNERS_COLLECTION = 'banners';

export const getBanners = async (): Promise<Banner[]> => {
    try {
        const bannersRef = collection(db, BANNERS_COLLECTION);
        const q = query(bannersRef, orderBy('displayOrder', 'asc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Banner[];
    } catch (error) {
        console.error("Error fetching banners:", error);
        throw error;
    }
};

export const getActiveBanners = async (): Promise<Banner[]> => {
    try {
        // Fetch all and filter client side is fine for small numbers, or use compound index
        const banners = await getBanners();
        return banners.filter(b => b.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
        console.error("Error fetching active banners:", error);
        throw error;
    }
};

export const addBanner = async (bannerData: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
        const bannersRef = collection(db, BANNERS_COLLECTION);
        const docRef = await addDoc(bannersRef, {
            ...bannerData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding banner:", error);
        throw error;
    }
};

export const updateBanner = async (id: string, updates: Partial<Banner>): Promise<void> => {
    try {
        const bannerRef = doc(db, BANNERS_COLLECTION, id);
        await updateDoc(bannerRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating banner:", error);
        throw error;
    }
};

export const deleteBanner = async (id: string): Promise<void> => {
    try {
        const bannerRef = doc(db, BANNERS_COLLECTION, id);
        await deleteDoc(bannerRef);
    } catch (error) {
        console.error("Error deleting banner:", error);
        throw error;
    }
};

export const updateBannerOrders = async (banners: Banner[]): Promise<void> => {
    try {
        const batch = writeBatch(db);
        
        banners.forEach((banner, index) => {
            const bannerRef = doc(db, BANNERS_COLLECTION, banner.id);
            batch.update(bannerRef, { 
                displayOrder: index,
                updatedAt: serverTimestamp() 
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("Error updating banner orders:", error);
        throw error;
    }
};
