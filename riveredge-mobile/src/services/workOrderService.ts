import { apiRequest } from './api';

export interface WorkOrder {
    id: number;
    code: string;
    name?: string;
    product_name: string;
    product_code: string;
    planned_quantity: number;
    completed_quantity: number;
    status: string;
    priority: string;
    planned_start_date?: string;
    planned_end_date?: string;
    workshop_name?: string;
    work_center_name?: string;
}

export interface WorkOrderStatistics {
    in_progress_count: number;
    completed_today_count: number;
    overdue_count: number;
    draft_count: number;
    completed_count: number;
}

export interface WorkOrderListResponse {
    data: WorkOrder[];
    total: number;
    success: boolean;
}

/** 获取工单统计（首屏指标卡片） */
export async function getWorkOrderStatistics(): Promise<WorkOrderStatistics> {
    return apiRequest<WorkOrderStatistics>('/apps/kuaizhizao/work-orders/statistics', { method: 'GET' });
}

/**
 * 获取逾期工单列表（对接 GET /work-orders/delayed）
 */
export async function getDelayedWorkOrders(): Promise<WorkOrder[]> {
    const res = await apiRequest<{ total: number; delayed_orders: any[] }>(
        '/apps/kuaizhizao/work-orders/delayed',
        { method: 'GET' }
    );
    const list = res?.delayed_orders || [];
    return list.map((item: any) => ({
        id: item.work_order_id,
        code: item.work_order_code,
        name: item.work_order_name,
        product_name: item.product_name || '',
        product_code: '',
        planned_quantity: 0,
        completed_quantity: 0,
        status: item.status || 'in_progress',
        priority: item.priority || 'normal',
        planned_end_date: item.planned_end_date,
        planned_start_date: undefined,
        workshop_name: undefined,
        work_center_name: undefined,
    }));
}

/**
 * 获取工单列表
 */
export async function getWorkOrders(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    code?: string;
    workshop_id?: number;
    work_center_id?: number;
    assigned_worker_id?: number;
}): Promise<WorkOrderListResponse> {
    const res = await apiRequest<{ data: any[]; total: number; success: boolean }>('/apps/kuaizhizao/work-orders', {
        method: 'GET',
        params,
    });
    const data = (res.data || []).map((item: any) => ({
        ...item,
        planned_quantity: item.planned_quantity ?? item.quantity ?? 0,
        completed_quantity: item.completed_quantity ?? 0,
    }));
    return { ...res, data };
}

/**
 * 获取工单详情
 */
export async function getWorkOrderDetail(workOrderId: number): Promise<WorkOrder> {
    const res = await apiRequest<any>(`/apps/kuaizhizao/work-orders/${workOrderId}`, {
        method: 'GET',
    });
    return {
        ...res,
        planned_quantity: res.planned_quantity ?? res.quantity ?? 0,
        completed_quantity: res.completed_quantity ?? 0,
    };
}

export interface WorkOrderOperation {
    id: number;
    operation_id: number;
    operation_code: string;
    operation_name: string;
    sequence: number;
    status: string;
    completed_quantity?: number;
    qualified_quantity?: number;
    unqualified_quantity?: number;
    assigned_worker_id?: number;
    assigned_worker_name?: string;
}

/**
 * 获取工单工序列表
 */
export async function getWorkOrderOperations(workOrderId: number): Promise<WorkOrderOperation[]> {
    return apiRequest<WorkOrderOperation[]>(`/apps/kuaizhizao/work-orders/${workOrderId}/operations`, {
        method: 'GET',
    });
}

/**
 * 开始工序
 */
export async function startOperation(workOrderId: number, operationId: number) {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}/operations/${operationId}/start`, {
        method: 'POST',
    });
}
