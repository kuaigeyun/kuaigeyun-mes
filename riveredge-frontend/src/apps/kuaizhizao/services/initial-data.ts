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

