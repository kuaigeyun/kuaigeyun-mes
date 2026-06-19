/**
 * 编号规则功能页面配置
 * 
 * 定义系统中所有有编号字段的功能页面，用于在编号规则页面展示和配置。
 */

/**
 * 功能页面配置接口
 */
export interface CodeRulePageConfig {
  /**
   * 页面唯一标识（用于关联编号规则）
   */
  pageCode: string;
  /**
   * 页面名称
   */
  pageName: string;
  /**
   * 页面路径
   */
  pagePath: string;
  /**
   * 编号字段名称（前端字段名）
   */
  codeField: string;
  /**
   * 编号字段显示名称
   */
  codeFieldLabel: string;
  /**
   * 所属模块
   */
  module: string;
  /**
   * 模块图标
   */
  moduleIcon?: string;
  /**
   * 是否启用自动编号（默认：false）
   */
  autoGenerate?: boolean;
  /**
   * 是否允许手动编辑
   */
  allowManualEdit?: boolean;
  /**
   * 可用字段（用于编号规则变量）
   */
  availableFields?: {
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    description?: string;
  }[];
  /**
   * 关联的编号规则代码（可选）
   */
  ruleCode?: string;
  /**
   * 是否跳过日期组件（设备/模具/工装：EQ+4位、MOLD+4位、TOOL+4位）
   */
  skipDate?: boolean;
}

/**
 * 功能页面配置列表
 * 
 * 以车间管理为例，后续可以扩展其他页面
 */
export const CODE_RULE_PAGES: CodeRulePageConfig[] = [
  // 主数据管理 - 工厂建模
  {
    pageCode: 'master-data-factory-plant',
    pageName: '厂区管理',
    pagePath: '/apps/master-data/factory/plants',
    codeField: 'code',
    codeFieldLabel: '厂区编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_FACTORY_PLANT',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-factory-workshop',
    pageName: '车间管理',
    pagePath: '/apps/master-data/factory/workshops',
    codeField: 'code',
    codeFieldLabel: '车间编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_FACTORY_WORKSHOP',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-factory-production-line',
    pageName: '产线管理',
    pagePath: '/apps/master-data/factory/production-lines',
    codeField: 'code',
    codeFieldLabel: '产线编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_FACTORY_PRODUCTION_LINE',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-factory-workstation',
    pageName: '工位管理',
    pagePath: '/apps/master-data/factory/workstations',
    codeField: 'code',
    codeFieldLabel: '工位编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_FACTORY_WORKSTATION',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-factory-work-center',
    pageName: '工作中心',
    pagePath: '/apps/master-data/factory/work-centers',
    codeField: 'code',
    codeFieldLabel: '工作中心编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'WORK_CENTER_CODE',
    allowManualEdit: true,
    skipDate: true,
  },
  {
    pageCode: 'master-data-factory-work-group',
    pageName: '工作小组',
    pagePath: '/apps/master-data/factory/work-groups',
    codeField: 'code',
    codeFieldLabel: '工作小组编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'WORK_GROUP_CODE',
    allowManualEdit: true,
    skipDate: true,
  },
  // 主数据管理 - 仓库管理
  {
    pageCode: 'master-data-warehouse-warehouse',
    pageName: '仓库管理',
    pagePath: '/apps/master-data/warehouse/warehouses',
    codeField: 'code',
    codeFieldLabel: '仓库编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_WAREHOUSE_WAREHOUSE',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-warehouse-storage-area',
    pageName: '库区管理',
    pagePath: '/apps/master-data/warehouse/storage-areas',
    codeField: 'code',
    codeFieldLabel: '库区编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_WAREHOUSE_STORAGE_AREA',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-warehouse-storage-location',
    pageName: '库位管理',
    pagePath: '/apps/master-data/warehouse/storage-locations',
    codeField: 'code',
    codeFieldLabel: '库位编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_WAREHOUSE_STORAGE_LOCATION',
    allowManualEdit: true,
  },
  // 主数据管理 - 物料管理
  {
    pageCode: 'master-data-material-group',
    pageName: '物料分组',
    pagePath: '/apps/master-data/materials',
    codeField: 'code',
    codeFieldLabel: '分组编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MASTER_DATA_MATERIAL_GROUP',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-material',
    pageName: '物料管理',
    pagePath: '/apps/master-data/materials',
    codeField: 'mainCode',
    codeFieldLabel: '物料主编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MATERIAL_CODE',
    allowManualEdit: true,
    availableFields: [
      {
        fieldName: 'group_code',
        fieldLabel: '物料分组编号',
        fieldType: 'string',
        description: '物料所属分组的编号（参与编号生成）',
      },
      {
        fieldName: 'group_name',
        fieldLabel: '物料分组名称',
        fieldType: 'string',
        description: '物料所属分组的名称',
      },
      {
        fieldName: 'source_type',
        fieldLabel: '物料来源类型',
        fieldType: 'string',
        description: '物料来源类型（Make/Buy/Outsource/Phantom/Configure）',
      },
      {
        fieldName: 'name',
        fieldLabel: '物料名称',
        fieldType: 'string',
        description: '物料名称',
      },
    ],
  },
  // 主数据管理 - 工艺管理
  {
    pageCode: 'master-data-process-operation',
    pageName: '工序管理',
    pagePath: '/apps/master-data/process/operations',
    codeField: 'code',
    codeFieldLabel: '工序编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'OPERATION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-process-route',
    pageName: '工艺路线',
    pagePath: '/apps/master-data/process/routes',
    codeField: 'code',
    codeFieldLabel: '工艺路线编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'PROCESS_ROUTE_CODE',
    allowManualEdit: true,
    availableFields: [
      {
        fieldName: 'name',
        fieldLabel: '工艺路线名称',
        fieldType: 'string',
        description: '工艺路线名称',
      },
    ],
  },
  {
    pageCode: 'master-data-process-drawing',
    pageName: '图纸管理',
    pagePath: '/apps/master-data/process/drawings',
    codeField: 'code',
    codeFieldLabel: '图号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'ENGINEERING_DRAWING_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-engineering-bom',
    pageName: '物料清单BOM',
    pagePath: '/apps/master-data/process/engineering-bom',
    codeField: 'bomCode',
    codeFieldLabel: 'BOM编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'ENGINEERING_BOM_CODE',
    allowManualEdit: true,
    availableFields: [
      {
        fieldName: 'material_code',
        fieldLabel: '主物料编号',
        fieldType: 'string',
        description: 'BOM主物料的编号',
      },
      {
        fieldName: 'material_name',
        fieldLabel: '主物料名称',
        fieldType: 'string',
        description: 'BOM主物料的名称',
      },
      {
        fieldName: 'version',
        fieldLabel: '版本号',
        fieldType: 'string',
        description: 'BOM版本号',
      },
    ],
  },
  {
    pageCode: 'master-data-defect-type',
    pageName: '不良品项',
    pagePath: '/apps/master-data/process/defect-types',
    codeField: 'code',
    codeFieldLabel: '不良品编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'DEFECT_TYPE_CODE',
    allowManualEdit: true,
  },
  // 主数据管理 - 供应链
  {
    pageCode: 'master-data-supply-chain-customer',
    pageName: '客户管理',
    pagePath: '/apps/master-data/supply-chain/customers',
    codeField: 'code',
    codeFieldLabel: '客户编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'customer',
    allowManualEdit: true,
  },
  {
    pageCode: 'master-data-supply-chain-supplier',
    pageName: '供应商管理',
    pagePath: '/apps/master-data/supply-chain/suppliers',
    codeField: 'code',
    codeFieldLabel: '供应商编号',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'supplier',
    allowManualEdit: true,
  },
  // 系统配置 — 组织与权限（用户导入自动创建）
  {
    pageCode: 'system-department',
    pageName: '部门管理',
    pagePath: '/system/departments',
    codeField: 'code',
    codeFieldLabel: '部门代码',
    module: '系统配置',
    moduleIcon: 'setting',
    autoGenerate: true,
    ruleCode: 'DEPARTMENT_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'system-position',
    pageName: '职位管理',
    pagePath: '/system/positions',
    codeField: 'code',
    codeFieldLabel: '职位代码',
    module: '系统配置',
    moduleIcon: 'setting',
    autoGenerate: true,
    ruleCode: 'POSITION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'system-role',
    pageName: '角色管理',
    pagePath: '/system/roles',
    codeField: 'code',
    codeFieldLabel: '角色代码',
    module: '系统配置',
    moduleIcon: 'setting',
    autoGenerate: true,
    ruleCode: 'ROLE_CODE',
    allowManualEdit: true,
  },
  // 快格轻制造 - 绩效管理（技能）
  {
    pageCode: 'master-data-performance-skill',
    pageName: '技能管理',
    pagePath: '/apps/kuaizhizao/performance/skills',
    codeField: 'code',
    codeFieldLabel: '技能编号',
    module: '快格轻制造',
    moduleIcon: 'production',
    autoGenerate: false,
  },
  
  // ==================== 快格轻制造 APP ====================
  // 快格轻制造 - 生产执行
  {
    pageCode: 'kuaizhizao-production-work-order',
    pageName: '工单管理',
    pagePath: '/apps/kuaizhizao/production-execution/work-orders',
    codeField: 'code',
    codeFieldLabel: '工单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'WORK_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-rework-order',
    pageName: '返工工单',
    pagePath: '/apps/kuaizhizao/production-execution/rework-orders',
    codeField: 'code',
    codeFieldLabel: '返工工单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'REWORK_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-outsource-order',
    pageName: '委外单',
    pagePath: '/apps/kuaizhizao/production-execution/outsource-orders',
    codeField: 'code',
    codeFieldLabel: '委外单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OUTSOURCE_ORDER_CODE',
    allowManualEdit: true,
  },
  
  // 快格轻制造 - 采购管理
  {
    pageCode: 'kuaizhizao-purchase-order',
    pageName: '采购订单',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-orders',
    codeField: 'order_code',
    codeFieldLabel: '采购订单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PURCHASE_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-purchase-order-change',
    pageName: '采购变更单',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-order-changes',
    codeField: 'change_code',
    codeFieldLabel: '采购变更单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PURCHASE_ORDER_CHANGE_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-purchase-requisition',
    pageName: '采购申请',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-requisitions',
    codeField: 'requisition_code',
    codeFieldLabel: '采购申请编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PURCHASE_REQUISITION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-purchase-inquiry',
    pageName: '采购询价单',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-inquiries',
    codeField: 'inquiry_code',
    codeFieldLabel: '询价单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PURCHASE_INQUIRY_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-purchase-receipt',
    pageName: '采购入库',
    pagePath: '/apps/kuaizhizao/warehouse-management/inbound',
    codeField: 'receipt_code',
    codeFieldLabel: '采购入库单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PURCHASE_RECEIPT_CODE',
    allowManualEdit: true,
  },
  
  // 快格轻制造 - 销售管理
  {
    pageCode: 'kuaizhizao-sales-order',
    pageName: '销售订单',
    pagePath: '/apps/kuaizhizao/sales-management/sales-orders',
    codeField: 'order_code',
    codeFieldLabel: '销售订单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'SALES_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-sales-order-change',
    pageName: '销售变更单',
    pagePath: '/apps/kuaizhizao/sales-management/sales-order-changes',
    codeField: 'change_code',
    codeFieldLabel: '销售变更单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'SALES_ORDER_CHANGE_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-quotation',
    pageName: '报价单',
    pagePath: '/apps/kuaizhizao/sales-management/quotations',
    codeField: 'quotation_code',
    codeFieldLabel: '报价单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'QUOTATION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-sales-contract',
    pageName: '销售合同',
    pagePath: '/apps/kuaizhizao/sales-management/sales-contracts',
    codeField: 'contract_code',
    codeFieldLabel: '合同编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'KUAIZHIZAO_SALES_CONTRACT',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-sales-contract-change',
    pageName: '销售合同变更',
    pagePath: '/apps/kuaizhizao/sales-management/sales-contracts',
    codeField: 'change_code',
    codeFieldLabel: '合同变更编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'KUAIZHIZAO_SALES_CONTRACT_CHANGE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-sales-delivery',
    pageName: '销售发货',
    pagePath: '/apps/kuaizhizao/warehouse-management/outbound',
    codeField: 'delivery_code',
    codeFieldLabel: '销售发货单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'SALES_DELIVERY_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-sales-forecast',
    pageName: '销售预测',
    pagePath: '/apps/kuaizhizao/sales-management/sales-forecasts',
    codeField: 'forecast_code',
    codeFieldLabel: '销售预测编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'SALES_FORECAST_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-shipment-notice',
    pageName: '发货通知单',
    pagePath: '/apps/kuaizhizao/sales-management/shipment-notices',
    codeField: 'notice_code',
    codeFieldLabel: '发货通知单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'SHIPMENT_NOTICE_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-receipt-notice',
    pageName: '收货通知单',
    pagePath: '/apps/kuaizhizao/purchase-management/receipt-notices',
    codeField: 'notice_code',
    codeFieldLabel: '收货通知单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'RECEIPT_NOTICE_CODE',
    allowManualEdit: true,
  },
  
  // 快格轻制造 - 仓储管理
  {
    pageCode: 'kuaizhizao-warehouse-inbound',
    pageName: '生产领料',
    pagePath: '/apps/kuaizhizao/warehouse-management/inbound',
    codeField: 'code',
    codeFieldLabel: '领料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PRODUCTION_PICKING_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-production-return',
    pageName: '生产退料',
    pagePath: '/apps/kuaizhizao/warehouse-management/inbound',
    codeField: 'return_code',
    codeFieldLabel: '退料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PRODUCTION_RETURN_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-other-inbound',
    pageName: '其他入库',
    pagePath: '/apps/kuaizhizao/warehouse-management/other-inbound',
    codeField: 'inbound_code',
    codeFieldLabel: '入库单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OTHER_INBOUND_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-other-outbound',
    pageName: '其他出库',
    pagePath: '/apps/kuaizhizao/warehouse-management/other-outbound',
    codeField: 'outbound_code',
    codeFieldLabel: '出库单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OTHER_OUTBOUND_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-finished-goods-inbound',
    pageName: '成品入库',
    pagePath: '/apps/kuaizhizao/warehouse-management/inbound',
    codeField: 'code',
    codeFieldLabel: '成品入库单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'FINISHED_GOODS_RECEIPT_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-batching-order',
    pageName: '配料单',
    pagePath: '/apps/kuaizhizao/warehouse-management/batching-center',
    codeField: 'code',
    codeFieldLabel: '配料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'BATCHING_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-stocktaking',
    pageName: '盘点单',
    pagePath: '/apps/kuaizhizao/warehouse-management/stocktaking',
    codeField: 'code',
    codeFieldLabel: '盘点单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'STOCKTAKING_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-inventory-transfer',
    pageName: '调拨单',
    pagePath: '/apps/kuaizhizao/warehouse-management/inventory-transfer',
    codeField: 'code',
    codeFieldLabel: '调拨单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'INVENTORY_TRANSFER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-assembly-order',
    pageName: '组装单',
    pagePath: '/apps/kuaizhizao/warehouse-management/assembly-orders',
    codeField: 'code',
    codeFieldLabel: '组装单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'ASSEMBLY_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-assembly-template',
    pageName: '组装模板',
    pagePath: '/apps/kuaizhizao/warehouse-management/assembly-orders',
    codeField: 'template_code',
    codeFieldLabel: '组装模板编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'ASSEMBLY_TEMPLATE_CODE',
    allowManualEdit: true,
  },

  // 快格轻制造 - 质量管理
  {
    pageCode: 'kuaizhizao-quality-incoming-inspection',
    pageName: '来料检验',
    pagePath: '/apps/kuaizhizao/quality-management/incoming-inspection',
    codeField: 'code',
    codeFieldLabel: '来料检验单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'INCOMING_INSPECTION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-quality-process-inspection',
    pageName: '过程检验',
    pagePath: '/apps/kuaizhizao/quality-management/process-inspection',
    codeField: 'code',
    codeFieldLabel: '过程检验单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PROCESS_INSPECTION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-quality-finished-goods-inspection',
    pageName: '成品检验',
    pagePath: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
    codeField: 'code',
    codeFieldLabel: '成品检验单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'FINISHED_GOODS_INSPECTION_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-quality-inspection-plan',
    pageName: '质检方案',
    pagePath: '/apps/kuaizhizao/quality-management/inspection-plans',
    codeField: 'plan_code',
    codeFieldLabel: '质检方案编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'INSPECTION_PLAN_CODE',
    allowManualEdit: true,
  },

  // 快格轻制造 - 计划管理
  {
    pageCode: 'kuaizhizao-plan-production-plan',
    pageName: '生产计划',
    pagePath: '/apps/kuaizhizao/plan-management/production-plans',
    codeField: 'code',
    codeFieldLabel: '生产计划编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'PRODUCTION_PLAN_CODE',
    allowManualEdit: true,
  },
  
  // 快格轻制造 - 采购管理（补充）
  {
    pageCode: 'kuaizhizao-purchase-return',
    pageName: '采购退货',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-returns',
    codeField: 'return_code',
    codeFieldLabel: '采购退货单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PURCHASE_RETURN_CODE',
  },
  
  // 快格轻制造 - 销售管理（补充）
  {
    pageCode: 'kuaizhizao-sales-return',
    pageName: '销售退货',
    pagePath: '/apps/kuaizhizao/sales-management/sales-returns',
    codeField: 'return_code',
    codeFieldLabel: '销售退货单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_RETURN_CODE',
  },
  
  // 快格轻制造 - 设备管理（EQ+4位流水）
  {
    pageCode: 'kuaizhizao-equipment-management-equipment',
    pageName: '设备管理',
    pagePath: '/apps/kuaizhizao/equipment-management/equipment',
    codeField: 'code',
    codeFieldLabel: '设备编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'EQUIPMENT_CODE',
    allowManualEdit: true,
    skipDate: true,
  },
  // 快格轻制造 - 模具管理（MOLD+4位流水）
  {
    pageCode: 'kuaizhizao-equipment-management-mold',
    pageName: '模具管理',
    pagePath: '/apps/kuaizhizao/equipment-management/molds',
    codeField: 'code',
    codeFieldLabel: '模具编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'MOLD_CODE',
    allowManualEdit: true,
    skipDate: true,
  },
  // 快格轻制造 - 工装台账（TOOL+4位流水）
  {
    pageCode: 'kuaizhizao-equipment-management-tool',
    pageName: '工装台账',
    pagePath: '/apps/kuaizhizao/equipment-management/tool-ledger',
    codeField: 'code',
    codeFieldLabel: '工装编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'TOOL_CODE',
    allowManualEdit: true,
    skipDate: true,
  },
  // 快格轻制造 - 生产执行（补充）
  {
    pageCode: 'kuaizhizao-warehouse-material-borrow',
    pageName: '借料单',
    pagePath: '/apps/kuaizhizao/warehouse-management/material-borrows',
    codeField: 'borrow_code',
    codeFieldLabel: '借料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'MATERIAL_BORROW_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-warehouse-material-return',
    pageName: '还料单',
    pagePath: '/apps/kuaizhizao/warehouse-management/material-returns',
    codeField: 'return_code',
    codeFieldLabel: '还料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'MATERIAL_RETURN_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-outsource-work-order',
    pageName: '委外工单',
    pagePath: '/apps/kuaizhizao/production-execution/outsource-work-orders',
    codeField: 'code',
    codeFieldLabel: '委外工单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OUTSOURCE_WORK_ORDER_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-outsource-material-receipt',
    pageName: '委外收货',
    pagePath: '/apps/kuaizhizao/warehouse-management/batching-center',
    codeField: 'code',
    codeFieldLabel: '委外收货单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OUTSOURCE_MATERIAL_RECEIPT_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-outsource-material-return',
    pageName: '委外退料',
    pagePath: '/apps/kuaizhizao/warehouse-management/batching-center',
    codeField: 'code',
    codeFieldLabel: '委外退料单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OUTSOURCE_MATERIAL_RETURN_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaizhizao-production-outsource-product-return',
    pageName: '委外退货',
    pagePath: '/apps/kuaizhizao/warehouse-management/batching-center',
    codeField: 'code',
    codeFieldLabel: '委外退货单编号',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: true,
    ruleCode: 'OUTSOURCE_PRODUCT_RETURN_CODE',
    allowManualEdit: true,
  },

  // ==================== 快研发 APP ====================
  {
    pageCode: 'kuaiplm-rd-project',
    pageName: '研发项目',
    pagePath: '/apps/kuaiplm/rd-projects',
    codeField: 'project_code',
    codeFieldLabel: '项目编号',
    module: '快研发',
    moduleIcon: 'experiment',
    autoGenerate: true,
    ruleCode: 'RD_PROJECT_CODE',
    allowManualEdit: true,
  },
  {
    pageCode: 'kuaiplm-delivery-project',
    pageName: '交付项目',
    pagePath: '/apps/kuaiplm/rd-projects',
    codeField: 'project_code',
    codeFieldLabel: '项目编号',
    module: '快研发',
    moduleIcon: 'experiment',
    autoGenerate: true,
    ruleCode: 'DELIVERY_PROJECT_CODE',
    allowManualEdit: true,
  },
];

/**
 * 根据页面代码获取页面配置
 * 
 * @param pageCode - 页面代码
 * @returns 页面配置或 undefined
 */
export function getCodeRulePageConfig(pageCode: string): CodeRulePageConfig | undefined {
  return CODE_RULE_PAGES.find(page => page.pageCode === pageCode);
}

/**
 * 根据模块分组页面配置
 * 
 * @returns 按模块分组的页面配置
 */
export function getCodeRulePagesByModule(): Record<string, CodeRulePageConfig[]> {
  const grouped: Record<string, CodeRulePageConfig[]> = {};
  
  CODE_RULE_PAGES.forEach(page => {
    if (!grouped[page.module]) {
      grouped[page.module] = [];
    }
    grouped[page.module].push(page);
  });
  
  return grouped;
}

/**
 * 获取所有模块列表
 * 
 * @returns 模块列表
 */
export function getCodeRuleModules(): string[] {
  const modules = new Set<string>();
  CODE_RULE_PAGES.forEach(page => {
    modules.add(page.module);
  });
  return Array.from(modules);
}

