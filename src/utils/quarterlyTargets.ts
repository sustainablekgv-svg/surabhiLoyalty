import { Timestamp } from 'firebase/firestore';
import { CustomerType } from '@/types/types';

/**
 * Calculate the quarterly sales target for a customer based on their joined date
 * Target is 2000 per quarter since joining
 */
export function calculateQuarterlyTarget(joinedDate: Timestamp): number {
  const now = new Date();
  const joined = joinedDate.toDate();
  
  // Calculate quarters elapsed since joining
  const quartersElapsed = getQuartersElapsed(joined, now);
  
  // Target is 2000 per quarter
  return quartersElapsed * 2000;
}

/**
 * Calculate number of quarters elapsed between two dates
 */
export function getQuartersElapsed(startDate: Date, endDate: Date): number {
  const startYear = startDate.getFullYear();
  const startQuarter = Math.floor(startDate.getMonth() / 3);
  
  const endYear = endDate.getFullYear();
  const endQuarter = Math.floor(endDate.getMonth() / 3);
  
  return (endYear - startYear) * 4 + (endQuarter - startQuarter) + 1;
}

/**
 * Get the start date of the current quarter
 */
export function getCurrentQuarterStart(): Date {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), currentQuarter * 3, 1);
}

/**
 * Get the start date of the next quarter
 */
export function getNextQuarterStart(): Date {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const nextQuarter = currentQuarter + 1;
  
  if (nextQuarter > 3) {
    // Next year, first quarter
    return new Date(now.getFullYear() + 1, 0, 1);
  } else {
    return new Date(now.getFullYear(), nextQuarter * 3, 1);
  }
}

/**
 * Check if customer has met their quarterly target
 */
export function hasMetQuarterlyTarget(customer: CustomerType): boolean {
  const totalTarget = customer.quarterlyTarget + customer.carriedForwardTarget;
  return customer.cumTotal >= totalTarget;
}

/**
 * Update customer's quarterly target and check if met
 */
export function updateCustomerQuarterlyTarget(customer: CustomerType): Partial<CustomerType> {
  const newTarget = calculateQuarterlyTarget(customer.joinedDate);
  const targetMet = hasMetQuarterlyTarget({ ...customer, quarterlyTarget: newTarget });
  
  return {
    quarterlyTarget: newTarget,
    targetMet,
    coinsFrozen: !targetMet, // Freeze coins if target not met
  };
}

/**
 * Calculate carried forward target for next quarter if current target not met
 */
export function calculateCarriedForwardTarget(customer: CustomerType): number {
  if (customer.targetMet) {
    return 0; // No carryforward if target was met
  }
  
  const totalTarget = customer.quarterlyTarget + customer.carriedForwardTarget;
  const shortfall = Math.max(0, totalTarget - customer.cumTotal);
  
  return shortfall;
}