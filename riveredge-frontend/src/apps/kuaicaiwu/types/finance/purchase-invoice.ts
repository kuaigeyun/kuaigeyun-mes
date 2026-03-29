export interface PurchaseInvoice {
    id: number;
    tenant_id: number;
    invoice_code: string;
    purchase_order_id: number;
    purchase_order_code: string;
    supplier_id: number;
    supplier_name: string;
    invoice_number: string;
    invoice_date: string;
    invoice_type: string;
    tax_rate: number;
    invoice_amount: number;
    tax_amount: number;
    total_amount: number;
    status: string;
    reviewer_id?: number;
    reviewer_name?: string;
    review_time?: string;
    review_status: string;
    review_remarks?: string;
    payable_id?: number;
    payable_code?: string;
    attachment_path?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface PurchaseInvoiceListParams {
    skip?: number;
    limit?: number;
    status?: string;
    supplier_id?: number;
    purchase_order_id?: number;
}

export interface PurchaseInvoiceCreateData {
    invoice_code?: string;
    purchase_order_id?: number;
    purchase_order_code?: string;
    supplier_id: number;
    supplier_name: string;
    invoice_number: string;
    invoice_date: string;
    invoice_type: string;
    tax_rate: number;
    invoice_amount: number;
    tax_amount: number;
    total_amount: number;
    status?: string;
    review_status?: string;
    payable_id?: number;
    payable_code?: string;
    notes?: string;
}
