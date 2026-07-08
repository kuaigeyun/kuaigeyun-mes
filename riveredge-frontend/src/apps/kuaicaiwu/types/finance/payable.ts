export interface Payable {
    id: number;
    tenant_id: number;
    payable_code: string;
    source_type: string;
    source_id: number;
    source_code: string;
    supplier_id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    due_date: string;
    payment_terms?: string;
    status: '未付款' | '部分付款' | '已结清';
    business_date: string;
    invoice_received: boolean;
    invoice_number?: string;
    reviewer_id?: number;
    reviewer_name?: string;
    review_time?: string;
    review_status: '待审核' | '已审核' | '已驳回';
    review_remarks?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    capabilities?: { push_payment?: { allowed?: boolean; reason?: string } };
}

export interface PayableListParams {
    skip?: number;
    limit?: number;
    status?: string;
    supplier_id?: number;
    pending_settlement?: boolean;
    keyword?: string;
    payable_code?: string;
    supplier_name?: string;
    review_status?: string;
    business_date_start?: string;
    business_date_end?: string;
    due_date_start?: string;
    due_date_end?: string;
    created_start_date?: string;
    created_end_date?: string;
    updated_start_date?: string;
    updated_end_date?: string;
    sort_field?: string;
    sort_order?: 'asc' | 'desc';
}

export interface PayableCreateData {
    source_type: string;
    source_id: number;
    source_code: string;
    supplier_id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount?: number;
    remaining_amount: number;
    due_date: string;
    business_date: string;
    status?: string;
    review_status?: string;
    payment_terms?: string;
    invoice_received?: boolean;
    notes?: string;
    pull_source_type?: 'purchase_order' | 'purchase_receipt';
    pull_source_id?: number;
}

export interface PaymentRecordCreate {
    payable_id?: number;
    payment_amount: number;
    payment_method?: string;
    payment_date?: string;
    transaction_reference?: string;
    reference_number?: string;
    notes?: string;
}
