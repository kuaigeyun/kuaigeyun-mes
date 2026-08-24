/**
 * 页面帮助分批接入规划（唯一清单）
 *
 * Batch 1+2 已完成；Batch 3 覆盖剩余全部页面。
 * 接入方式见各 profile 对应组件与 build*HelpViewConfig。
 */

export type HelpPageProfile =
  | 'applicationCenter'
  | 'richDocument'
  | 'richListPage'
  | 'richModuleCenter'
  | 'richReport'
  | 'richMasterDataLedger';

export type HelpBatchPlanItem = {
  id: string;
  title: string;
  profile: HelpPageProfile;
  /** i18n 前缀或 docKey / pageKey / moduleKey */
  contentKey: string;
  /** 相对 riveredge-frontend/src 的页面路径 */
  pagePath: string;
  /** 需新增 help 视图（当前无 viewTypes help） */
  needsHelpView?: boolean;
  notes?: string;
};

/** Batch 1：应用中心 + 8 高频单据 */
export const HELP_BATCH1_DONE = [
  'system.applications',
  'document.sales-order',
  'document.purchase-order',
  'document.work-order',
  'document.quotation',
  'document.purchase-requisition',
  'document.shipment-notice',
  'document.receipt-notice',
  'document.sales-contract',
] as const;

/** Batch 2：4 单据 + 22 列表页 */
export const HELP_BATCH2_LIST_PAGES = [
  'masterData.plants',
  'masterData.workshops',
  'masterData.workCenters',
  'masterData.workGroups',
  'masterData.productionLines',
  'masterData.workstations',
  'masterData.warehouses',
  'masterData.storageAreas',
  'masterData.storageLocations',
  'masterData.bom',
  'system.departments',
  'system.positions',
  'system.tenants',
  'system.systemParameters',
  'system.printTemplates',
  'system.printDevices',
  'system.integrationConfigs',
  'system.dataSources',
  'system.approvalInstances',
  'system.onlineUsers',
  'system.dataBackups',
  'personal.tasks',
] as const;

export const HELP_BATCH2_DONE = [
  'document.sales-return',
  'document.sales-forecast',
  'document.purchase-return',
  'document.purchase-inquiry',
  ...HELP_BATCH2_LIST_PAGES,
] as const;

// ── Batch 3：剩余全部 ─────────────────────────────────────────────

/** 3-A 基础设施（Batch 3 前置，不含独立页面） */
export const HELP_BATCH3_INFRA = [
  'RichModuleCenterHelpView：升级 ModuleCenterHelpWiki 为与 batch1 同深度',
  'ModuleCenterLayout / UniDashboard：模块中心增加 help 视图切换',
  'RichReportHelpView：报表通用 4 章，UniReport 层统一 viewTypes help',
  'generate_rich_module_center_help_zh.py',
  'generate_rich_document_help_zh.py 扩展 batch3 单据段',
  'generate_rich_list_page_help_zh.py 扩展 batch3 列表段',
  'helpBatchPlan 扫描脚本：未接入页输出清单',
] as const;

/** 3-B 模块中心工作台（5） */
export const HELP_BATCH3_MODULE_CENTERS: HelpBatchPlanItem[] = [
  {
    id: 'module.sales',
    title: '销售中心',
    profile: 'richModuleCenter',
    contentKey: 'sales',
    pagePath: 'apps/kuaizhizao/pages/sales-management/dashboard/index.tsx',
    needsHelpView: true,
  },
  {
    id: 'module.purchase',
    title: '采购中心',
    profile: 'richModuleCenter',
    contentKey: 'purchase',
    pagePath: 'apps/kuaizhizao/pages/purchase-management/dashboard/index.tsx',
    needsHelpView: true,
  },
  {
    id: 'module.warehouse',
    title: '仓储中心',
    profile: 'richModuleCenter',
    contentKey: 'warehouse',
    pagePath: 'apps/kuaizhizao/pages/warehouse-management/dashboard/index.tsx',
    needsHelpView: true,
  },
  {
    id: 'module.production',
    title: '制造中心',
    profile: 'richModuleCenter',
    contentKey: 'production',
    pagePath: 'apps/kuaizhizao/pages/production-execution/dashboard/index.tsx',
    needsHelpView: true,
  },
  {
    id: 'module.equipment',
    title: '设备中心',
    profile: 'richModuleCenter',
    contentKey: 'equipment',
    pagePath: 'apps/kuaizhizao/pages/equipment-management/dashboard/index.tsx',
    needsHelpView: true,
  },
];

/** 3-C 主数据剩余列表（17） */
export const HELP_BATCH3_MASTER_DATA_LISTS: HelpBatchPlanItem[] = [
  { id: 'md.customers', title: '客户', profile: 'richListPage', contentKey: 'masterData.customers', pagePath: 'apps/master-data/pages/supply-chain/customers/index.tsx', needsHelpView: true },
  { id: 'md.suppliers', title: '供应商', profile: 'richListPage', contentKey: 'masterData.suppliers', pagePath: 'apps/master-data/pages/supply-chain/suppliers/index.tsx', needsHelpView: true },
  { id: 'md.partnerPriceBooks', title: '伙伴价格表', profile: 'richListPage', contentKey: 'masterData.partnerPriceBooks', pagePath: 'apps/master-data/pages/supply-chain/partner-price-books/index.tsx', needsHelpView: true },
  { id: 'md.materials', title: '物料管理', profile: 'richMasterDataLedger', contentKey: 'masterData.materials', pagePath: 'apps/master-data/pages/materials/management.tsx', needsHelpView: true, notes: '物料主列表，非标准 UniTable 单文件' },
  { id: 'md.marketPrices', title: '物料市场价', profile: 'richListPage', contentKey: 'masterData.marketPrices', pagePath: 'apps/master-data/pages/materials/market-prices/index.tsx', needsHelpView: true },
  { id: 'md.units', title: '计量单位', profile: 'richListPage', contentKey: 'masterData.units', pagePath: 'apps/master-data/pages/materials/units/index.tsx', needsHelpView: true },
  { id: 'md.batches', title: '批次档案', profile: 'richListPage', contentKey: 'masterData.batches', pagePath: 'apps/master-data/pages/materials/batches/index.tsx', needsHelpView: true },
  { id: 'md.batchRules', title: '批次规则', profile: 'richListPage', contentKey: 'masterData.batchRules', pagePath: 'apps/master-data/pages/materials/batch-rules/index.tsx', needsHelpView: true },
  { id: 'md.serials', title: '序列号', profile: 'richListPage', contentKey: 'masterData.serials', pagePath: 'apps/master-data/pages/materials/serials/index.tsx', needsHelpView: true },
  { id: 'md.serialRules', title: '序列号规则', profile: 'richListPage', contentKey: 'masterData.serialRules', pagePath: 'apps/master-data/pages/materials/serial-rules/index.tsx', needsHelpView: true },
  { id: 'md.variantAttributes', title: '变体属性', profile: 'richListPage', contentKey: 'masterData.variantAttributes', pagePath: 'apps/master-data/pages/materials/variant-attributes/index.tsx', needsHelpView: true },
  { id: 'md.routes', title: '工艺路线', profile: 'richListPage', contentKey: 'masterData.routes', pagePath: 'apps/master-data/pages/process/routes/index.tsx', needsHelpView: true },
  { id: 'md.operations', title: '工序', profile: 'richListPage', contentKey: 'masterData.operations', pagePath: 'apps/master-data/pages/process/operations/index.tsx', needsHelpView: true },
  { id: 'md.sop', title: 'SOP', profile: 'richListPage', contentKey: 'masterData.sop', pagePath: 'apps/master-data/pages/process/sop/index.tsx', needsHelpView: true },
  { id: 'md.drawings', title: '图纸', profile: 'richListPage', contentKey: 'masterData.drawings', pagePath: 'apps/master-data/pages/process/drawings/index.tsx', needsHelpView: true },
  { id: 'md.drawingWhereUsed', title: '图纸反查', profile: 'richListPage', contentKey: 'masterData.drawingWhereUsed', pagePath: 'apps/master-data/pages/process/drawing-where-used/index.tsx', needsHelpView: true },
  { id: 'md.defectTypes', title: '缺陷类型', profile: 'richListPage', contentKey: 'masterData.defectTypes', pagePath: 'apps/master-data/pages/process/defect-types/index.tsx', needsHelpView: true },
];

/** 3-D 系统管理剩余列表（21） */
export const HELP_BATCH3_SYSTEM_LISTS: HelpBatchPlanItem[] = [
  { id: 'sys.users', title: '用户', profile: 'richListPage', contentKey: 'system.users', pagePath: 'pages/system/users/list/index.tsx', needsHelpView: true },
  { id: 'sys.roles', title: '角色权限', profile: 'richListPage', contentKey: 'system.roles', pagePath: 'pages/system/roles-permissions/index.tsx', needsHelpView: true },
  { id: 'sys.menus', title: '菜单', profile: 'richListPage', contentKey: 'system.menus', pagePath: 'pages/system/menus/index.tsx', needsHelpView: true },
  { id: 'sys.permissions', title: '权限码', profile: 'richListPage', contentKey: 'system.permissions', pagePath: 'pages/system/permissions/list/index.tsx', needsHelpView: true },
  { id: 'sys.customFields', title: '自定义字段', profile: 'richListPage', contentKey: 'system.customFields', pagePath: 'pages/system/custom-fields/list/index.tsx', needsHelpView: true },
  { id: 'sys.dataDictionaries', title: '数据字典', profile: 'richListPage', contentKey: 'system.dataDictionaries', pagePath: 'pages/system/data-dictionaries/list/index.tsx', needsHelpView: true },
  { id: 'sys.languages', title: '语言', profile: 'richListPage', contentKey: 'system.languages', pagePath: 'pages/system/languages/list/index.tsx', needsHelpView: true },
  { id: 'sys.approvalProcesses', title: '审批流程定义', profile: 'richListPage', contentKey: 'system.approvalProcesses', pagePath: 'pages/system/approval-processes/list/index.tsx', needsHelpView: true },
  { id: 'sys.messageTemplates', title: '消息模板', profile: 'richListPage', contentKey: 'system.messageTemplates', pagePath: 'pages/system/messages/template/index.tsx', needsHelpView: true },
  { id: 'sys.messageConfig', title: '消息配置', profile: 'richListPage', contentKey: 'system.messageConfig', pagePath: 'pages/system/messages/config/index.tsx', needsHelpView: true },
  { id: 'sys.applicationConnections', title: '应用连接器', profile: 'richListPage', contentKey: 'system.applicationConnections', pagePath: 'pages/system/application-connections/list/index.tsx', needsHelpView: true },
  { id: 'sys.apis', title: 'API 管理', profile: 'richListPage', contentKey: 'system.apis', pagePath: 'pages/system/apis/list/index.tsx', needsHelpView: true },
  { id: 'sys.datasets', title: '数据集', profile: 'richListPage', contentKey: 'system.datasets', pagePath: 'pages/system/datasets/list/index.tsx', needsHelpView: true },
  { id: 'sys.reportTemplates', title: '报表模板', profile: 'richListPage', contentKey: 'system.reportTemplates', pagePath: 'pages/system/report-templates/index.tsx', needsHelpView: true },
  { id: 'sys.operationLogs', title: '操作日志', profile: 'richListPage', contentKey: 'system.operationLogs', pagePath: 'pages/system/operation-logs/index.tsx', needsHelpView: true },
  { id: 'sys.loginLogs', title: '登录日志', profile: 'richListPage', contentKey: 'system.loginLogs', pagePath: 'pages/system/login-logs/index.tsx', needsHelpView: true },
  { id: 'sys.invitationCodes', title: '邀请码', profile: 'richListPage', contentKey: 'system.invitationCodes', pagePath: 'pages/system/invitation-codes/list/index.tsx', needsHelpView: true },
  { id: 'sys.pluginManager', title: '插件管理', profile: 'richListPage', contentKey: 'system.pluginManager', pagePath: 'pages/system/plugin-manager/index.tsx', needsHelpView: true },
  { id: 'sys.workingHoursConfigs', title: '工时配置', profile: 'richListPage', contentKey: 'system.workingHoursConfigs', pagePath: 'pages/system/working-hours-configs/index.tsx', needsHelpView: true },
  { id: 'sys.equipmentLedger', title: '设备台账(系统)', profile: 'richListPage', contentKey: 'system.equipment', pagePath: 'pages/system/equipment/list/index.tsx', needsHelpView: true },
  { id: 'sys.moldsLedger', title: '模具台账(系统)', profile: 'richListPage', contentKey: 'system.molds', pagePath: 'pages/system/molds/list/index.tsx', needsHelpView: true },
];

/** 3-E 快制造：第二批业务单据（约 28，richDocument 同构） */
export const HELP_BATCH3_KZ_DOCUMENTS: HelpBatchPlanItem[] = [
  { id: 'doc.sales-delivery', title: '销售出库', profile: 'richDocument', contentKey: 'sales-delivery', pagePath: 'apps/kuaizhizao/pages/warehouse-management/outbound/index.tsx', needsHelpView: true, notes: '出入库 Hub，可能需 hub 专用 profile' },
  { id: 'doc.sales-order-change', title: '销售订单变更', profile: 'richDocument', contentKey: 'sales-order-change', pagePath: 'apps/kuaizhizao/pages/sales-management/sales-order-changes/index.tsx', needsHelpView: true },
  { id: 'doc.sales-review', title: '订单评审', profile: 'richDocument', contentKey: 'sales-review', pagePath: 'apps/kuaizhizao/pages/sales-management/sales-reviews/index.tsx', needsHelpView: true },
  { id: 'doc.purchase-order-change', title: '采购订单变更', profile: 'richDocument', contentKey: 'purchase-order-change', pagePath: 'apps/kuaizhizao/pages/purchase-management/purchase-order-changes/index.tsx', needsHelpView: true },
  { id: 'doc.purchase-receipt', title: '采购收货', profile: 'richDocument', contentKey: 'purchase-receipt', pagePath: 'apps/kuaizhizao/pages/warehouse-management/inbound/index.tsx', needsHelpView: true, notes: '入库 Hub' },
  { id: 'doc.demand-computation', title: '需求计算', profile: 'richDocument', contentKey: 'demand-computation', pagePath: 'apps/kuaizhizao/pages/plan-management/demand-computation/index.tsx', needsHelpView: true },
  { id: 'doc.demand-management', title: '需求计划', profile: 'richDocument', contentKey: 'demand-management', pagePath: 'apps/kuaizhizao/pages/plan-management/demand-management/index.tsx', needsHelpView: true },
  { id: 'doc.incoming-inspection', title: '来料检验', profile: 'richDocument', contentKey: 'incoming-inspection', pagePath: 'apps/kuaizhizao/pages/quality-management/incoming-inspection/index.tsx', needsHelpView: true },
  { id: 'doc.finished-goods-inspection', title: '成品检验', profile: 'richDocument', contentKey: 'finished-goods-inspection', pagePath: 'apps/kuaizhizao/pages/quality-management/finished-goods-inspection/index.tsx', needsHelpView: true },
  { id: 'doc.process-inspection', title: '过程检验', profile: 'richDocument', contentKey: 'process-inspection', pagePath: 'apps/kuaizhizao/pages/quality-management/process-inspection/index.tsx', needsHelpView: true },
  { id: 'doc.oqc-inspection', title: '出货检验', profile: 'richDocument', contentKey: 'oqc-inspection', pagePath: 'apps/kuaizhizao/pages/quality-management/oqc-inspection/index.tsx', needsHelpView: true },
  { id: 'doc.fai-order', title: '首件检验', profile: 'richDocument', contentKey: 'fai-order', pagePath: 'apps/kuaizhizao/pages/quality-management/fai-orders/index.tsx', needsHelpView: true },
  { id: 'doc.outsource-work-order', title: '外协工单', profile: 'richDocument', contentKey: 'outsource-work-order', pagePath: 'apps/kuaizhizao/pages/production-execution/outsource-work-orders/index.tsx', needsHelpView: true },
  { id: 'doc.outsource-order', title: '外协订单', profile: 'richDocument', contentKey: 'outsource-order', pagePath: 'apps/kuaizhizao/pages/production-execution/outsource-orders/index.tsx', needsHelpView: true },
  { id: 'doc.rework-order', title: '返工工单', profile: 'richDocument', contentKey: 'rework-order', pagePath: 'apps/kuaizhizao/pages/production-execution/rework-orders/index.tsx', needsHelpView: true },
  { id: 'doc.reporting', title: '生产报工', profile: 'richDocument', contentKey: 'reporting', pagePath: 'apps/kuaizhizao/pages/production-execution/reporting/index.tsx', needsHelpView: true },
  { id: 'doc.stocktaking', title: '盘点单', profile: 'richDocument', contentKey: 'stocktaking', pagePath: 'apps/kuaizhizao/pages/warehouse-management/stocktaking/index.tsx', needsHelpView: true },
  { id: 'doc.inventory-transfer', title: '调拨单', profile: 'richDocument', contentKey: 'inventory-transfer', pagePath: 'apps/kuaizhizao/pages/warehouse-management/inventory-transfer/index.tsx', needsHelpView: true },
  { id: 'doc.other-inbound', title: '其他入库', profile: 'richDocument', contentKey: 'other-inbound', pagePath: 'apps/kuaizhizao/pages/warehouse-management/other-inbound/index.tsx', needsHelpView: true },
  { id: 'doc.other-outbound', title: '其他出库', profile: 'richDocument', contentKey: 'other-outbound', pagePath: 'apps/kuaizhizao/pages/warehouse-management/other-outbound/index.tsx', needsHelpView: true },
  { id: 'doc.material-borrow', title: '借料单', profile: 'richDocument', contentKey: 'material-borrow', pagePath: 'apps/kuaizhizao/pages/warehouse-management/material-borrows/index.tsx', needsHelpView: true },
  { id: 'doc.material-return', title: '还料单', profile: 'richDocument', contentKey: 'material-return', pagePath: 'apps/kuaizhizao/pages/warehouse-management/material-returns/index.tsx', needsHelpView: true },
  { id: 'doc.delivery-note', title: '送货单', profile: 'richDocument', contentKey: 'delivery-note', pagePath: 'apps/kuaizhizao/pages/warehouse-management/delivery-notes/index.tsx', needsHelpView: true },
  { id: 'doc.arrival-warning', title: '采购到货预警', profile: 'richListPage', contentKey: 'kuaizhizao.purchaseArrivalWarnings', pagePath: 'apps/kuaizhizao/pages/purchase-management/arrival-warnings/index.tsx', needsHelpView: true },
  { id: 'doc.customer-pool', title: '客户池', profile: 'richListPage', contentKey: 'kuaizhizao.customerPool', pagePath: 'apps/kuaizhizao/pages/sales-management/customer-pool/index.tsx', needsHelpView: true },
  { id: 'doc.customer-follow-up', title: '客户跟进', profile: 'richListPage', contentKey: 'kuaizhizao.customerFollowUps', pagePath: 'apps/kuaizhizao/pages/sales-management/customer-follow-ups/index.tsx', needsHelpView: true },
  { id: 'doc.inventory-query', title: '库存查询', profile: 'richListPage', contentKey: 'kuaizhizao.inventory', pagePath: 'apps/kuaizhizao/pages/warehouse-management/inventory/index.tsx', needsHelpView: true },
  { id: 'doc.inventory-alert', title: '库存预警', profile: 'richListPage', contentKey: 'kuaizhizao.inventoryAlert', pagePath: 'apps/kuaizhizao/pages/warehouse-management/inventory-alert/index.tsx', needsHelpView: true },
];

/** 3-F 快制造：设备域单据（约 35，统一 richDocument + 设备台账 richMasterDataLedger） */
export const HELP_BATCH3_KZ_EQUIPMENT: HelpBatchPlanItem[] = [
  { id: 'eq.equipment', title: '设备台账', profile: 'richMasterDataLedger', contentKey: 'kuaizhizao.equipment', pagePath: 'apps/kuaizhizao/pages/equipment-management/equipment/index.tsx', needsHelpView: true },
  { id: 'eq.molds', title: '模具台账', profile: 'richMasterDataLedger', contentKey: 'kuaizhizao.molds', pagePath: 'apps/kuaizhizao/pages/equipment-management/molds/index.tsx', needsHelpView: true },
  { id: 'eq.tools', title: '工装台账', profile: 'richMasterDataLedger', contentKey: 'kuaizhizao.tools', pagePath: 'apps/kuaizhizao/pages/equipment-management/tool-ledger/index.tsx', needsHelpView: true },
  // 其余设备域保养/维修/点检/借还/报废等单据页：按 manifest 菜单逐项 richDocument，约 32 页
  // 实施时从 apps/kuaizhizao/pages/equipment-management/**/index.tsx 批量注册
];

/** 3-G 快制造：报表 — 通用帮助，在 UniReport 层一次性接入，无需逐页 contentKey */
export const HELP_BATCH3_KZ_REPORTS_NOTE =
  '凡 KuaizhizaoReport/UniReport 页面共用 buildReportHelpViewConfig()；禁止按报表 slug 逐页编写 help.report.{domain}.*';

/** 3-H 快财务（约 18 列表/报表） */
export const HELP_BATCH3_KUAICAIWU: HelpBatchPlanItem[] = [
  { id: 'cw.receipts', title: '收款单', profile: 'richDocument', contentKey: 'receipt', pagePath: 'apps/kuaicaiwu/pages/finance-management/receipts/index.tsx', needsHelpView: true },
  { id: 'cw.payments', title: '付款单', profile: 'richDocument', contentKey: 'payment', pagePath: 'apps/kuaicaiwu/pages/finance-management/payments/index.tsx', needsHelpView: true },
  { id: 'cw.receivables', title: '应收单', profile: 'richDocument', contentKey: 'receivable', pagePath: 'apps/kuaicaiwu/pages/finance-management/receivables/index.tsx', needsHelpView: true },
  { id: 'cw.payables', title: '应付单', profile: 'richDocument', contentKey: 'payable', pagePath: 'apps/kuaicaiwu/pages/finance-management/payables/index.tsx', needsHelpView: true },
  { id: 'cw.salesInvoices', title: '销售发票', profile: 'richDocument', contentKey: 'sales-invoice', pagePath: 'apps/kuaicaiwu/pages/finance-management/sales-invoices/index.tsx', needsHelpView: true },
  { id: 'cw.purchaseInvoices', title: '采购发票', profile: 'richDocument', contentKey: 'purchase-invoice', pagePath: 'apps/kuaicaiwu/pages/finance-management/purchase-invoices/index.tsx', needsHelpView: true },
  { id: 'cw.settlement', title: '核销', profile: 'richDocument', contentKey: 'settlement', pagePath: 'apps/kuaicaiwu/pages/finance-management/settlement/index.tsx', needsHelpView: true },
  { id: 'cw.priceSettlement', title: '价格结算', profile: 'richDocument', contentKey: 'price-settlement', pagePath: 'apps/kuaicaiwu/pages/finance-management/price-settlement/index.tsx', needsHelpView: true },
  { id: 'cw.partnerStatements', title: '伙伴对账单', profile: 'richReport', contentKey: 'common', pagePath: 'apps/kuaicaiwu/pages/finance-management/partner-statements/index.tsx', needsHelpView: false, notes: 'UniReport 通用帮助' },
  { id: 'cw.vouchers', title: '凭证', profile: 'richDocument', contentKey: 'voucher', pagePath: 'apps/kuaicaiwu/pages/gl-management/vouchers/index.tsx', needsHelpView: true },
  { id: 'cw.chartOfAccounts', title: '会计科目', profile: 'richListPage', contentKey: 'kuaicaiwu.chartOfAccounts', pagePath: 'apps/kuaicaiwu/pages/gl-management/chart-of-accounts/index.tsx', needsHelpView: true },
  // 其余 cost-management / tax / margin-report 等同理扩展
];

/** 3-I 收尾：帮助目录与多语（功能稳定后，仍属 batch3 范围但可最后做） */
export const HELP_BATCH3_CATALOG = [
  'HelpDocumentService：仅收录已写 help 的页面摘要与路由',
  'platformUpdateLog / Dashboard 更新说明链接到 help 锚点',
  '六语 i18n：help-pages 生成器输出 en/ja/vi/lo/zh-Hant（用户确认中文稳定后）',
] as const;

export const HELP_BATCH3_ALL_PAGES: HelpBatchPlanItem[] = [
  ...HELP_BATCH3_MODULE_CENTERS,
  ...HELP_BATCH3_MASTER_DATA_LISTS,
  ...HELP_BATCH3_SYSTEM_LISTS,
  ...HELP_BATCH3_KZ_DOCUMENTS,
  ...HELP_BATCH3_KZ_EQUIPMENT,
  ...HELP_BATCH3_KUAICAIWU,
];

/** Batch 3 规模估算（含报表与设备域余量） */
export const HELP_BATCH3_STATS = {
  moduleCenters: HELP_BATCH3_MODULE_CENTERS.length,
  masterDataLists: HELP_BATCH3_MASTER_DATA_LISTS.length,
  systemLists: HELP_BATCH3_SYSTEM_LISTS.length,
  kzDocumentsTier1: HELP_BATCH3_KZ_DOCUMENTS.length,
  kzEquipmentSeed: HELP_BATCH3_KZ_EQUIPMENT.length,
  kzEquipmentRemainingApprox: 32,
  kzReportsApprox: 0,
  kzReportsViaUniReport: true,
  kuaicaiwuSeed: HELP_BATCH3_KUAICAIWU.length,
  kuaicaiwuRemainingApprox: 8,
  totalExplicit: HELP_BATCH3_ALL_PAGES.length,
  totalWithReportsAndEquipmentApprox: 200,
} as const;

export const HELP_PROGRESS = {
  batch1Pages: HELP_BATCH1_DONE.length,
  batch2Pages: HELP_BATCH2_DONE.length,
  batch3PlannedPages: HELP_BATCH3_STATS.totalWithReportsAndEquipmentApprox,
  doneTotal: HELP_BATCH1_DONE.length + HELP_BATCH2_DONE.length,
} as const;
