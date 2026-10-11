/** 销项/进项开票金额录入：含税与不含税互算（税率按百分数，如 13）
 *
 * 真源规则（与后端 finance_tax / 销售单据 documentLineAmounts 一致）：
 * - 金额一律按「分」整数运算，禁止 float 直乘税率（否则 1769911.50×1.13→1999999.99）
 * - 不含税模式：未税为真源，税额 = round(未税分×税率/100)，价税合计 = 未税+税额
 * - 含税模式：价税合计为真源，未税 = round(合计分/(1+税率))，税额 = 合计−未税
 */

export type InvoiceAmountInputMode = 'tax_exclusive' | 'tax_inclusive';

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

/** 金额分位量化（元，两位小数） */
export function quantizeMoney(value: number): number {
  return fromCents(toCents(value));
}

/** 价税合计是否超过可开票上限（两侧先量化到分） */
export function moneyExceedsMax(totalIncl: number, maxTotalIncl: number): boolean {
  return toCents(totalIncl) > toCents(maxTotalIncl);
}

/** 价税合计 → 不含税（分位反算） */
export function invoiceExclFromIncl(incl: number, taxRatePercent: number): number {
  const inclCents = toCents(incl);
  const rate = toSafeNumber(taxRatePercent);
  const factor = 1 + rate / 100;
  const exclCents = factor > 0 ? Math.round(inclCents / factor) : inclCents;
  return fromCents(exclCents);
}

/** 不含税 → 价税合计（分位正算：税额=round(未税×税率)，合计=未税+税额） */
export function invoiceInclFromExcl(excl: number, taxRatePercent: number): number {
  const exclCents = toCents(excl);
  const rate = toSafeNumber(taxRatePercent);
  const taxCents = Math.round((exclCents * rate) / 100);
  return fromCents(exclCents + taxCents);
}

export function convertInvoiceAmountBetweenModes(
  amount: number,
  taxRatePercent: number,
  from: InvoiceAmountInputMode,
  to: InvoiceAmountInputMode,
): number {
  const value = toSafeNumber(amount);
  if (from === to) return quantizeMoney(value);
  if (from === 'tax_exclusive' && to === 'tax_inclusive') {
    return invoiceInclFromExcl(value, taxRatePercent);
  }
  return invoiceExclFromIncl(value, taxRatePercent);
}

export type ResolveInvoiceAmountsOptions = {
  /** 可开票价税合计上限；不含税正算若仅因分位超出 ≤0.01，钳到上限并以含税为真源 */
  maxTotalIncl?: number;
};

/**
 * 提交前价税拆分。
 * 含税模式：合计为真源。
 * 不含税模式：未税正算；若相对可开票上限仅 0.01 分位漂移则钳制到上限。
 */
export function resolveInvoiceAmountsForSubmit(
  entered: number,
  taxRatePercent: number,
  mode: InvoiceAmountInputMode,
  options?: ResolveInvoiceAmountsOptions,
): { invoiceAmountExcl: number; totalIncl: number; taxAmount: number } {
  const value = toSafeNumber(entered);
  if (mode === 'tax_inclusive') {
    const totalIncl = quantizeMoney(value);
    const invoiceAmountExcl = invoiceExclFromIncl(totalIncl, taxRatePercent);
    return {
      invoiceAmountExcl,
      totalIncl,
      taxAmount: quantizeMoney(totalIncl - invoiceAmountExcl),
    };
  }
  const invoiceAmountExcl = quantizeMoney(value);
  let totalIncl = invoiceInclFromExcl(invoiceAmountExcl, taxRatePercent);
  const maxRaw = options?.maxTotalIncl;
  if (maxRaw != null && Number.isFinite(maxRaw) && maxRaw >= 0) {
    const maxQ = quantizeMoney(maxRaw);
    const overshoot = quantizeMoney(totalIncl - maxQ);
    if (totalIncl > maxQ && overshoot <= 0.01) {
      const clampedExcl = invoiceExclFromIncl(maxQ, taxRatePercent);
      return {
        invoiceAmountExcl: clampedExcl,
        totalIncl: maxQ,
        taxAmount: quantizeMoney(maxQ - clampedExcl),
      };
    }
  }
  return {
    invoiceAmountExcl,
    totalIncl,
    taxAmount: quantizeMoney(totalIncl - invoiceAmountExcl),
  };
}

/**
 * 税率变更时重算录入金额：
 * - 不含税模式：保持价税合计不变，按新税率反算不含税
 * - 含税模式：含税金额不变（仅折合不含税提示变化）
 */
export function recalcEnteredAmountOnTaxRateChange(
  entered: number,
  prevRatePercent: number,
  nextRatePercent: number,
  mode: InvoiceAmountInputMode,
): number {
  const value = toSafeNumber(entered);
  const prev = toSafeNumber(prevRatePercent);
  const next = toSafeNumber(nextRatePercent);
  if (!(value > 0) || prev === next) return quantizeMoney(value);
  if (mode === 'tax_inclusive') {
    return quantizeMoney(value);
  }
  const incl = invoiceInclFromExcl(value, prev);
  return invoiceExclFromIncl(incl, next);
}

/**
 * 从源单可开票合计得到默认不含税录入值。
 * 源单为含税（或缺省）时按价税合计反算；源单明确不含税时直接取合计。
 */
export function resolveInvoiceExclFromSourceTotal(
  sourceTotal: number,
  taxRatePercent: number,
  priceType?: string,
): number | undefined {
  if (!(toSafeNumber(sourceTotal) > 0)) return undefined;
  if (priceType === 'tax_exclusive') return quantizeMoney(sourceTotal);
  return invoiceExclFromIncl(sourceTotal, taxRatePercent);
}
