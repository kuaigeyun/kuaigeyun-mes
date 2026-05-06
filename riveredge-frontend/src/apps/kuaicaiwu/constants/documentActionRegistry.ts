export type KuaicaiwuDocumentActionKey =
  | 'sales_invoice.pull_from_sales_order'
  | 'sales_invoice.pull_from_sales_delivery'
  | 'receipt.pull_from_receivable'
  | 'purchase_invoice.pull_from_purchase_order'
  | 'purchase_invoice.pull_from_purchase_receipt'
  | 'payment.pull_from_payable';

export interface KuaicaiwuDocumentActionDefinition {
  key: KuaicaiwuDocumentActionKey;
  module: 'kuaicaiwu';
  kind: 'pull_create';
  label: string;
  sourceLabel: string;
  targetLabel: string;
}

export const KUAICAIWU_DOCUMENT_ACTION_REGISTRY: Record<KuaicaiwuDocumentActionKey, KuaicaiwuDocumentActionDefinition> = {
  'sales_invoice.pull_from_sales_order': {
    key: 'sales_invoice.pull_from_sales_order',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从销售订单创建销项发票',
    sourceLabel: '销售订单',
    targetLabel: '销项发票',
  },
  'sales_invoice.pull_from_sales_delivery': {
    key: 'sales_invoice.pull_from_sales_delivery',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从销售出库创建销项发票',
    sourceLabel: '销售出库',
    targetLabel: '销项发票',
  },
  'receipt.pull_from_receivable': {
    key: 'receipt.pull_from_receivable',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从应收单创建收款单',
    sourceLabel: '应收单',
    targetLabel: '收款单',
  },
  'purchase_invoice.pull_from_purchase_order': {
    key: 'purchase_invoice.pull_from_purchase_order',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从采购订单创建进项发票',
    sourceLabel: '采购订单',
    targetLabel: '进项发票',
  },
  'purchase_invoice.pull_from_purchase_receipt': {
    key: 'purchase_invoice.pull_from_purchase_receipt',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从采购入库创建进项发票',
    sourceLabel: '采购入库',
    targetLabel: '进项发票',
  },
  'payment.pull_from_payable': {
    key: 'payment.pull_from_payable',
    module: 'kuaicaiwu',
    kind: 'pull_create',
    label: '从应付单创建付款单',
    sourceLabel: '应付单',
    targetLabel: '付款单',
  },
};

export const getKuaicaiwuDocumentAction = (key: KuaicaiwuDocumentActionKey): KuaicaiwuDocumentActionDefinition =>
  KUAICAIWU_DOCUMENT_ACTION_REGISTRY[key];

export type KuaicaiwuPullCreateMenuItemSpec = {
  actionKey: KuaicaiwuDocumentActionKey;
  onClick: () => void;
  key?: string;
};

export const buildKuaicaiwuPullCreateMenuItems = (specs: KuaicaiwuPullCreateMenuItemSpec[]) =>
  specs.map((spec) => ({
    key: spec.key ?? spec.actionKey,
    label: getKuaicaiwuDocumentAction(spec.actionKey).label,
    onClick: spec.onClick,
  }));
