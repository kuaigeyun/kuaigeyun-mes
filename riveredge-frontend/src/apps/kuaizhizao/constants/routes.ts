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
  PURCHASE_INQUIRIES: `${APP_BASE}/purchase-management/purchase-inquiries`,
  PURCHASE_ORDERS: `${APP_BASE}/purchase-management/purchase-orders`,
  RECEIPT_NOTICES: `${APP_BASE}/purchase-management/receipt-notices`,
  PURCHASE_RETURNS: `${APP_BASE}/purchase-management/purchase-returns`,
  SALES_ORDERS: `${APP_BASE}/sales-management/sales-orders`,
  SALES_FORECASTS: `${APP_BASE}/sales-management/sales-forecasts`,
  SALES_RETURNS: `${APP_BASE}/sales-management/sales-returns`,
  SHIPMENT_NOTICES: `${APP_BASE}/sales-management/shipment-notices`,
  QUOTATIONS: `${APP_BASE}/sales-management/quotations`,
  DEMAND_MANAGEMENT: `${APP_BASE}/plan-management/demand-management`,
  DEMAND_COMPUTATION: `${APP_BASE}/plan-management/demand-computation`,
  WORK_ORDERS: `${APP_BASE}/production-execution/work-orders`,
  OUTSOURCE_WORK_ORDERS: `${APP_BASE}/production-execution/outsource-work-orders`,
  OUTSOURCE_ORDERS: `${APP_BASE}/production-execution/outsource-orders`,
  REPORTING: `${APP_BASE}/production-execution/reporting`,
  PACKING_BINDING: `${APP_BASE}/production-execution/packing-binding`,
  REWORK_ORDERS: `${APP_BASE}/production-execution/rework-orders`,
  INCOMING_INSPECTION: `${APP_BASE}/quality-management/incoming-inspection`,
  PROCESS_INSPECTION: `${APP_BASE}/quality-management/process-inspection`,
  FINISHED_GOODS_INSPECTION: `${APP_BASE}/quality-management/finished-goods-inspection`,
  EQUIPMENT: `${APP_BASE}/equipment-management/equipment`,
  EQUIPMENT_FAULTS: `${APP_BASE}/equipment-management/equipment-faults`,
  MAINTENANCE_PLANS: `${APP_BASE}/equipment-management/maintenance-plans`,
  MAINTENANCE_REMINDERS: `${APP_BASE}/equipment-management/maintenance-reminders`,
  EQUIPMENT_STATUS: `${APP_BASE}/equipment-management/equipment-status`,
  MOLDS: `${APP_BASE}/equipment-management/molds`,
  TOOL_LEDGER: `${APP_BASE}/equipment-management/tool-ledger`,
  /** 仓储管理 */
  WM_INBOUND: `${APP_BASE}/warehouse-management/inbound`,
  WM_OUTBOUND: `${APP_BASE}/warehouse-management/outbound`,
  WM_OTHER_INBOUND: `${APP_BASE}/warehouse-management/other-inbound`,
  WM_OTHER_OUTBOUND: `${APP_BASE}/warehouse-management/other-outbound`,
  WM_MATERIAL_BORROWS: `${APP_BASE}/warehouse-management/material-borrows`,
  WM_MATERIAL_RETURNS: `${APP_BASE}/warehouse-management/material-returns`,
  WM_DELIVERY_NOTES: `${APP_BASE}/warehouse-management/delivery-notes`,
  WM_STOCKTAKING: `${APP_BASE}/warehouse-management/stocktaking`,
  WM_INVENTORY_TRANSFER: `${APP_BASE}/warehouse-management/inventory-transfer`,
  /** 绩效管理 */
  PERF_HOLIDAYS: `${APP_BASE}/performance/holidays`,
  PERF_SHIFTS: `${APP_BASE}/performance/shifts`,
  PERF_SHIFT_ROSTERS: `${APP_BASE}/performance/shift-rosters`,
  PERF_SKILLS: `${APP_BASE}/performance/skills`,
  PERF_SUMMARIES: `${APP_BASE}/performance/summaries`,
} as const;

export { APP_BASE };
