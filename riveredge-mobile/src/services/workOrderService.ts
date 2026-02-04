import { apiRequest } from './api';

export interface WorkOrder {
    id: number;
    code: string;
    name: string;
    product_name: string;
    product_code: string;
    planned_quantity: number;
    completed_quantity: number;
    status: string;
    priority: string;
    planned_start_date: string;
    planned_end_date: string;
    workshop_name?: string;
    work_center_name?: string;
}

export interface WorkOrderListResponse {
    data: WorkOrder[];
    total: number;
    success: boolean;
}

/**
 * 获取工单列表
 */
export async function getWorkOrders(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    workshop_id?: number;
    work_center_id?: number;
}): Promise<WorkOrderListResponse> {
    return apiRequest('/apps/kuaizhizao/work-orders', {
        method: 'GET',
        params,
    });
}

/**
 * 获取工单详情
 */
export async function getWorkOrderDetail(workOrderId: number): Promise<WorkOrder> {
    return apiRequest(`/apps/kuaizhizao/work-orders/${workOrderId}`, {
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
