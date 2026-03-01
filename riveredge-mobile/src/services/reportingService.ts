/**
 * 报工 API 服务
 */

import { apiRequest } from './api';

export interface ReportingRecordCreate {
  work_order_id: number;
  work_order_code: string;
  work_order_name: string;
  operation_id: number;
  operation_code: string;
  operation_name: string;
  worker_id: number;
  worker_name: string;
  reported_quantity: number;
  qualified_quantity: number;
  unqualified_quantity: number;
  work_hours?: number;
  remarks?: string;
}

/**
 * 创建报工记录
 */
export async function createReporting(data: ReportingRecordCreate) {
  return apiRequest('/apps/kuaizhizao/reporting', {
    method: 'POST',
    data,
  });
}
