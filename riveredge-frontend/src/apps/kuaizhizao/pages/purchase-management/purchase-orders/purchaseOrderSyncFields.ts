/** 采购订单同步字段白名单（目标字段） */

import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const PURCHASE_ORDER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'order_code', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.orderCode', required: true },
  { value: 'order_date', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.orderDate', required: true },
  { value: 'delivery_date', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.deliveryDate' },
  { value: 'supplier_code', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.supplierCode', required: true },
  { value: 'supplier_name', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.supplierName' },
  { value: 'notes', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.notes' },
  { value: 'item.material_code', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemMaterialCode', required: true },
  { value: 'item.material_name', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemMaterialName' },
  { value: 'item.ordered_quantity', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemOrderedQuantity', required: true },
  { value: 'item.unit_price', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemUnitPrice' },
  { value: 'item.tax_rate', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemTaxRate' },
  { value: 'item.delivery_date', labelKey: 'app.kuaizhizao.purchaseOrder.syncField.itemDeliveryDate' },
];

export const PURCHASE_ORDER_SYNC_REQUIRED_TARGETS = ['order_code', 'order_date', 'supplier_code'];
