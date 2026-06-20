export type KuaizhizaoDocumentActionKey =
  | 'sales_order.pull_from_quotation'
  | 'sales_order.pull_from_sales_contract'
  | 'sales_contract.pull_from_quotation'
  | 'sales_order_change.pull_from_sales_order'
  | 'purchase_order_change.pull_from_purchase_order'
  | 'purchase_order.pull_from_requisition'
  | 'purchase_order.pull_from_inquiry'
  | 'purchase_inquiry.pull_from_requisition'
  | 'batching_order.pull_from_work_order'
  | 'shipment_notice.pull_from_sales_order'
  | 'delivery_note.pull_from_sales_delivery'
  | 'sales_invoice.pull_from_sales_order'
  | 'sales_delivery.pull_from_sales_order'
  | 'sales_return.pull_from_sales_order'
  | 'receipt_notice.pull_from_purchase_order'
  | 'purchase_receipt.pull_from_purchase_order'
  | 'purchase_invoice.pull_from_purchase_order'
  | 'purchase_return.pull_from_purchase_order'
  | 'purchase_receipt.pull_from_receipt_notice'
  | 'purchase_return.pull_from_incoming_inspection'
  | 'incoming_inspection.pull_from_purchase_receipt'
  | 'incoming_inspection.pull_from_customer_material_registration'
  | 'process_inspection.pull_from_work_order'
  | 'finished_goods_inspection.pull_from_work_order'
  | 'oqc_inspection.pull_from_shipment_notice'
  | 'oqc_inspection.pull_from_sales_delivery'
  | 'rework_order.pull_from_finished_goods_inspection'
  | 'purchase_requisition.pull_from_demand_computation'
  | 'demand_computation.pull_from_sales_forecast'
  | 'demand_computation.pull_from_demand'
  | 'demand_computation.pull_from_sales_order'
  | 'work_order.pull_from_demand_computation'
  | 'work_order.pull_from_production_plan'
  | 'work_order.pull_from_sales_order'
  | 'outbound.pull_from_work_order'
  | 'outbound.pull_from_sales_order'
  | 'sales_delivery.pull_from_shipment_notice'
  | 'outbound.pull_from_outsource_work_order'
  | 'inbound.pull_from_purchase_order'
  | 'inbound.pull_from_work_order'
  | 'inbound.pull_from_sales_order'
  | 'inbound.pull_from_outsource_work_order'
  | 'inbound.pull_from_work_order_for_production_return';

export interface KuaizhizaoDocumentActionDefinition {
  key: KuaizhizaoDocumentActionKey;
  module: 'kuaizhizao';
  kind: 'pull_create';
  labelKey: string;
  sourceLabelKey: string;
  targetLabelKey: string;
  /** 取单录入页 path 前缀（不含 :id 参数） */
  targetPath?: string;
}

export type DocumentActionTranslator = (key: string, options?: Record<string, unknown>) => string;

export type KuaizhizaoDocumentActionResolved = KuaizhizaoDocumentActionDefinition & {
  label: string;
  sourceLabel: string;
  targetLabel: string;
};

const documentActionI18n = (actionKey: KuaizhizaoDocumentActionKey, field: 'label' | 'source' | 'target') =>
  `app.kuaizhizao.documentAction.${actionKey}.${field}`;

export const KUAIZHIZAO_DOCUMENT_ACTION_REGISTRY: Record<KuaizhizaoDocumentActionKey, KuaizhizaoDocumentActionDefinition> = {
  'sales_order.pull_from_quotation': {
    key: 'sales_order.pull_from_quotation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_order.pull_from_quotation', 'label'),
    sourceLabelKey: documentActionI18n('sales_order.pull_from_quotation', 'source'),
    targetLabelKey: documentActionI18n('sales_order.pull_from_quotation', 'target'),
  },
  'sales_order.pull_from_sales_contract': {
    key: 'sales_order.pull_from_sales_contract',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_order.pull_from_sales_contract', 'label'),
    sourceLabelKey: documentActionI18n('sales_order.pull_from_sales_contract', 'source'),
    targetLabelKey: documentActionI18n('sales_order.pull_from_sales_contract', 'target'),
  },
  'sales_contract.pull_from_quotation': {
    key: 'sales_contract.pull_from_quotation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_contract.pull_from_quotation', 'label'),
    sourceLabelKey: documentActionI18n('sales_contract.pull_from_quotation', 'source'),
    targetLabelKey: documentActionI18n('sales_contract.pull_from_quotation', 'target'),
  },
  'sales_order_change.pull_from_sales_order': {
    key: 'sales_order_change.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_order_change.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('sales_order_change.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('sales_order_change.pull_from_sales_order', 'target'),
  },
  'purchase_order_change.pull_from_purchase_order': {
    key: 'purchase_order_change.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_order_change.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('purchase_order_change.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('purchase_order_change.pull_from_purchase_order', 'target'),
  },
  'purchase_order.pull_from_requisition': {
    key: 'purchase_order.pull_from_requisition',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_order.pull_from_requisition', 'label'),
    sourceLabelKey: documentActionI18n('purchase_order.pull_from_requisition', 'source'),
    targetLabelKey: documentActionI18n('purchase_order.pull_from_requisition', 'target'),
  },
  'purchase_order.pull_from_inquiry': {
    key: 'purchase_order.pull_from_inquiry',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_order.pull_from_inquiry', 'label'),
    sourceLabelKey: documentActionI18n('purchase_order.pull_from_inquiry', 'source'),
    targetLabelKey: documentActionI18n('purchase_order.pull_from_inquiry', 'target'),
  },
  'purchase_inquiry.pull_from_requisition': {
    key: 'purchase_inquiry.pull_from_requisition',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_inquiry.pull_from_requisition', 'label'),
    sourceLabelKey: documentActionI18n('purchase_inquiry.pull_from_requisition', 'source'),
    targetLabelKey: documentActionI18n('purchase_inquiry.pull_from_requisition', 'target'),
  },
  'batching_order.pull_from_work_order': {
    key: 'batching_order.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('batching_order.pull_from_work_order', 'label'),
    sourceLabelKey: documentActionI18n('batching_order.pull_from_work_order', 'source'),
    targetLabelKey: documentActionI18n('batching_order.pull_from_work_order', 'target'),
  },
  'shipment_notice.pull_from_sales_order': {
    key: 'shipment_notice.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('shipment_notice.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('shipment_notice.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('shipment_notice.pull_from_sales_order', 'target'),
  },
  'delivery_note.pull_from_sales_delivery': {
    key: 'delivery_note.pull_from_sales_delivery',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('delivery_note.pull_from_sales_delivery', 'label'),
    sourceLabelKey: documentActionI18n('delivery_note.pull_from_sales_delivery', 'source'),
    targetLabelKey: documentActionI18n('delivery_note.pull_from_sales_delivery', 'target'),
  },
  'sales_invoice.pull_from_sales_order': {
    key: 'sales_invoice.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_invoice.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('sales_invoice.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('sales_invoice.pull_from_sales_order', 'target'),
  },
  'sales_delivery.pull_from_sales_order': {
    key: 'sales_delivery.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_delivery.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('sales_delivery.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('sales_delivery.pull_from_sales_order', 'target'),
  },
  'sales_return.pull_from_sales_order': {
    key: 'sales_return.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_return.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('sales_return.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('sales_return.pull_from_sales_order', 'target'),
  },
  'receipt_notice.pull_from_purchase_order': {
    key: 'receipt_notice.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('receipt_notice.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('receipt_notice.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('receipt_notice.pull_from_purchase_order', 'target'),
  },
  'purchase_receipt.pull_from_purchase_order': {
    key: 'purchase_receipt.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_receipt.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('purchase_receipt.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('purchase_receipt.pull_from_purchase_order', 'target'),
  },
  'purchase_invoice.pull_from_purchase_order': {
    key: 'purchase_invoice.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_invoice.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('purchase_invoice.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('purchase_invoice.pull_from_purchase_order', 'target'),
  },
  'purchase_return.pull_from_purchase_order': {
    key: 'purchase_return.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_return.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('purchase_return.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('purchase_return.pull_from_purchase_order', 'target'),
  },
  'purchase_receipt.pull_from_receipt_notice': {
    key: 'purchase_receipt.pull_from_receipt_notice',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_receipt.pull_from_receipt_notice', 'label'),
    sourceLabelKey: documentActionI18n('purchase_receipt.pull_from_receipt_notice', 'source'),
    targetLabelKey: documentActionI18n('purchase_receipt.pull_from_receipt_notice', 'target'),
  },
  'purchase_return.pull_from_incoming_inspection': {
    key: 'purchase_return.pull_from_incoming_inspection',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_return.pull_from_incoming_inspection', 'label'),
    sourceLabelKey: documentActionI18n('purchase_return.pull_from_incoming_inspection', 'source'),
    targetLabelKey: documentActionI18n('purchase_return.pull_from_incoming_inspection', 'target'),
  },
  'incoming_inspection.pull_from_purchase_receipt': {
    key: 'incoming_inspection.pull_from_purchase_receipt',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('incoming_inspection.pull_from_purchase_receipt', 'label'),
    sourceLabelKey: documentActionI18n('incoming_inspection.pull_from_purchase_receipt', 'source'),
    targetLabelKey: documentActionI18n('incoming_inspection.pull_from_purchase_receipt', 'target'),
  },
  'incoming_inspection.pull_from_customer_material_registration': {
    key: 'incoming_inspection.pull_from_customer_material_registration',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('incoming_inspection.pull_from_customer_material_registration', 'label'),
    sourceLabelKey: documentActionI18n('incoming_inspection.pull_from_customer_material_registration', 'source'),
    targetLabelKey: documentActionI18n('incoming_inspection.pull_from_customer_material_registration', 'target'),
  },
  'process_inspection.pull_from_work_order': {
    key: 'process_inspection.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('process_inspection.pull_from_work_order', 'label'),
    sourceLabelKey: documentActionI18n('process_inspection.pull_from_work_order', 'source'),
    targetLabelKey: documentActionI18n('process_inspection.pull_from_work_order', 'target'),
  },
  'finished_goods_inspection.pull_from_work_order': {
    key: 'finished_goods_inspection.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('finished_goods_inspection.pull_from_work_order', 'label'),
    sourceLabelKey: documentActionI18n('finished_goods_inspection.pull_from_work_order', 'source'),
    targetLabelKey: documentActionI18n('finished_goods_inspection.pull_from_work_order', 'target'),
  },
  'oqc_inspection.pull_from_shipment_notice': {
    key: 'oqc_inspection.pull_from_shipment_notice',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('oqc_inspection.pull_from_shipment_notice', 'label'),
    sourceLabelKey: documentActionI18n('oqc_inspection.pull_from_shipment_notice', 'source'),
    targetLabelKey: documentActionI18n('oqc_inspection.pull_from_shipment_notice', 'target'),
  },
  'oqc_inspection.pull_from_sales_delivery': {
    key: 'oqc_inspection.pull_from_sales_delivery',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('oqc_inspection.pull_from_sales_delivery', 'label'),
    sourceLabelKey: documentActionI18n('oqc_inspection.pull_from_sales_delivery', 'source'),
    targetLabelKey: documentActionI18n('oqc_inspection.pull_from_sales_delivery', 'target'),
  },
  'rework_order.pull_from_finished_goods_inspection': {
    key: 'rework_order.pull_from_finished_goods_inspection',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('rework_order.pull_from_finished_goods_inspection', 'label'),
    sourceLabelKey: documentActionI18n('rework_order.pull_from_finished_goods_inspection', 'source'),
    targetLabelKey: documentActionI18n('rework_order.pull_from_finished_goods_inspection', 'target'),
  },
  'purchase_requisition.pull_from_demand_computation': {
    key: 'purchase_requisition.pull_from_demand_computation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('purchase_requisition.pull_from_demand_computation', 'label'),
    sourceLabelKey: documentActionI18n('purchase_requisition.pull_from_demand_computation', 'source'),
    targetLabelKey: documentActionI18n('purchase_requisition.pull_from_demand_computation', 'target'),
  },
  'demand_computation.pull_from_sales_forecast': {
    key: 'demand_computation.pull_from_sales_forecast',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('demand_computation.pull_from_sales_forecast', 'label'),
    sourceLabelKey: documentActionI18n('demand_computation.pull_from_sales_forecast', 'source'),
    targetLabelKey: documentActionI18n('demand_computation.pull_from_sales_forecast', 'target'),
  },
  'demand_computation.pull_from_demand': {
    key: 'demand_computation.pull_from_demand',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('demand_computation.pull_from_demand', 'label'),
    sourceLabelKey: documentActionI18n('demand_computation.pull_from_demand', 'source'),
    targetLabelKey: documentActionI18n('demand_computation.pull_from_demand', 'target'),
  },
  'demand_computation.pull_from_sales_order': {
    key: 'demand_computation.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('demand_computation.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('demand_computation.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('demand_computation.pull_from_sales_order', 'target'),
  },
  'work_order.pull_from_demand_computation': {
    key: 'work_order.pull_from_demand_computation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('work_order.pull_from_demand_computation', 'label'),
    sourceLabelKey: documentActionI18n('work_order.pull_from_demand_computation', 'source'),
    targetLabelKey: documentActionI18n('work_order.pull_from_demand_computation', 'target'),
  },
  'work_order.pull_from_production_plan': {
    key: 'work_order.pull_from_production_plan',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('work_order.pull_from_production_plan', 'label'),
    sourceLabelKey: documentActionI18n('work_order.pull_from_production_plan', 'source'),
    targetLabelKey: documentActionI18n('work_order.pull_from_production_plan', 'target'),
  },
  'work_order.pull_from_sales_order': {
    key: 'work_order.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('work_order.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('work_order.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('work_order.pull_from_sales_order', 'target'),
  },
  'outbound.pull_from_work_order': {
    key: 'outbound.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('outbound.pull_from_work_order', 'label'),
    sourceLabelKey: documentActionI18n('outbound.pull_from_work_order', 'source'),
    targetLabelKey: documentActionI18n('outbound.pull_from_work_order', 'target'),
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/work-order',
  },
  'outbound.pull_from_sales_order': {
    key: 'outbound.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('outbound.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('outbound.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('outbound.pull_from_sales_order', 'target'),
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/sales-order',
  },
  'sales_delivery.pull_from_shipment_notice': {
    key: 'sales_delivery.pull_from_shipment_notice',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('sales_delivery.pull_from_shipment_notice', 'label'),
    sourceLabelKey: documentActionI18n('sales_delivery.pull_from_shipment_notice', 'source'),
    targetLabelKey: documentActionI18n('sales_delivery.pull_from_shipment_notice', 'target'),
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/sales-order',
  },
  'outbound.pull_from_outsource_work_order': {
    key: 'outbound.pull_from_outsource_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('outbound.pull_from_outsource_work_order', 'label'),
    sourceLabelKey: documentActionI18n('outbound.pull_from_outsource_work_order', 'source'),
    targetLabelKey: documentActionI18n('outbound.pull_from_outsource_work_order', 'target'),
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/outsource-work-order',
  },
  'inbound.pull_from_purchase_order': {
    key: 'inbound.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('inbound.pull_from_purchase_order', 'label'),
    sourceLabelKey: documentActionI18n('inbound.pull_from_purchase_order', 'source'),
    targetLabelKey: documentActionI18n('inbound.pull_from_purchase_order', 'target'),
  },
  'inbound.pull_from_work_order': {
    key: 'inbound.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('inbound.pull_from_work_order', 'label'),
    sourceLabelKey: documentActionI18n('inbound.pull_from_work_order', 'source'),
    targetLabelKey: documentActionI18n('inbound.pull_from_work_order', 'target'),
  },
  'inbound.pull_from_sales_order': {
    key: 'inbound.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('inbound.pull_from_sales_order', 'label'),
    sourceLabelKey: documentActionI18n('inbound.pull_from_sales_order', 'source'),
    targetLabelKey: documentActionI18n('inbound.pull_from_sales_order', 'target'),
  },
  'inbound.pull_from_outsource_work_order': {
    key: 'inbound.pull_from_outsource_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('inbound.pull_from_outsource_work_order', 'label'),
    sourceLabelKey: documentActionI18n('inbound.pull_from_outsource_work_order', 'source'),
    targetLabelKey: documentActionI18n('inbound.pull_from_outsource_work_order', 'target'),
  },
  'inbound.pull_from_work_order_for_production_return': {
    key: 'inbound.pull_from_work_order_for_production_return',
    module: 'kuaizhizao',
    kind: 'pull_create',
    labelKey: documentActionI18n('inbound.pull_from_work_order_for_production_return', 'label'),
    sourceLabelKey: documentActionI18n('inbound.pull_from_work_order_for_production_return', 'source'),
    targetLabelKey: documentActionI18n('inbound.pull_from_work_order_for_production_return', 'target'),
  },
};

export const getKuaizhizaoDocumentAction = (key: KuaizhizaoDocumentActionKey): KuaizhizaoDocumentActionDefinition =>
  KUAIZHIZAO_DOCUMENT_ACTION_REGISTRY[key];

export const resolveKuaizhizaoDocumentAction = (
  t: DocumentActionTranslator,
  key: KuaizhizaoDocumentActionKey,
): KuaizhizaoDocumentActionResolved => {
  const def = getKuaizhizaoDocumentAction(key);
  return {
    ...def,
    label: t(def.labelKey),
    sourceLabel: t(def.sourceLabelKey),
    targetLabel: t(def.targetLabelKey),
  };
};

export type KuaizhizaoPullCreateMenuItemSpec = {
  actionKey: KuaizhizaoDocumentActionKey;
  onClick: () => void;
  key?: string;
};

export const buildKuaizhizaoPullCreateMenuItems = (
  t: DocumentActionTranslator,
  specs: KuaizhizaoPullCreateMenuItemSpec[],
) =>
  specs.map((spec) => ({
    key: spec.key ?? spec.actionKey,
    label: resolveKuaizhizaoDocumentAction(t, spec.actionKey).label,
    onClick: spec.onClick,
  }));
