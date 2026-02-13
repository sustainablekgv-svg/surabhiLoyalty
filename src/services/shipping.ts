import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ShippingConfig {
    zones: Record<string, string[]>;
    rateTable: Record<string, number[]>;
    extraPerKg: Record<string, number>;
}

export const SHIPPING_ZONES: Record<string, string[]> = {
    'A': ['Telangana', 'Andhra Pradesh'],
    'B': ['Karnataka', 'Tamil Nadu', 'Kerala'],
    'C': ['Maharashtra', 'Gujarat', 'Madhya Pradesh', 'Chhattisgarh'],
    'D': ['Delhi', 'Haryana', 'Punjab', 'Uttar Pradesh', 'Rajasthan', 'Uttarakhand'],
    'E': [
        'West Bengal', 'Bihar', 'Jharkhand', 'Odisha', 'Assam', 'Meghalaya', 
        'Manipur', 'Nagaland', 'Tripura', 'Arunachal Pradesh', 'Mizoram', 'Sikkim'
    ]
};

// Start prices for 0.5kg
const BASE_RATES: Record<string, number> = {
    'A': 45, 'B': 55, 'C': 65, 'D': 75, 'E': 85
};

const RATE_TABLE: Record<string, number[]> = {
    // [0.5kg, 1kg, 2kg, 3kg, 5kg] - Price for that total weight tier
    'A': [45, 60, 90, 120, 160],
    'B': [55, 75, 110, 145, 185],
    'C': [65, 85, 130, 160, 210],
    'D': [75, 95, 150, 180, 235],
    'E': [85, 110, 165, 195, 260]
};

const EXTRA_PER_KG_AFTER_5KG: Record<string, number> = {            
    'A': 40, 'B': 45, 'C': 50, 'D': 55, 'E': 60
};

export const parseWeightToKg = (weightStr: string): number => {
    if (!weightStr) return 0.5; // Default
    const lower = weightStr.toLowerCase().trim();
    const value = parseFloat(lower.replace(/[^0-9.]/g, ''));
    
    if (isNaN(value)) return 0.5;

    if (lower.includes('kg') || lower.includes('liter') || lower.includes('litre') || lower.includes('l')) {
        return value;
    }
    if (lower.includes('g') || lower.includes('ml')) {
        return value / 1000;
    }
    
    // Default assumption if no unit found but value exists (assume kg if small, g if large? Safe to assume kg or 1 unit)
    return value; 
};

export const calculateShippingCost = (totalWeightKg: number, originZone: string, destinationState: string, config?: ShippingConfig): number => {
    const zones = (config?.zones && Object.keys(config.zones).length > 0) ? config.zones : SHIPPING_ZONES;
    const rateTable = (config?.rateTable && Object.keys(config.rateTable).length > 0) ? config.rateTable : RATE_TABLE;
    const extraPerKg = (config?.extraPerKg && Object.keys(config.extraPerKg).length > 0) ? config.extraPerKg : EXTRA_PER_KG_AFTER_5KG;

    const destZone = getZoneForState(destinationState, zones);
    
    // Effective shipping tier calculation
    // We'll use the "higher" zone between origin and destination to determine the rate tier
    // Map zones to numeric values for comparison: A=0, B=1, C=2, D=3, E=4
    const zoneMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
    const originVal = zoneMap[originZone] ?? 0;
    const destVal = zoneMap[destZone] ?? 0;
    
    // The rate used is determined by the "more expensive" zone involved
    const effectiveZoneVal = Math.max(originVal, destVal);
    const effectiveZone = Object.keys(zoneMap).find(key => zoneMap[key] === effectiveZoneVal) || 'E';

    // Minimum 0.5kg charged
    const weight = Math.max(totalWeightKg, 0.5);

    const rates = rateTable[effectiveZone] || RATE_TABLE[effectiveZone] || RATE_TABLE['E'];

    if (weight <= 0.5) return rates[0];
    if (weight <= 1) return rates[1];
    // Above 5kg
    const basePrice = rates[4]; // Cost for 5kg
    const extraWeight = Math.ceil(weight - 5); // Round up to next kg
    const extraRate = extraPerKg[effectiveZone] || EXTRA_PER_KG_AFTER_5KG[effectiveZone] || 60;
    const extraCost = extraWeight * extraRate;
    
    return basePrice + extraCost;
};

export const getZoneForState = (state: string, zones: Record<string, string[]> = SHIPPING_ZONES): string => {
    // Normalize state name for comparison
    const normalizedState = state.toLowerCase().trim();
    
    for (const [zone, states] of Object.entries(zones)) {
        if (states.some(s => s.toLowerCase() === normalizedState)) {
            return zone;
        }
    }
    // Default to Zone E (Rest of India/North-East etc implies highest cost logic usually)
    return 'E'; 
};

export const getShippingConfig = async (): Promise<ShippingConfig> => {
    try {
        const docRef = doc(db, 'settings', 'shipping');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as ShippingConfig;
        }
    } catch (error) {
        console.error("Error fetching shipping config:", error);
    }
    return {
        zones: SHIPPING_ZONES,
        rateTable: RATE_TABLE,
        extraPerKg: EXTRA_PER_KG_AFTER_5KG
    };
};

export const saveShippingConfig = async (config: ShippingConfig) => {
    const docRef = doc(db, 'settings', 'shipping');
    await setDoc(docRef, config);
};


export const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", 
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", 
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry" 
];
