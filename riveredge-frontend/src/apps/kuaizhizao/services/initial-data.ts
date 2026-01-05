/**
 * 期初数据导入服务
 *
 * 提供期初数据导入相关的API调用接口
 *
 * @author Luigi Lu
 * @date 2026-01-15
 */

import { apiRequest } from '../../../services/api';

/**
 * 期初库存导入请求
 */
export interface InitialInventoryImportRequest {
  /** 二维数组数据（从 uni_import 组件传递） */
  data: any[][];
  /** 快照时间点（可选） */
  snapshot_time?: string;
}

/**
 * 期初库存导入响应
 */
export interface InitialInventoryImportResponse {
  /** 成功数量 */
  success_count: number;
  /** 失败数量 */
  failure_count: number;
  /** 错误列表 */
  errors: Array<{
    row: number;
    error: string;
  }>;
  /** 总数 */
  total: number;
}

/**
 * 导入期初库存
 */
export async function importInitialInventory(
  data: any[][],
  snapshotTime?: string
): Promise<InitialInventoryImportResponse> {
  return apiRequest<InitialInventoryImportResponse>({
    url: '/apps/kuaizhizao/initial-data/inventory/import',
    method: 'POST',
    data: {
      data,
      snapshot_time: snapshotTime,
    },
  });
}

/**
 * 导入期初在制品
 */
export async function importInitialWIP(
  data: any[][],
  snapshotTime?: string
): Promise<InitialInventoryImportResponse> {
  return apiRequest<InitialInventoryImportResponse>({
    url: '/apps/kuaizhizao/initial-data/wip/import',
    method: 'POST',
    data: {
      data,
      snapshot_time: snapshotTime,
    },
  });
}

/**
 * 导入期初应收应付
 */
export async function importInitialReceivablesPayables(
  data: any[][],
  snapshotTime?: string
): Promise<InitialInventoryImportResponse> {
  return apiRequest<InitialInventoryImportResponse>({
    url: '/apps/kuaizhizao/initial-data/receivables-payables/import',
    method: 'POST',
    data: {
      data,
      snapshot_time: snapshotTime,
    },
  });
}

/**
 * 上线倒计时
 */
export interface LaunchCountdown {
  id: number;
  tenant_id: number;
  launch_date: string;
  snapshot_time?: string;
  status: string;
  progress?: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 创建或更新上线倒计时
 */
export async function createOrUpdateCountdown(
  launchDate: string,
  snapshotTime?: string
): Promise<LaunchCountdown> {
  return apiRequest<LaunchCountdown>({
    url: '/apps/kuaizhizao/initial-data/countdown',
    method: 'POST',
    data: {
      launch_date: launchDate,
      snapshot_time: snapshotTime,
    },
  });
}

/**
 * 获取上线倒计时
 */
export async function getCountdown(): Promise<LaunchCountdown | null> {
  return apiRequest<LaunchCountdown | null>({
    url: '/apps/kuaizhizao/initial-data/countdown',
    method: 'GET',
  });
}

/**
 * 动态数据补偿请求
 */
export interface DataCompensationRequest {
  snapshot_time: string;
  launch_date: string;
}

/**
 * 动态数据补偿响应
 */
export interface DataCompensationResponse {
  inventory_compensation: {
    success_count: number;
    failure_count: number;
    errors: any[];
  };
  wip_compensation: {
    success_count: number;
    failure_count: number;
    errors: any[];
  };
  receivables_payables_compensation: {
    success_count: number;
    failure_count: number;
    errors: any[];
  };
  total_compensation_count: number;
}

/**
 * 计算动态数据补偿
 */
export async function calculateCompensation(
  snapshotTime: string,
  launchDate: string
): Promise<DataCompensationResponse> {
  return apiRequest<DataCompensationResponse>({
    url: '/apps/kuaizhizao/initial-data/compensation',
    method: 'POST',
    data: {
      snapshot_time: snapshotTime,
      launch_date: launchDate,
    },
  });
}

