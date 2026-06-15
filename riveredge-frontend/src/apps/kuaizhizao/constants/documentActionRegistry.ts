export type KuaizhizaoDocumentActionKey =
  | 'sales_order.pull_from_quotation'
  | 'purchase_order.pull_from_requisition'
  | 'purchase_inquiry.pull_from_requisition'
  | 'shipment_notice.pull_from_sales_order'
  | 'delivery_note.pull_from_sales_delivery'
  | 'receipt_notice.pull_from_purchase_order'
  | 'purchase_receipt.pull_from_receipt_notice'
  | 'demand_computation.pull_from_demand'
  | 'work_order.pull_from_demand_computation'
  | 'work_order.pull_from_production_plan'
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
  label: string;
  sourceLabel: string;
  targetLabel: string;
  /** 取单录入页 path 前缀（不含 :id 参数） */
  targetPath?: string;
}

export const KUAIZHIZAO_DOCUMENT_ACTION_REGISTRY: Record<KuaizhizaoDocumentActionKey, KuaizhizaoDocumentActionDefinition> = {
  'sales_order.pull_from_quotation': {
    key: 'sales_order.pull_from_quotation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从报价单创建销售订单',
    sourceLabel: '报价单',
    targetLabel: '销售订单',
  },
  'purchase_order.pull_from_requisition': {
    key: 'purchase_order.pull_from_requisition',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从采购申请创建采购订单',
    sourceLabel: '采购申请',
    targetLabel: '采购订单',
  },
  'purchase_inquiry.pull_from_requisition': {
    key: 'purchase_inquiry.pull_from_requisition',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从采购申请创建询价单',
    sourceLabel: '采购申请',
    targetLabel: '询价单',
  },
  'shipment_notice.pull_from_sales_order': {
    key: 'shipment_notice.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从销售订单创建发货通知单',
    sourceLabel: '销售订单',
    targetLabel: '发货通知单',
  },
  'delivery_note.pull_from_sales_delivery': {
    key: 'delivery_note.pull_from_sales_delivery',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从销售出库单创建送货单',
    sourceLabel: '销售出库单',
    targetLabel: '送货单',
  },
  'receipt_notice.pull_from_purchase_order': {
    key: 'receipt_notice.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从采购订单创建收货通知单',
    sourceLabel: '采购订单',
    targetLabel: '收货通知单',
  },
  'purchase_receipt.pull_from_receipt_notice': {
    key: 'purchase_receipt.pull_from_receipt_notice',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从收货通知单创建采购入库单',
    sourceLabel: '收货通知单',
    targetLabel: '采购入库单',
  },
  'demand_computation.pull_from_demand': {
    key: 'demand_computation.pull_from_demand',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从需求创建需求运算',
    sourceLabel: '需求',
    targetLabel: '需求运算',
  },
  'work_order.pull_from_demand_computation': {
    key: 'work_order.pull_from_demand_computation',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从需求运算创建工单',
    sourceLabel: '需求运算',
    targetLabel: '工单',
  },
  'work_order.pull_from_production_plan': {
    key: 'work_order.pull_from_production_plan',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从生产计划创建工单',
    sourceLabel: '生产计划',
    targetLabel: '工单',
  },
  'outbound.pull_from_work_order': {
    key: 'outbound.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从工单创建生产领料单',
    sourceLabel: '工单',
    targetLabel: '生产领料单',
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/work-order',
  },
  'outbound.pull_from_sales_order': {
    key: 'outbound.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从销售订单创建销售出库单',
    sourceLabel: '销售订单',
    targetLabel: '销售出库单',
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/sales-order',
  },
  'sales_delivery.pull_from_shipment_notice': {
    key: 'sales_delivery.pull_from_shipment_notice',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从发货通知单创建销售出库单',
    sourceLabel: '发货通知单',
    targetLabel: '销售出库单',
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/sales-order',
  },
  'outbound.pull_from_outsource_work_order': {
    key: 'outbound.pull_from_outsource_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从委外工单创建委外发料单',
    sourceLabel: '委外工单',
    targetLabel: '委外发料单',
    targetPath: '/apps/kuaizhizao/warehouse-management/outbound/entry/outsource-work-order',
  },
  'inbound.pull_from_purchase_order': {
    key: 'inbound.pull_from_purchase_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从采购订单创建采购入库单',
    sourceLabel: '采购订单',
    targetLabel: '采购入库单',
  },
  'inbound.pull_from_work_order': {
    key: 'inbound.pull_from_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从工单创建成品入库单',
    sourceLabel: '工单',
    targetLabel: '成品入库单',
  },
  'inbound.pull_from_sales_order': {
    key: 'inbound.pull_from_sales_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从销售订单创建销售退货单',
    sourceLabel: '销售订单',
    targetLabel: '销售退货单',
  },
  'inbound.pull_from_outsource_work_order': {
    key: 'inbound.pull_from_outsource_work_order',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从委外工单创建委外入库单',
    sourceLabel: '委外工单',
    targetLabel: '委外入库单',
  },
  'inbound.pull_from_work_order_for_production_return': {
    key: 'inbound.pull_from_work_order_for_production_return',
    module: 'kuaizhizao',
    kind: 'pull_create',
    label: '从工单创建生产退料单',
    sourceLabel: '工单',
    targetLabel: '生产退料单',
  },
};

export const getKuaizhizaoDocumentAction = (key: KuaizhizaoDocumentActionKey): KuaizhizaoDocumentActionDefinition =>
  KUAIZHIZAO_DOCUMENT_ACTION_REGISTRY[key];

export type KuaizhizaoPullCreateMenuItemSpec = {
  actionKey: KuaizhizaoDocumentActionKey;
  onClick: () => void;
  key?: string;
};

export const buildKuaizhizaoPullCreateMenuItems = (specs: KuaizhizaoPullCreateMenuItemSpec[]) =>
  specs.map((spec) => ({
    key: spec.key ?? spec.actionKey,
    label: getKuaizhizaoDocumentAction(spec.actionKey).label,
    onClick: spec.onClick,
  }));
