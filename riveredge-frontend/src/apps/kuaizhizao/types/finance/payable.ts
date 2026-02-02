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
}

export interface PayableListParams {
    skip?: number;
    limit?: number;
    status?: string;
    supplier_id?: number;
}

export interface PaymentRecordCreate {
    payment_amount: number;
    payment_method?: string;
    payment_date?: string;
    transaction_reference?: string;
    notes?: string;
}
