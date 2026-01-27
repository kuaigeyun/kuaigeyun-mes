/**
 * 编码规则功能页面配置
 * 
 * 定义系统中所有有编码字段的功能页面，用于在编码规则页面展示和配置。
 */

/**
 * 功能页面配置接口
 */
export interface CodeRulePageConfig {
  /**
   * 页面唯一标识（用于关联编码规则）
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
   * 编码字段名称（前端字段名）
   */
  codeField: string;
  /**
   * 编码字段显示名称
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
   * 是否启用自动编码（默认：false）
   */
  autoGenerate?: boolean;
  /**
   * 关联的编码规则代码（可选）
   */
  ruleCode?: string;
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
    codeFieldLabel: '厂区编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-factory-workshop',
    pageName: '车间管理',
    pagePath: '/apps/master-data/factory/workshops',
    codeField: 'code',
    codeFieldLabel: '车间编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-factory-production-line',
    pageName: '产线管理',
    pagePath: '/apps/master-data/factory/production-lines',
    codeField: 'code',
    codeFieldLabel: '产线编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-factory-workstation',
    pageName: '工位管理',
    pagePath: '/apps/master-data/factory/workstations',
    codeField: 'code',
    codeFieldLabel: '工位编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  // 主数据管理 - 仓库管理
  {
    pageCode: 'master-data-warehouse-warehouse',
    pageName: '仓库管理',
    pagePath: '/apps/master-data/warehouse/warehouses',
    codeField: 'code',
    codeFieldLabel: '仓库编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-warehouse-storage-area',
    pageName: '库区管理',
    pagePath: '/apps/master-data/warehouse/storage-areas',
    codeField: 'code',
    codeFieldLabel: '库区编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-warehouse-storage-location',
    pageName: '库位管理',
    pagePath: '/apps/master-data/warehouse/storage-locations',
    codeField: 'code',
    codeFieldLabel: '库位编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  // 主数据管理 - 物料管理
  {
    pageCode: 'master-data-material-group',
    pageName: '物料分组',
    pagePath: '/apps/master-data/materials',
    codeField: 'code',
    codeFieldLabel: '分组编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-material',
    pageName: '物料管理',
    pagePath: '/apps/master-data/materials',
    codeField: 'mainCode',
    codeFieldLabel: '物料主编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'MATERIAL_CODE',
    allowManualEdit: true,
    availableFields: [
      {
        fieldName: 'group_code',
        fieldLabel: '物料分组编码',
        fieldType: 'string',
        description: '物料所属分组的编码',
      },
      {
        fieldName: 'group_name',
        fieldLabel: '物料分组名称',
        fieldType: 'string',
        description: '物料所属分组的名称',
      },
      {
        fieldName: 'material_type',
        fieldLabel: '物料类型',
        fieldType: 'string',
        description: '物料类型（FIN/SEMI/RAW/PACK/AUX）',
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
    codeFieldLabel: '工序编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
    ruleCode: 'OPERATION_CODE',
  },
  {
    pageCode: 'master-data-process-route',
    pageName: '工艺路线',
    pagePath: '/apps/master-data/process/routes',
    codeField: 'code',
    codeFieldLabel: '工艺路线编码',
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
    pageCode: 'master-data-engineering-bom',
    pageName: '工程BOM',
    pagePath: '/apps/master-data/process/engineering-bom',
    codeField: 'bomCode',
    codeFieldLabel: 'BOM编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: true,
    ruleCode: 'ENGINEERING_BOM_CODE',
    allowManualEdit: true,
    availableFields: [
      {
        fieldName: 'material_code',
        fieldLabel: '主物料编码',
        fieldType: 'string',
        description: 'BOM主物料的编码',
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
    codeFieldLabel: '不良品编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
    ruleCode: 'DEFECT_TYPE_CODE',
  },
  // 主数据管理 - 供应链
  {
    pageCode: 'master-data-supply-chain-customer',
    pageName: '客户管理',
    pagePath: '/apps/master-data/supply-chain/customers',
    codeField: 'code',
    codeFieldLabel: '客户编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-supply-chain-supplier',
    pageName: '供应商管理',
    pagePath: '/apps/master-data/supply-chain/suppliers',
    codeField: 'code',
    codeFieldLabel: '供应商编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  // 主数据管理 - 绩效管理
  {
    pageCode: 'master-data-performance-skill',
    pageName: '技能管理',
    pagePath: '/apps/master-data/performance/skills',
    codeField: 'code',
    codeFieldLabel: '技能编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  
  // ==================== 快格轻制造 APP ====================
  // 快格轻制造 - 生产执行
  {
    pageCode: 'kuaizhizao-production-work-order',
    pageName: '工单管理',
    pagePath: '/apps/kuaizhizao/production-execution/work-orders',
    codeField: 'code',
    codeFieldLabel: '工单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'WORK_ORDER_CODE',
  },
  {
    pageCode: 'kuaizhizao-production-rework-order',
    pageName: '返工单',
    pagePath: '/apps/kuaizhizao/production-execution/rework-orders',
    codeField: 'code',
    codeFieldLabel: '返工单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'REWORK_ORDER_CODE',
  },
  {
    pageCode: 'kuaizhizao-production-outsource-order',
    pageName: '委外单',
    pagePath: '/apps/kuaizhizao/production-execution/outsource-orders',
    codeField: 'code',
    codeFieldLabel: '委外单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'OUTSOURCE_ORDER_CODE',
  },
  
  // 快格轻制造 - 采购管理
  {
    pageCode: 'kuaizhizao-purchase-order',
    pageName: '采购订单',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-orders',
    codeField: 'code',
    codeFieldLabel: '采购订单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PURCHASE_ORDER_CODE',
  },
  {
    pageCode: 'kuaizhizao-purchase-receipt',
    pageName: '采购收货',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-receipts',
    codeField: 'code',
    codeFieldLabel: '采购收货单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PURCHASE_RECEIPT_CODE',
  },
  
  // 快格轻制造 - 销售管理
  {
    pageCode: 'kuaizhizao-sales-order',
    pageName: '销售订单',
    pagePath: '/apps/kuaizhizao/sales-management/sales-orders',
    codeField: 'code',
    codeFieldLabel: '销售订单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_ORDER_CODE',
  },
  {
    pageCode: 'kuaizhizao-sales-delivery',
    pageName: '销售发货',
    pagePath: '/apps/kuaizhizao/sales-management/sales-deliveries',
    codeField: 'code',
    codeFieldLabel: '销售发货单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_DELIVERY_CODE',
  },
  {
    pageCode: 'kuaizhizao-sales-forecast',
    pageName: '销售预测',
    pagePath: '/apps/kuaizhizao/sales-management/sales-forecasts',
    codeField: 'code',
    codeFieldLabel: '销售预测编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_FORECAST_CODE',
  },
  
  // 快格轻制造 - 仓储管理
  {
    pageCode: 'kuaizhizao-warehouse-inbound',
    pageName: '生产领料',
    pagePath: '/apps/kuaizhizao/warehouse-management/inbound',
    codeField: 'code',
    codeFieldLabel: '领料单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PRODUCTION_PICKING_CODE',
  },
  {
    pageCode: 'kuaizhizao-warehouse-finished-goods-inbound',
    pageName: '成品入库',
    pagePath: '/apps/kuaizhizao/warehouse-management/finished-goods-inventory',
    codeField: 'code',
    codeFieldLabel: '成品入库单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'FINISHED_GOODS_RECEIPT_CODE',
  },
  {
    pageCode: 'kuaizhizao-warehouse-sales-outbound',
    pageName: '销售出库',
    pagePath: '/apps/kuaizhizao/warehouse-management/sales-outbound',
    codeField: 'code',
    codeFieldLabel: '销售出库单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_OUTBOUND_CODE',
  },
  
  // 快格轻制造 - 质量管理
  {
    pageCode: 'kuaizhizao-quality-incoming-inspection',
    pageName: '来料检验',
    pagePath: '/apps/kuaizhizao/quality-management/incoming-inspection',
    codeField: 'code',
    codeFieldLabel: '来料检验单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'INCOMING_INSPECTION_CODE',
  },
  {
    pageCode: 'kuaizhizao-quality-process-inspection',
    pageName: '过程检验',
    pagePath: '/apps/kuaizhizao/quality-management/process-inspection',
    codeField: 'code',
    codeFieldLabel: '过程检验单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PROCESS_INSPECTION_CODE',
  },
  {
    pageCode: 'kuaizhizao-quality-finished-goods-inspection',
    pageName: '成品检验',
    pagePath: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
    codeField: 'code',
    codeFieldLabel: '成品检验单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'FINISHED_GOODS_INSPECTION_CODE',
  },
  
  // 快格轻制造 - 计划管理
  {
    pageCode: 'kuaizhizao-plan-production-plan',
    pageName: '生产计划',
    pagePath: '/apps/kuaizhizao/plan-management/production-plans',
    codeField: 'code',
    codeFieldLabel: '生产计划编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'PRODUCTION_PLAN_CODE',
  },
  
  // 快格轻制造 - 采购管理（补充）
  {
    pageCode: 'kuaizhizao-purchase-return',
    pageName: '采购退货',
    pagePath: '/apps/kuaizhizao/purchase-management/purchase-returns',
    codeField: 'return_code',
    codeFieldLabel: '采购退货单编码',
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
    codeFieldLabel: '销售退货单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'SALES_RETURN_CODE',
  },
  
  // 快格轻制造 - 生产执行（补充）
  {
    pageCode: 'kuaizhizao-production-outsource-work-order',
    pageName: '委外工单',
    pagePath: '/apps/kuaizhizao/production-execution/outsource-work-orders',
    codeField: 'code',
    codeFieldLabel: '委外工单编码',
    module: '快格轻制造',
    moduleIcon: 'tool',
    autoGenerate: false,
    ruleCode: 'OUTSOURCE_WORK_ORDER_CODE',
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

