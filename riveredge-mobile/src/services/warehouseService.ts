/**
 * 仓储服务
 * 对接 /api/v1/apps/kuaizhizao/ production-pickings, finished-goods-receipts
 */

import { apiRequest } from './api';

const BASE = '/apps/kuaizhizao';

export interface ProductionPicking {
  id: number;
  picking_code: string;
  work_order_id?: number;
  work_order_code?: string;
  status: string;
}

export interface FinishedGoodsReceipt {
  id: number;
  receipt_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  status: string;
}

export interface ProductionReturn {
  id: number;
  return_code: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_id?: number;
  picking_code?: string;
  status: string;
}

/** 获取生产退料单列表 */
export async function getProductionReturns(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  work_order_id?: number;
  picking_id?: number;
}): Promise<ProductionReturn[]> {
  const res = await apiRequest<any[]>(`${BASE}/production-returns`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 确认退料 */
export async function confirmProductionReturn(id: number): Promise<ProductionReturn> {
  return apiRequest<ProductionReturn>(`${BASE}/production-returns/${id}/confirm`, {
    method: 'POST',
  });
}

/** 获取生产领料单列表 */
export async function getProductionPickings(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  work_order_id?: number;
}): Promise<ProductionPicking[]> {
  const res = await apiRequest<any[]>(`${BASE}/production-pickings`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 确认领料 */
export async function confirmProductionPicking(id: number): Promise<ProductionPicking> {
  return apiRequest<ProductionPicking>(`${BASE}/production-pickings/${id}/confirm`, {
    method: 'POST',
  });
}

/** 获取成品入库单列表 */
export async function getFinishedGoodsReceipts(params?: {
  skip?: number;
  limit?: number;
  status?: string;
  work_order_id?: number;
}): Promise<FinishedGoodsReceipt[]> {
  const res = await apiRequest<any[]>(`${BASE}/finished-goods-receipts`, {
    method: 'GET',
    params,
  });
  return res || [];
}

/** 确认成品入库 */
export async function confirmFinishedGoodsReceipt(id: number): Promise<FinishedGoodsReceipt> {
  return apiRequest<FinishedGoodsReceipt>(`${BASE}/finished-goods-receipts/${id}/confirm`, {
    method: 'POST',
  });
}
