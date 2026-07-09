/** 财务单价：导入/展示时保留原始小数精度，避免 Number() 四舍五入 */

import { spreadsheetNumberToPlainString } from '../../../utils/spreadsheetCellPlainString';

/** 将表格单元格转为单价字符串（禁止 Number() 转换） */
export function parseFinanceUnitPriceCell(value: unknown): string | null {
  const raw = spreadsheetNumberToPlainString(value);
  if (!raw) return null;
  if (!/^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) return null;
  return raw;
}

/** 列表/详情展示：原样输出，不做四舍五入或去尾零 */
export function formatFinanceUnitPrice(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim().replace(/,/g, '');
  return raw || '—';
}

/** 表单提交前规范化单价字符串 */
export function normalizeFinanceUnitPriceInput(value: unknown): string {
  const parsed = parseFinanceUnitPriceCell(value);
  if (parsed == null) {
    throw new Error('单价无效');
  }
  return parsed;
}

function fractionalDigits(value: string): number {
  const parts = value.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

function scaleDecimalString(value: string, scale: number): string {
  const [intPart, fracPart = ''] = value.split('.');
  return `${intPart}.${fracPart.padEnd(scale, '0')}`;
}

function decimalStringToScaledBigInt(value: string): bigint {
  const cleaned = value.trim().replace(/,/g, '');
  const [intPart, fracPart = ''] = cleaned.split('.');
  if (!/^\d+$/.test(intPart) || (fracPart && !/^\d+$/.test(fracPart))) {
    throw new Error('单价无效');
  }
  return BigInt(`${intPart}${fracPart}`);
}

/** 单价数值相等（按十进制比大小，不用字符串 === 或 Number 浮点） */
export function financeUnitPricesEqual(a: unknown, b: unknown): boolean {
  const sa = parseFinanceUnitPriceCell(a);
  const sb = parseFinanceUnitPriceCell(b);
  if (sa == null || sb == null) return false;
  if (sa === sb) return true;
  try {
    const scale = Math.max(fractionalDigits(sa), fractionalDigits(sb));
    const aScaled = decimalStringToScaledBigInt(scaleDecimalString(sa, scale));
    const bScaled = decimalStringToScaledBigInt(scaleDecimalString(sb, scale));
    return aScaled === bScaled;
  } catch {
    return false;
  }
}
