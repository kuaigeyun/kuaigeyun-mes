import type { PriceTypeValue } from '../../../../components/price-type-switch/PriceTypeSwitch';

/** 销售模块产品明细表价类默认：含税 */
export const DEFAULT_SALES_PRICE_TYPE: PriceTypeValue = 'tax_inclusive';

/** 持久化/API 价类归一（未赋值时默认含税） */
export function normalizeSalesPriceType(value: unknown): PriceTypeValue {
  if (value === 'tax_inclusive' || value === 'tax_exclusive') return value;
  return DEFAULT_SALES_PRICE_TYPE;
}

/** 表单读取价类时的 fallback（未赋值时默认含税） */
export function salesFormPriceType(value: unknown): PriceTypeValue {
  if (value === 'tax_inclusive' || value === 'tax_exclusive') return value;
  return DEFAULT_SALES_PRICE_TYPE;
}
