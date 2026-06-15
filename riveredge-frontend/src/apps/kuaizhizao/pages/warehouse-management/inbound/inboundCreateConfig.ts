/** 入库管理 — 取单弹窗与 Hub 聚合用配置（唯一真源） */

export type InboundOutsourcePullType =
  | 'outsource_receipt'
  | 'outsource_material_return'
  | 'outsource_product_return';

export const PURCHASE_ORDER_RECEIPT_ELIGIBLE_STATUSES = [
  '已审核',
  '已确认',
  'AUDITED',
  'CONFIRMED',
  '执行中',
  'IN_PROGRESS',
  '进行中',
];

export const RECEIPT_NOTICE_ELIGIBLE_STATUSES = ['待收货', '已通知'];

export const PRODUCTION_WORK_ORDER_ELIGIBLE_STATUSES = [
  '进行中',
  '已完成',
  'in_progress',
  'completed',
];

export const OUTSOURCE_WORK_ORDER_ELIGIBLE_STATUSES = ['released', 'in_progress'];

export const PRODUCTION_PICKING_ELIGIBLE_STATUSES = ['已领料', '已确认', 'confirmed', 'picked'];
