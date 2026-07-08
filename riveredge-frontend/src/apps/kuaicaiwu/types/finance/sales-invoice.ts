export interface SalesInvoice {
  id: number;
  invoice_code: string;
  customer_id: number;
  customer_name: string;
  sales_order_id?: number;
  sales_order_code?: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  tax_rate: number;
  invoice_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  review_status: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  receivable_id?: number | null;
  receivable_code?: string | null;
}

export interface SalesInvoiceListParams {
  skip?: number;
  limit?: number;
  status?: string;
  customer_id?: number;
  start_date?: string;
  end_date?: string;
  keyword?: string;
  invoice_code?: string;
  customer_name?: string;
  invoice_number?: string;
  review_status?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}
