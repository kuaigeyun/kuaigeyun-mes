export interface Receivable {
    id: number;
    tenant_id: number;
    receivable_code: string;
    source_type: string;
    source_id: number;
    source_code: string;
    customer_id: number;
    customer_name: string;
    total_amount: number;
    received_amount: number;
    remaining_amount: number;
    due_date: string;
    payment_terms?: string;
    status: '未收款' | '部分收款' | '已结清';
    business_date: string;
    invoice_issued: boolean;
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

export interface ReceivableListParams {
    skip?: number;
    limit?: number;
    status?: string;
    customer_id?: number;
}

export interface ReceiptRecordCreate {
    receipt_amount: number;
    receipt_method?: string;
    receipt_date?: string;
    transaction_reference?: string;
    notes?: string;
}
