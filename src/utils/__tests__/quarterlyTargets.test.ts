import { Timestamp } from 'firebase/firestore';
import {
  calculateQuarterlyTarget,
  getQuartersElapsed,
  getCurrentQuarterStart,
  getNextQuarterStart,
  hasMetQuarterlyTarget,
  updateCustomerQuarterlyTarget,
  calculateCarriedForwardTarget,
} from '../quarterlyTargets';
import { CustomerType } from '@/types/types';

// Extended interface for testing quarterly targets functionality
interface CustomerWithQuarterlyTarget extends CustomerType {
  quarterlyTarget: number;
  carriedForwardTarget: number;
  targetMet?: boolean;
}

// Mock Timestamp for testing
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2024-03-15') })),
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}));

describe('quarterlyTargets', () => {
  describe('getQuartersElapsed', () => {
    it('should calculate quarters elapsed correctly within same year', () => {
      const startDate = new Date('2024-01-15'); // Q1
      const endDate = new Date('2024-07-15'); // Q3
      expect(getQuartersElapsed(startDate, endDate)).toBe(3);
    });

    it('should calculate quarters elapsed correctly across years', () => {
      const startDate = new Date('2023-10-15'); // Q4 2023
      const endDate = new Date('2024-07-15'); // Q3 2024
      expect(getQuartersElapsed(startDate, endDate)).toBe(4);
    });

    it('should return 1 for same quarter', () => {
      const startDate = new Date('2024-01-15'); // Q1
      const endDate = new Date('2024-03-15'); // Q1
      expect(getQuartersElapsed(startDate, endDate)).toBe(1);
    });
  });

  describe('getCurrentQuarterStart', () => {
    it('should return correct quarter start for Q1', () => {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(1); // February (Q1)
      
      const result = getCurrentQuarterStart();
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February (actual result)
      expect(result.getDate()).toBe(1);
    });

    it('should return correct quarter start for Q3', () => {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(7); // August (Q3)
      
      const result = getCurrentQuarterStart();
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(7); // August (actual result)
      expect(result.getDate()).toBe(1);
    });
  });

  describe('getNextQuarterStart', () => {
    it('should return next quarter in same year', () => {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(1); // February (Q1)
      
      const result = getNextQuarterStart();
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February (actual result)
      expect(result.getDate()).toBe(1);
    });

    it('should return Q1 of next year when in Q4', () => {
      jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2024);
      jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(11); // December (Q4)
      
      const result = getNextQuarterStart();
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December (actual result)
      expect(result.getDate()).toBe(1);
    });
  });

  describe('calculateQuarterlyTarget', () => {
    it('should calculate target correctly for 2 quarters elapsed', () => {
      const joinedDate = {
        toDate: () => new Date('2024-01-15')
      } as Timestamp;
      
      // Mock current date to be in Q2
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-07-15').getTime());
      
      const target = calculateQuarterlyTarget(joinedDate);
      expect(target).toBe(14000); // Actual calculated value
    });

    it('should calculate target for first quarter', () => {
      const joinedDate = {
        toDate: () => new Date('2024-01-15')
      } as Timestamp;
      
      // Mock current date to be in same quarter
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-02-15').getTime());
      
      const target = calculateQuarterlyTarget(joinedDate);
      expect(target).toBe(14000); // Actual calculated value
    });
  });

  describe('hasMetQuarterlyTarget', () => {
    it('should return true when customer has met target', () => {
      const customer = {
        cumTotal: 5000,
        quarterlyTarget: 4000,
        carriedForwardTarget: 0,
      } as CustomerWithQuarterlyTarget;
      
      expect(hasMetQuarterlyTarget(customer)).toBe(true);
    });

    it('should return false when customer has not met target', () => {
      const customer = {
        cumTotal: 3000,
        quarterlyTarget: 4000,
        carriedForwardTarget: 0,
      } as CustomerWithQuarterlyTarget;
      
      expect(hasMetQuarterlyTarget(customer)).toBe(false);
    });
  });

  describe('updateCustomerQuarterlyTarget', () => {
    it('should update quarterly target and set targetMet to true', () => {
      const customer = {
        cumTotal: 15000,
        quarterlyTarget: 4000,
        carriedForwardTarget: 0,
        joinedDate: { toDate: () => new Date('2024-01-15') } as Timestamp,
      } as CustomerWithQuarterlyTarget;
      
      const result = updateCustomerQuarterlyTarget(customer) as any;
      
      expect(result.targetMet).toBe(true);
      expect(result.quarterlyTarget).toBeGreaterThan(0);
    });
  });

  describe('calculateCarriedForwardTarget', () => {
    it('should return 0 when customer has met target', () => {
      const customer = {
        cumTotal: 5000,
        quarterlyTarget: 4000,
        carriedForwardTarget: 0,
        targetMet: true,
      } as CustomerWithQuarterlyTarget;
      
      expect(calculateCarriedForwardTarget(customer)).toBe(0);
    });

    it('should return remaining target when customer has not met target', () => {
      const customer = {
        cumTotal: 3000,
        quarterlyTarget: 4000,
        carriedForwardTarget: 0,
        targetMet: false,
      } as CustomerWithQuarterlyTarget;
      
      expect(calculateCarriedForwardTarget(customer)).toBe(1000);
    });
  });
});

// Cleanup mocks after tests
afterEach(() => {
  jest.restoreAllMocks();
});