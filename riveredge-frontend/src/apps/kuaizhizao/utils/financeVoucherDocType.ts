import type { FinanceVoucherKind, FinanceVoucherOpenTarget } from '../types/finance/financeVoucherLinks';
import type { PartnerStatementLine } from '../services/finance/partnerStatement';

const PARTNER_STATEMENT_VOUCHER_DOC_TYPES: Record<string, FinanceVoucherOpenTarget> = {
  收款单: { kind: 'receipt', id: 0, isRefund: false },
  收款退款: { kind: 'receipt', id: 0, isRefund: true },
  付款单: { kind: 'payment', id: 0, isRefund: false },
  付款退款: { kind: 'payment', id: 0, isRefund: true },
};

export function isPartnerStatementFinanceVoucherLine(line: PartnerStatementLine): boolean {
  return Boolean(line.doc_id && PARTNER_STATEMENT_VOUCHER_DOC_TYPES[line.doc_type ?? '']);
}

export function resolvePartnerStatementVoucherTarget(
  line: PartnerStatementLine,
): FinanceVoucherOpenTarget | null {
  const template = PARTNER_STATEMENT_VOUCHER_DOC_TYPES[line.doc_type ?? ''];
  if (!template || line.doc_id == null) return null;
  return { kind: template.kind, id: Number(line.doc_id), isRefund: template.isRefund };
}

export function financeVoucherRefundListPath(kind: FinanceVoucherKind): string {
  return kind === 'receipt'
    ? '/apps/kuaicaiwu/finance-management/receipt-refunds'
    : '/apps/kuaicaiwu/finance-management/payment-refunds';
}

export function canCreateRefundFromVoucher(
  record: {
    status?: string;
    settlement_type?: string;
    refund_execution_status?: string;
    total_amount?: number;
    refunded_amount?: number;
    capabilities?: {
      pull_receipt_refund?: { allowed?: boolean };
      pull_payment_refund?: { allowed?: boolean };
    };
  },
  kind: FinanceVoucherKind,
): boolean {
  if (String(record.settlement_type || 'normal') === 'refund') return false;
  if (record.status !== 'Confirmed') return false;
  const capKey = kind === 'receipt' ? 'pull_receipt_refund' : 'pull_payment_refund';
  if (record.capabilities?.[capKey]?.allowed === false) return false;
  if (record.capabilities?.[capKey]?.allowed === true) return true;
  if (record.refund_execution_status === '全部退款') return false;
  const total = Number(record.total_amount ?? 0);
  const refunded = Number(record.refunded_amount ?? 0);
  return total > refunded;
}

/** 收/付款纠错（撤回确认/作废/删除）：无退款即可；已确认会由后端冲回核销与银行流水 */
export function canCorrectFinanceVoucher(record: {
  status?: string;
  settlement_type?: string;
  refund_execution_status?: string;
  refunded_amount?: number;
}): boolean {
  if (String(record.settlement_type || 'normal') === 'refund') return false;
  if (isFinanceVoucherCorrectionBlockedByRefund(record)) return false;
  return true;
}

/** 因已发生退款而禁止原单纠错（须先撤回相关退款确认） */
export function isFinanceVoucherCorrectionBlockedByRefund(record: {
  settlement_type?: string;
  refund_execution_status?: string;
  refunded_amount?: number;
}): boolean {
  if (String(record.settlement_type || 'normal') === 'refund') return false;
  const refunded = Number(record.refunded_amount ?? 0);
  if (refunded > 0) return true;
  const refundExec = String(record.refund_execution_status || '').trim();
  return refundExec === '部分退款' || refundExec === '全部退款';
}
