import type { StoreType } from '@/types/types';

import {
  adjustedSpvGrossFromNormalized,
  computeSaleAdminCut,
  computeSaleAdminProfit,
  grossSpvPoolsFromGrossWeight,
  totalSpvGrossFromSale,
} from '../saleAdminSpv';

function mockStore(over?: Partial<StoreType>): StoreType {
  return {
    cashOnlyCommission: 10,
    surabhiCommission: 8,
    referralCommission: 5,
    sevaCommission: 5,
    shippingCommission: 2,
    bonusPercentage: 3,
    ...over,
  } as StoreType;
}

describe('saleAdminSpv — admin cut / profit (sheet formulas)', () => {
  const store = mockStore();

  it('admin cut = total SPV × (cash + referral + seva + bonus + shipping) / 100 for cash', () => {
    const total = 5000;
    const sumPct = 10 + 5 + 5 + 2 + 3; // 25
    expect(computeSaleAdminCut(total, store, 'cash')).toBe((total * sumPct) / 100);
  });

  it('admin cut uses Surabhi % instead of cash-only when payment is wallet', () => {
    const total = 1000;
    const sumPctWallet = 8 + 5 + 5 + 2 + 3; // 23
    expect(computeSaleAdminCut(total, store, 'wallet')).toBe((total * sumPctWallet) / 100);
  });

  it('admin profit with no coin redemption = total SPV × bonus % only', () => {
    const total = 4000;
    expect(computeSaleAdminProfit(total, 0, store, 'cash', 0)).toBe((total * 3) / 100);
  });

  it('admin profit with redemption = (total−adjusted)×(non-bonus)% + total×bonus%', () => {
    const total = 5000;
    const adjusted = 3500;
    const coins = 100;
    const nonBonus = 10 + 5 + 5 + 2; // 22, bonus excluded from first term
    const bonus = 3;
    const expected = ((total - adjusted) * nonBonus) / 100 + (total * bonus) / 100;
    expect(computeSaleAdminProfit(total, adjusted, store, 'cash', coins)).toBe(expected);
  });

  it('grossSpvPools matches staff-style g×m and I×m', () => {
    const m = 5;
    const I = 900;
    const coins = 100;
    const g = I + coins;
    const { totalSpvGross, adjustedSpvGross } = grossSpvPoolsFromGrossWeight(m, I, coins);
    expect(totalSpvGross).toBe(g * m);
    expect(adjustedSpvGross).toBe(I * m);
  });

  it('staff total / adjusted gross helpers align with pools', () => {
    const saleAmount = 1000;
    const mult = 5;
    const coins = 100;
    const norm = ((saleAmount - coins) * mult) / saleAmount;
    const total = totalSpvGrossFromSale(saleAmount, mult);
    const adjusted = adjustedSpvGrossFromNormalized(norm, saleAmount);
    const pools = grossSpvPoolsFromGrossWeight(mult, saleAmount - coins, coins);
    expect(total).toBe(pools.totalSpvGross);
    expect(adjusted).toBe(pools.adjustedSpvGross);
  });

  it('returns 0 for non-finite SPV or store percents', () => {
    expect(computeSaleAdminCut(NaN, store, 'cash')).toBe(0);
    expect(computeSaleAdminProfit(1000, 500, store, 'cash', NaN)).toBe(30); // treats as no coins
    expect(computeSaleAdminProfit(1000, 500, store, 'cash', 0)).toBe(30);
  });

  it('caps delta when adjusted > total (bad data)', () => {
    expect(computeSaleAdminProfit(1000, 2000, store, 'cash', 50)).toBe((1000 * 3) / 100);
  });
});
