/**
 * 质量管理API服务
 *
 * 提供质量检验相关的API调用接口
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import { apiRequest } from '../../../services/api';

/**
 * 来料检验接口定义
 */
export interface IncomingInspection {
  id?: number;
  inspectionCode?: string;
  purchaseOrderCode: string;
  materialCode: string;
  supplierName: string;
  batchNo: string;
  quantity: number;
  inspectionStatus?: 'pending' | 'qualified' | 'unqualified' | 'conditional';
  inspectionResult?: 'pending' | 'pass' | 'fail';
  inspectorName?: string;
  inspectionDate?: string;
  remarks?: string;
}

export interface IncomingInspectionListParams {
  skip?: number;
  limit?: number;
  inspectionStatus?: string;
  supplierName?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface IncomingInspectionListResponse {
  data: IncomingInspection[];
  total: number;
  success: boolean;
}

/**
 * 过程检验接口定义
 */
export interface ProcessInspection {
  id?: number;
  inspectionCode?: string;
  workOrderCode: string;
  operationName: string;
  productCode: string;
  batchNo: string;
  quantity: number;
  inspectionStatus?: 'pending' | 'qualified' | 'unqualified' | 'conditional';
  inspectionResult?: 'pending' | 'pass' | 'fail';
  inspectorName?: string;
  inspectionDate?: string;
  remarks?: string;
}

export interface ProcessInspectionListParams {
  skip?: number;
  limit?: number;
  inspectionStatus?: string;
  workOrderCode?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface ProcessInspectionListResponse {
  data: ProcessInspection[];
  total: number;
  success: boolean;
}

/**
 * 成品检验接口定义
 */
export interface FinishedGoodsInspection {
  id?: number;
  inspectionCode?: string;
  workOrderCode: string;
  productCode: string;
  batchNo: string;
  totalQuantity: number;
  qualifiedQuantity?: number;
  unqualifiedQuantity?: number;
  inspectionStatus?: 'pending' | 'qualified' | 'unqualified' | 'conditional';
  inspectionResult?: 'pending' | 'pass' | 'fail';
  inspectorName?: string;
  inspectionDate?: string;
  remarks?: string;
}

export interface FinishedGoodsInspectionListParams {
  skip?: number;
  limit?: number;
  inspectionStatus?: string;
  workOrderCode?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface FinishedGoodsInspectionListResponse {
  data: FinishedGoodsInspection[];
  total: number;
  success: boolean;
}

// 来料检验API
export async function listIncomingInspections(params: IncomingInspectionListParams = {}): Promise<IncomingInspectionListResponse> {
  return apiRequest<IncomingInspectionListResponse>({
    url: '/apps/kuaizhizao/incoming-inspections',
    method: 'GET',
    params,
  });
}

export async function createIncomingInspection(data: IncomingInspection): Promise<IncomingInspection> {
  return apiRequest<IncomingInspection>({
    url: '/apps/kuaizhizao/incoming-inspections',
    method: 'POST',
    data,
  });
}

export async function updateIncomingInspection(id: number, data: Partial<IncomingInspection>): Promise<IncomingInspection> {
  return apiRequest<IncomingInspection>({
    url: `/apps/kuaizhizao/incoming-inspections/${id}`,
    method: 'PUT',
    data,
  });
}

export async function performIncomingInspection(id: number, result: 'pass' | 'fail', remarks?: string): Promise<IncomingInspection> {
  return apiRequest<IncomingInspection>({
    url: `/apps/kuaizhizao/incoming-inspections/${id}/conduct`,
    method: 'POST',
    data: { result, remarks },
  });
}

// 过程检验API
export async function listProcessInspections(params: ProcessInspectionListParams = {}): Promise<ProcessInspectionListResponse> {
  return apiRequest<ProcessInspectionListResponse>({
    url: '/apps/kuaizhizao/process-inspections',
    method: 'GET',
    params,
  });
}

export async function createProcessInspection(data: ProcessInspection): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>({
    url: '/apps/kuaizhizao/process-inspections',
    method: 'POST',
    data,
  });
}

export async function getProcessInspection(id: number): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>({
    url: `/apps/kuaizhizao/process-inspections/${id}`,
    method: 'GET',
  });
}

export async function updateProcessInspection(id: number, data: Partial<ProcessInspection>): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>({
    url: `/apps/kuaizhizao/process-inspections/${id}`,
    method: 'PUT',
    data,
  });
}

export async function performProcessInspection(id: number, result: 'pass' | 'fail', remarks?: string): Promise<ProcessInspection> {
  return apiRequest<ProcessInspection>({
    url: `/apps/kuaizhizao/process-inspections/${id}/conduct`,
    method: 'POST',
    data: { result, remarks },
  });
}

// 成品检验API
export async function listFinishedGoodsInspections(params: FinishedGoodsInspectionListParams = {}): Promise<FinishedGoodsInspectionListResponse> {
  return apiRequest<FinishedGoodsInspectionListResponse>({
    url: '/apps/kuaizhizao/finished-goods-inspections',
    method: 'GET',
    params,
  });
}

export async function createFinishedGoodsInspection(data: FinishedGoodsInspection): Promise<FinishedGoodsInspection> {
  return apiRequest<FinishedGoodsInspection>({
    url: '/apps/kuaizhizao/finished-goods-inspections',
    method: 'POST',
    data,
  });
}

export async function updateFinishedGoodsInspection(id: number, data: Partial<FinishedGoodsInspection>): Promise<FinishedGoodsInspection> {
  return apiRequest<FinishedGoodsInspection>({
    url: `/apps/kuaizhizao/finished-goods-inspections/${id}`,
    method: 'PUT',
    data,
  });
}

export async function performFinishedGoodsInspection(
  id: number,
  qualifiedQuantity: number,
  unqualifiedQuantity: number,
  remarks?: string
): Promise<FinishedGoodsInspection> {
  return apiRequest<FinishedGoodsInspection>({
    url: `/apps/kuaizhizao/finished-goods-inspections/${id}/conduct`,
    method: 'POST',
    data: { qualifiedQuantity, unqualifiedQuantity, remarks },
  });
}
