import type { CurrentUser } from '../../../types/api';
import { hasPermission } from '../../../utils/permission';
import type { InboundReceiptType } from '../pages/warehouse-management/inbound/inboundHubTypes';

/** 入库 Hub 各来源对应 manifest read 权限（与后端 route access 一致） */
const INBOUND_SOURCE_READ_PERMISSION: Record<InboundReceiptType, string> = {
  purchase: 'kuaizhizao:inbound:read',
  finished_goods: 'kuaizhizao:inbound:read',
  semi_finished_goods: 'kuaizhizao:inbound:read',
  production_return: 'kuaizhizao:inbound:read',
  customer_material: 'kuaizhizao:warehouse-management-customer-material-registration:read',
  sales_return: 'kuaizhizao:sales-return:read',
  outsource_receipt: 'kuaizhizao:outsource-order:read',
  outsource_material_return: 'kuaizhizao:outsource-order:read',
  outsource_product_return: 'kuaizhizao:outsource-order:read',
  other_inbound: 'kuaizhizao:other-inbound:read',
  material_return: 'kuaizhizao:material-return:read',
};

/** 出库 Hub 各来源 read 权限；生产领料 API 在后端映射为 inbound 模块 */
export const OUTBOUND_SOURCE_READ_PERMISSION = {
  production_picking: 'kuaizhizao:inbound:read',
  sales_delivery: 'kuaizhizao:outbound:read',
  outsource_issue: 'kuaizhizao:outsource-order:read',
  other_outbound: 'kuaizhizao:other-outbound:read',
  material_borrow: 'kuaizhizao:material-borrow:read',
} as const;

export type OutboundHubSource = keyof typeof OUTBOUND_SOURCE_READ_PERMISSION;

export function canFetchInboundHubSource(
  user: CurrentUser | undefined,
  source: InboundReceiptType,
): boolean {
  return hasPermission(user, INBOUND_SOURCE_READ_PERMISSION[source]);
}

export function canFetchOutboundHubSource(
  user: CurrentUser | undefined,
  source: OutboundHubSource,
): boolean {
  return hasPermission(user, OUTBOUND_SOURCE_READ_PERMISSION[source]);
}

export function shouldFetchInboundHubType(
  user: CurrentUser | undefined,
  typeFilter: string | undefined,
  source: InboundReceiptType,
): boolean {
  if (typeFilter && typeFilter !== source) return false;
  return canFetchInboundHubSource(user, source);
}

export function shouldFetchOutboundHubType(
  user: CurrentUser | undefined,
  typeFilter: string | undefined,
  source: OutboundHubSource,
): boolean {
  if (typeFilter && typeFilter !== source) return false;
  return canFetchOutboundHubSource(user, source);
}
