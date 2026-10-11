export type FinanceVoucherKind = 'receipt' | 'payment';

export type FinanceVoucherLinkRef = {
  id: number;
  code: string;
};

export type PartnerStatementBriefRef = {
  id: number;
  statement_code: string;
  statement_period: string;
  status: string;
};

export type FinanceVoucherOpenTarget = {
  kind: FinanceVoucherKind;
  id: number;
  isRefund?: boolean;
};

export type FinanceVoucherLinkFields = {
  source_voucher_id?: number;
  source_voucher_code?: string;
  source_vouchers?: FinanceVoucherLinkRef[];
  linked_refund_vouchers?: FinanceVoucherLinkRef[];
  linked_partner_statements?: PartnerStatementBriefRef[];
  capabilities?: {
    pull_receipt_refund?: { allowed?: boolean; reason?: string };
    pull_payment_refund?: { allowed?: boolean; reason?: string };
  };
};
