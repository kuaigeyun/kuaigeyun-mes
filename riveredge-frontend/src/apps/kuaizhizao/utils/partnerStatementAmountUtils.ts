import type { PartnerStatementLine } from '../services/finance/partnerStatement';
import type { Key } from 'react';
import { formatCurrencyAmount } from '../../../utils/format';

export const partnerStatementMoney = (v: number | string | undefined) => formatCurrencyAmount(v ?? 0, '¥0.00');

export function lineUsesDebitSide(line: PartnerStatementLine): boolean {
  if (Number(line.debit ?? 0) > 0) return true;
  if (Number(line.credit ?? 0) > 0) return false;
  return true;
}

export function patchLineStatementAmount(
  line: PartnerStatementLine,
  statementAmount: number,
): PartnerStatementLine {
  const amount = Math.max(0, Number(statementAmount) || 0);
  const isDebit = lineUsesDebitSide(line);
  return {
    ...line,
    statement_amount: amount,
    debit: isDebit ? amount : 0,
    credit: isDebit ? 0 : amount,
  };
}

export function recalcPartnerStatementLines(
  openingBalance: number,
  lines: PartnerStatementLine[],
): { lines: PartnerStatementLine[]; debitTotal: number; creditTotal: number; closingBalance: number } {
  let balance = Number(openingBalance) || 0;
  let debitTotal = 0;
  let creditTotal = 0;
  const next = lines.map((ln) => {
    const debit = Number(ln.debit ?? 0);
    const credit = Number(ln.credit ?? 0);
    debitTotal += debit;
    creditTotal += credit;
    balance += debit - credit;
    return { ...ln, balance };
  });
  return {
    lines: next,
    debitTotal,
    creditTotal,
    closingBalance: balance,
  };
}

export function previewLineKey(line: PartnerStatementLine, _index?: number): string {
  // 勿用数组下标：Ant Design Table 分页时传入的是页内 index，会导致第 2 页勾选键
  // 与 allPreviewLineKeys（全量下标）不一致，表现为「第二页点不上去」。
  const docType = String(line.doc_type || '').trim();
  const docId = line.doc_id != null ? String(line.doc_id) : String(line.doc_code || '');
  return `${docType}-${docId}`;
}

export function allPreviewLineKeys(lines: PartnerStatementLine[]): string[] {
  return lines.map((ln, idx) => previewLineKey(ln, idx));
}

export function filterLinesBySelectedKeys(
  lines: PartnerStatementLine[],
  selectedKeys: Key[],
): PartnerStatementLine[] {
  const selected = new Set(selectedKeys.map(String));
  return lines.filter((ln, idx) => selected.has(previewLineKey(ln, idx)));
}

export function buildLineAmountPayload(lines: PartnerStatementLine[]) {
  return lines
    .filter((ln) => ln.doc_id != null && ln.doc_type)
    .map((ln) => ({
      doc_type: ln.doc_type,
      doc_id: Number(ln.doc_id),
      statement_amount: Number(ln.statement_amount ?? ln.debit ?? ln.credit ?? 0),
    }));
}
