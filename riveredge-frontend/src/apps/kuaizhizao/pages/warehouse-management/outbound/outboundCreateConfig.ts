/** 出库管理 — 取单弹窗与 Hub 聚合用配置（唯一真源） */

export const PRODUCTION_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES = [
  '已下达',
  '进行中',
  'released',
  'in_progress',
];

export const SALES_ORDER_OUTBOUND_ELIGIBLE_STATUSES = [
  '已审核',
  '已确认',
  'AUDITED',
  'CONFIRMED',
  '执行中',
  'IN_PROGRESS',
];

export const SHIPMENT_NOTICE_OUTBOUND_ELIGIBLE_STATUSES = [
  '待发货',
  '已通知',
  'pending',
  'notified',
];

export const OUTSOURCE_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES = ['released', 'in_progress'];
