export interface InvoiceItem {
  id?: number;
  item_name: string;
  spec_model?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
  tax_rate: number;
  tax_amount: number;
}

export interface Invoice {
  id: number;
  tenant_id: number;
  invoice_code: string;
  invoice_number: string;
  invoice_details_code?: string;
  category: 'IN' | 'OUT';
  invoice_type: string;
  partner_id: number;
  partner_name: string;
  partner_tax_no?: string;
  partner_bank_info?: string;
  partner_address_phone?: string;
  amount_excluding_tax: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number;
  invoice_date: string;
  received_date?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'VERIFIED' | 'CANCELLED';
  verification_date?: string;
  source_document_code?: string;
  attachment_uuid?: string;
  description?: string;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface InvoiceListParams {
  skip?: number;
  limit?: number;
  category?: 'IN' | 'OUT';
  status?: string;
  search?: string;
  created_start_date?: string;
  created_end_date?: string;
  updated_start_date?: string;
  updated_end_date?: string;
}

export interface InvoiceCreateData {
  invoice_number: string;
  invoice_details_code?: string;
  category: 'IN' | 'OUT';
  invoice_type: string;
  partner_id: number;
  partner_name: string;
  partner_tax_no?: string;
  partner_bank_info?: string;
  partner_address_phone?: string;
  amount_excluding_tax: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number;
  invoice_date: string;
  received_date?: string;
  status?: string;
  items: InvoiceItem[];
}

export interface InvoiceUpdateData {
  invoice_number?: string;
  status?: string;
  description?: string;
}
