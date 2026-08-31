/** 生产工单同步字段白名单（目标字段） */

import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const WORK_ORDER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.kuaizhizao.workOrder.syncField.code', required: true },
  { value: 'product_code', labelKey: 'app.kuaizhizao.workOrder.syncField.productCode', required: true },
  { value: 'product_name', labelKey: 'app.kuaizhizao.workOrder.syncField.productName' },
  { value: 'quantity', labelKey: 'app.kuaizhizao.workOrder.syncField.quantity', required: true },
  { value: 'planned_start_date', labelKey: 'app.kuaizhizao.workOrder.syncField.plannedStartDate' },
  { value: 'planned_end_date', labelKey: 'app.kuaizhizao.workOrder.syncField.plannedEndDate' },
  { value: 'sales_order_code', labelKey: 'app.kuaizhizao.workOrder.syncField.salesOrderCode' },
  { value: 'document_status', labelKey: 'app.kuaizhizao.workOrder.syncField.documentStatus' },
  { value: 'status', labelKey: 'app.kuaizhizao.workOrder.syncField.status' },
  { value: 'close_status', labelKey: 'app.kuaizhizao.workOrder.syncField.closeStatus' },
];

export const WORK_ORDER_SYNC_REQUIRED_TARGETS = ['code', 'product_code', 'quantity'];
export const WORK_ORDER_SYNC_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_work_orders';
