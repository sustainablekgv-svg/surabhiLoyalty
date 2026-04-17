import type { StoreType } from '@/types/types';

const round2 = (value: number): number => Math.round(value * 100) / 100;

const finiteNonNeg = (n: number): number =>
  Number.isFinite(n) && n > 0 ? n : 0;

export type SalePaymentMethod = 'wallet' | 'cash' | 'mixed';

function commissionSlices(store: StoreType, paymentMethod: SalePaymentMethod) {
  const pct = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const cashOnly =
    paymentMethod === 'cash' || paymentMethod === 'mixed'
      ? pct(store.cashOnlyCommission)
      : pct(store.surabhiCommission);
  return {
    cashOnly,
    referral: pct(store.referralCommission),
    seva: pct(store.sevaCommission),
    shipping: pct(store.shippingCommission),
    bonus: pct(store.bonusPercentage),
  };
}

/**
 * Admin cut (sheet): total SPV × (cash only + referral + seva + bonus + shipping),
 * with each term a percent (e.g. 2 means 2%). Cash / mixed use cash-only %; wallet uses Surabhi %.
 */
export function computeSaleAdminCut(
  totalSpvGross: number,
  store: StoreType,
  paymentMethod: SalePaymentMethod
): number {
  const t = finiteNonNeg(totalSpvGross);
  const s = commissionSlices(store, paymentMethod);
  const sumPct = s.cashOnly + s.referral + s.seva + s.shipping + s.bonus;
  if (!Number.isFinite(sumPct) || sumPct < 0) return 0;
  return round2((t * sumPct) / 100);
}

/**
 * Admin profit (sheet):
 * - No Surabhi coin redemption: total SPV × bonus %
 * - With redemption: (total SPV − adjusted SPV) × (cash only + referral + seva + shipping) % + total SPV × bonus %
 * `totalSpvGross` / `adjustedSpvGross` are the same SPV pools as staff (g×m and I×m) / online `grossSpvPoolsFromGrossWeight`.
 */
export function computeSaleAdminProfit(
  totalSpvGross: number,
  adjustedSpvGross: number,
  store: StoreType,
  paymentMethod: SalePaymentMethod,
  surabhiCoinsUsed: number
): number {
  const t = finiteNonNeg(totalSpvGross);
  const adj = Number.isFinite(adjustedSpvGross) && adjustedSpvGross >= 0 ? adjustedSpvGross : 0;
  const s = commissionSlices(store, paymentMethod);
  const nonBonusPct = s.cashOnly + s.referral + s.seva + s.shipping;
  const bonusPct = s.bonus;
  if (!Number.isFinite(nonBonusPct) || nonBonusPct < 0 || !Number.isFinite(bonusPct) || bonusPct < 0) {
    return 0;
  }
  const coins = Number(surabhiCoinsUsed);
  if (!Number.isFinite(coins) || coins <= 0) {
    return round2((t * bonusPct) / 100);
  }
  const delta = Math.max(0, t - adj);
  return round2((delta * nonBonusPct) / 100 + (t * bonusPct) / 100);
}

/** Gross SPV on full item sale: saleAmount × SPV multiplier */
export function totalSpvGrossFromSale(saleAmount: number, spvMultiplier: number): number {
  const a = Number(saleAmount);
  const m = Number(spvMultiplier);
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(m) || m < 0) return 0;
  return Number((a * m).toFixed(2));
}

/** Gross adjusted SPV pool from normalized adjusted SPV × sale amount */
export function adjustedSpvGrossFromNormalized(adjustedSpvNorm: number, saleAmount: number): number {
  const a = Number(saleAmount);
  const n = Number(adjustedSpvNorm);
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(n) || n < 0) return 0;
  return Number((n * a).toFixed(2));
}

/**
 * E‑commerce / shop: same basis as staff in-store sale.
 * - `grossSpvWeight` m = Σ (line SPV × qty) from catalog (same as staff `spvEntered` on a single line, aggregated).
 * - I = item subtotal after Surabhi coins (rupees); g = I + coins = gross item value before coin discount.
 * - Total SPV pool = g × m; adjusted pool (post coins) = I × m — used for admin cut / admin profit per sheet.
 */
export function grossSpvPoolsFromGrossWeight(
  grossSpvWeight: number,
  itemsAfterCoins: number,
  surabhiCoinsUsed: number
): { totalSpvGross: number; adjustedSpvGross: number } {
  const I = Math.max(0, Number(itemsAfterCoins) || 0);
  const coins = Math.max(0, Number(surabhiCoinsUsed) || 0);
  const g = I + coins;
  const m = Math.max(0, Number(grossSpvWeight) || 0);
  if (m <= 0 || g <= 0) {
    return { totalSpvGross: 0, adjustedSpvGross: 0 };
  }
  return {
    totalSpvGross: Number((g * m).toFixed(2)),
    adjustedSpvGross: Number((I * m).toFixed(2)),
  };
}
