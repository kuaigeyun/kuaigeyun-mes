/** 销售订单同步字段白名单（目标字段） */

import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const SALES_ORDER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'order_code', labelKey: 'app.kuaizhizao.salesOrder.syncField.orderCode' },
  { value: 'order_date', labelKey: 'app.kuaizhizao.salesOrder.syncField.orderDate' },
  { value: 'delivery_date', labelKey: 'app.kuaizhizao.salesOrder.syncField.deliveryDate' },
  { value: 'customer_id', labelKey: 'app.kuaizhizao.salesOrder.syncField.customerId' },
  { value: 'customer_code', labelKey: 'app.kuaizhizao.salesOrder.syncField.customerCode' },
  { value: 'customer_name', labelKey: 'app.kuaizhizao.salesOrder.syncField.customerName' },
  { value: 'customer_contact', labelKey: 'app.kuaizhizao.salesOrder.syncField.customerContact' },
  { value: 'customer_phone', labelKey: 'app.kuaizhizao.salesOrder.syncField.customerPhone' },
  { value: 'total_amount', labelKey: 'app.kuaizhizao.salesOrder.syncField.totalAmount' },
  { value: 'total_quantity', labelKey: 'app.kuaizhizao.salesOrder.syncField.totalQuantity' },
  { value: 'salesman_name', labelKey: 'app.kuaizhizao.salesOrder.syncField.salesmanName' },
  { value: 'notes', labelKey: 'app.kuaizhizao.salesOrder.syncField.notes' },
  { value: 'shipping_address', labelKey: 'app.kuaizhizao.salesOrder.syncField.shippingAddress' },
  { value: 'payment_terms', labelKey: 'app.kuaizhizao.salesOrder.syncField.paymentTerms' },
  { value: 'item.material_code', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemMaterialCode' },
  { value: 'item.material_name', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemMaterialName' },
  { value: 'item.material_spec', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemMaterialSpec' },
  { value: 'item.material_unit', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemMaterialUnit' },
  { value: 'item.required_quantity', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemRequiredQuantity' },
  { value: 'item.delivery_date', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemDeliveryDate' },
  { value: 'item.unit_price', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemUnitPrice' },
  { value: 'item.tax_rate', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemTaxRate' },
  { value: 'item.notes', labelKey: 'app.kuaizhizao.salesOrder.syncField.itemNotes' },
];

export const SALES_ORDER_SYNC_REQUIRED_TARGETS = ['order_code', 'order_date', 'delivery_date'];
