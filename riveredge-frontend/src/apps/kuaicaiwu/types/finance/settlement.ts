export interface SettlementRecord {
  id: number;
  tenant_id: number;
  settlement_code: string;
  partner_id: number;
  partner_name: string;
  debit_doc_type: string;
  debit_doc_id: number;
  debit_doc_code: string;
  credit_doc_type: string;
  credit_doc_id: number;
  credit_doc_code: string;
  amount: number;
  currency: string;
  settlement_date: string;
  operator_id?: number;
  operator_name?: string;
  notes?: string;
  created_at: string;
}

export interface PartnerStatement {
  id: number;
  statement_code: string;
  partner_id: number;
  partner_name: string;
  partner_type: string;
  statement_period: string;
  start_date: string;
  end_date: string;
  opening_balance: number;
  debit_total: number;
  credit_total: number;
  closing_balance: number;
  status: string;
  transaction_details?: any;
}
