/** 录入发票 — 与供应商价格明细比对 */

import { formatFinanceUnitPrice, financeUnitPricesEqual, parseFinanceUnitPriceCell } from './financeDecimal';
import { normalizeFinanceMaterialSpecKey } from './financeSpecKey';
import type { FinanceSupplierPriceLedgerRow } from '../services/haoligo';

export type InvoiceLineCompareStatus = '一致' | '未登记' | '差异';

export interface InvoiceLineCompareResult {
  status: InvoiceLineCompareStatus;
  systemUnitPrice?: string;
  supplierPriceId?: number;
}

export function buildSupplierPriceSpecIndex(
  rows: FinanceSupplierPriceLedgerRow[],
): Map<string, FinanceSupplierPriceLedgerRow> {
  const map = new Map<string, FinanceSupplierPriceLedgerRow>();
  for (const row of rows) {
    if (!row.is_active) continue;
    const key = normalizeFinanceMaterialSpecKey(row.spec ?? row.material_code);
    if (key && !map.has(key)) {
      map.set(key, row);
    }
  }
  return map;
}

function resolveUnitPriceText(value: unknown): string | null {
  return parseFinanceUnitPriceCell(value);
}

export function compareInvoiceLineToSupplierPrice(
  line: Record<string, unknown> | undefined,
  priceIndex: Map<string, FinanceSupplierPriceLedgerRow>,
): InvoiceLineCompareResult {
  if (!line || line.entry_rejected === true) {
    return { status: '一致' };
  }
  const specKey = normalizeFinanceMaterialSpecKey(line.spec ?? line.material_code ?? line.material_name);
  if (!specKey) {
    return { status: '未登记' };
  }
  const priceRow = priceIndex.get(specKey);
  if (!priceRow) {
    return { status: '未登记' };
  }
  const invoiceLiteral = resolveUnitPriceText(line.invoice_unit_price);
  const systemPrice = resolveUnitPriceText(priceRow.unit_price);
  if (financeUnitPricesEqual(invoiceLiteral, systemPrice)) {
    return {
      status: '一致',
      systemUnitPrice: systemPrice ?? formatFinanceUnitPrice(priceRow.unit_price),
      supplierPriceId: priceRow.id,
    };
  }
  return {
    status: '差异',
    systemUnitPrice: systemPrice ?? formatFinanceUnitPrice(priceRow.unit_price),
    supplierPriceId: priceRow.id,
  };
}

export function formatCompareStatusText(result: InvoiceLineCompareResult): string {
  if (result.status === '一致') return '一致';
  if (result.status === '未登记') return '未登记';
  return `差异 - 清单 ${result.systemUnitPrice ?? '—'}`;
}
