/**
 * 质量检验服务
 * 对接 /api/v1/apps/kuaizhizao/ process-inspections, incoming-inspections, finished-goods-inspections
 */

import { apiRequest } from './api';

const BASE = '/apps/kuaizhizao';

export interface ProcessInspection {
  id: number;
  inspection_code: string;
  work_order_id: number;
  work_order_code: string;
  operation_id: number;
  operation_code: string;
  operation_name: string;
  material_code: string;
  material_name: string;
  inspection_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  inspection_result: string;
  quality_status: string;
  status: string;
}

export interface IncomingInspection {
  id: number;
  inspection_code: string;
  material_code?: string;
  material_name?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  inspection_result: string;
  quality_status: string;
  status: string;
}

export interface FinishedGoodsInspection {
  id: number;
  inspection_code: string;
  work_order_id?: number;
  work_order_code?: string;
  material_code?: string;
  material_name?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  inspection_result: string;
  quality_status: string;
  status: string;
}

/** 获取过程检验单列表 */
export async function getProcessInspections(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  work_order_id?: number;
  operation_id?: number;
}): Promise<ProcessInspection[]> {
  const res = await apiRequest<any[]>(`${BASE}/process-inspections`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 获取过程检验单详情 */
export async function getProcessInspection(id: number): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>(`${BASE}/process-inspections/${id}`, { method: 'GET' });
}

/** 执行过程检验 */
export async function conductProcessInspection(
  id: number,
  data: {
    qualified_quantity: number;
    unqualified_quantity: number;
    inspection_result?: string;
    quality_status?: string;
  }
): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>(`${BASE}/process-inspections/${id}/conduct`, {
    method: 'POST',
    data,
  });
}

/** 从工单+工序创建过程检验单 */
export async function createProcessInspectionFromWorkOrder(
  workOrderId: number,
  operationId: number
): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>(`${BASE}/process-inspections/from-work-order`, {
    method: 'POST',
    params: { work_order_id: workOrderId, operation_id: operationId },
  });
}

/** 获取来料检验单详情 */
export async function getIncomingInspection(id: number): Promise<IncomingInspection> {
  return apiRequest<IncomingInspection>(`${BASE}/incoming-inspections/${id}`, { method: 'GET' });
}

/** 获取来料检验单列表 */
export async function getIncomingInspections(params?: {
  skip?: number;
  limit?: number;
  status?: string;
}): Promise<IncomingInspection[]> {
  const res = await apiRequest<any[]>(`${BASE}/incoming-inspections`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 执行来料检验 */
export async function conductIncomingInspection(
  id: number,
  data: {
    qualified_quantity: number;
    unqualified_quantity: number;
    inspection_result?: string;
    quality_status?: string;
  }
): Promise<IncomingInspection> {
  return apiRequest<IncomingInspection>(`${BASE}/incoming-inspections/${id}/conduct`, {
    method: 'POST',
    data,
  });
}

/** 获取成品检验单详情 */
export async function getFinishedGoodsInspection(id: number): Promise<FinishedGoodsInspection> {
  return apiRequest<FinishedGoodsInspection>(`${BASE}/finished-goods-inspections/${id}`, {
    method: 'GET',
  });
}

/** 获取成品检验单列表 */
export async function getFinishedGoodsInspections(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  work_order_id?: number;
}): Promise<FinishedGoodsInspection[]> {
  const res = await apiRequest<any[]>(`${BASE}/finished-goods-inspections`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 执行成品检验 */
export async function conductFinishedGoodsInspection(
  id: number,
  data: {
    qualified_quantity: number;
    unqualified_quantity: number;
    inspection_result?: string;
    quality_status?: string;
  }
): Promise<FinishedGoodsInspection> {
  return apiRequest<FinishedGoodsInspection>(`${BASE}/finished-goods-inspections/${id}/conduct`, {
    method: 'POST',
    data,
  });
}
