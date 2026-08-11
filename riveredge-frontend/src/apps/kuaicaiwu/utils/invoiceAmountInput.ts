/** 销项/进项开票金额录入：含税与不含税互算（税率按百分数，如 13） */

export type InvoiceAmountInputMode = 'tax_exclusive' | 'tax_inclusive';

export function invoiceExclFromIncl(incl: number, taxRatePercent: number): number {
  const rate = Number(taxRatePercent) || 0;
  return Number((Number(incl || 0) / (1 + rate / 100)).toFixed(2));
}

export function invoiceInclFromExcl(excl: number, taxRatePercent: number): number {
  const rate = Number(taxRatePercent) || 0;
  return Number((Number(excl || 0) * (1 + rate / 100)).toFixed(2));
}

export function convertInvoiceAmountBetweenModes(
  amount: number,
  taxRatePercent: number,
  from: InvoiceAmountInputMode,
  to: InvoiceAmountInputMode,
): number {
  const value = Number(amount || 0);
  if (from === to) return Number(value.toFixed(2));
  if (from === 'tax_exclusive' && to === 'tax_inclusive') {
    return invoiceInclFromExcl(value, taxRatePercent);
  }
  return invoiceExclFromIncl(value, taxRatePercent);
}

export function resolveInvoiceAmountsForSubmit(
  entered: number,
  taxRatePercent: number,
  mode: InvoiceAmountInputMode,
): { invoiceAmountExcl: number; totalIncl: number } {
  const value = Number(entered || 0);
  if (mode === 'tax_inclusive') {
    const totalIncl = Number(value.toFixed(2));
    return {
      invoiceAmountExcl: invoiceExclFromIncl(totalIncl, taxRatePercent),
      totalIncl,
    };
  }
  const invoiceAmountExcl = Number(value.toFixed(2));
  return {
    invoiceAmountExcl,
    totalIncl: invoiceInclFromExcl(invoiceAmountExcl, taxRatePercent),
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
  const value = Number(entered || 0);
  const prev = Number(prevRatePercent);
  const next = Number(nextRatePercent);
  if (!(value > 0) || prev === next) return Number(value.toFixed(2));
  if (mode === 'tax_inclusive') {
    return Number(value.toFixed(2));
  }
  const incl = invoiceInclFromExcl(value, prev);
  return invoiceExclFromIncl(incl, next);
}
