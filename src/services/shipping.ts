
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

export const getZoneForState = (state: string): string => {
    // Normalize state name for comparison
    const normalizedState = state.toLowerCase().trim();
    
    for (const [zone, states] of Object.entries(SHIPPING_ZONES)) {
        if (states.some(s => s.toLowerCase() === normalizedState)) {
            return zone;
        }
    }
    // Default to Zone E (Rest of India/North-East etc implies highest cost logic usually)
    return 'E'; 
};

export const parseWeight = (weightStr: string): number => {
    if (!weightStr) return 0.5; // Default weight
    
    const str = weightStr.toLowerCase().trim();
    if (str.includes('kg')) {
        return parseFloat(str.replace('kg', ''));
    } else if (str.includes('g') && !str.includes('kg')) {
        return parseFloat(str.replace('g', '')) / 1000;
    }
    return parseFloat(str) || 0.5;
};

export const calculateShippingCost = (totalWeightKg: number, state: string): number => {
    const zone = getZoneForState(state);
    
    // Minimum 0.5kg charged
    const weight = Math.max(totalWeightKg, 0.5);

    if (weight <= 0.5) return RATE_TABLE[zone][0];
    if (weight <= 1) return RATE_TABLE[zone][1];
    if (weight <= 2) return RATE_TABLE[zone][2];
    if (weight <= 3) return RATE_TABLE[zone][3];
    if (weight <= 5) return RATE_TABLE[zone][4];

    // Above 5kg
    const basePrice = RATE_TABLE[zone][4]; // Cost for 5kg
    const extraWeight = Math.ceil(weight - 5); // Round up to next kg
    const extraCost = extraWeight * EXTRA_PER_KG_AFTER_5KG[zone];
    
    return basePrice + extraCost;
};

export const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", 
    "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", 
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry" 
];
