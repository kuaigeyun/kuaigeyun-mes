import type { TFunction } from 'i18next';

import type { PriceTypeValue } from '../../../../components/price-type-switch/PriceTypeSwitch';
import {
  buildImportDictionaryOptionPack,
  parseImportCodedCell,
  type ImportCodeLabelMap,
} from '../../../../../utils/loadImportDictionaryValues';

/** 销售模块产品明细表价类默认：含税 */
export const DEFAULT_SALES_PRICE_TYPE: PriceTypeValue = 'tax_inclusive';

const PRICE_TYPE_I18N: ImportCodeLabelMap = {
  tax_inclusive: 'app.kuaizhizao.salesContract.priceTypeTaxInclusive',
  tax_exclusive: 'app.kuaizhizao.salesContract.priceTypeTaxExclusive',
};

const PRICE_TYPE_ALIASES: Record<string, PriceTypeValue> = {
  含税: 'tax_inclusive',
  含税单价: 'tax_inclusive',
  含税價: 'tax_inclusive',
  含稅: 'tax_inclusive',
  含稅單價: 'tax_inclusive',
  不含税: 'tax_exclusive',
  不含税单价: 'tax_exclusive',
  不含稅: 'tax_exclusive',
  不含稅單價: 'tax_exclusive',
};

function buildPriceTypeLabelMap(t: TFunction): ImportCodeLabelMap {
  return {
    tax_inclusive: t(PRICE_TYPE_I18N.tax_inclusive),
    tax_exclusive: t(PRICE_TYPE_I18N.tax_exclusive),
  };
}

/** 导入下拉：当前语言价类文案 */
export function buildImportPriceTypeOptions(t: TFunction): string[] {
  return buildImportDictionaryOptionPack(buildPriceTypeLabelMap(t)).options;
}

/** 导入单元格 → 存库价类 */
export function parseImportPriceType(raw?: string | null, t?: TFunction): PriceTypeValue {
  const v = String(raw ?? '').trim();
  if (!v) return DEFAULT_SALES_PRICE_TYPE;
  if (v === 'tax_inclusive' || v === 'tax_exclusive') return v;
  const alias = PRICE_TYPE_ALIASES[v];
  if (alias) return alias;
  if (t) {
    const parsed = parseImportCodedCell(v, buildPriceTypeLabelMap(t));
    if (parsed === 'tax_inclusive' || parsed === 'tax_exclusive') return parsed;
  }
  return DEFAULT_SALES_PRICE_TYPE;
}

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
