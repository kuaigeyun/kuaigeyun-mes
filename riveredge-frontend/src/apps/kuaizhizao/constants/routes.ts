/**
 * 快格轻制造 - 路由路径常量
 *
 * 约定说明（与 pages/ 目录一一对应，无重复）：
 * - 文件路径: pages/{routePath}/index.tsx
 * - 路由 path: {routePath}（在 index.tsx 中配置）
 * - 完整 URL: /apps/kuaizhizao/{routePath}
 *
 * 例如采购申请：
 * - 文件: pages/purchase-management/purchase-requisitions/index.tsx
 * - 路由: purchase-management/purchase-requisitions
 * - 完整 URL: /apps/kuaizhizao/purchase-management/purchase-requisitions
 */

const APP_BASE = '/apps/kuaizhizao';

/** 完整 URL（用于 navigate、Link、菜单 path 等） */
export const ROUTES = {
  PURCHASE_REQUISITIONS: `${APP_BASE}/purchase-management/purchase-requisitions`,
  PURCHASE_ORDERS: `${APP_BASE}/purchase-management/purchase-orders`,
  RECEIPT_NOTICES: `${APP_BASE}/purchase-management/receipt-notices`,
} as const;

export { APP_BASE };
