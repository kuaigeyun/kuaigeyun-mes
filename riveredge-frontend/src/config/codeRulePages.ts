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
    pagePath: '/apps/master-data/materials/groups',
    codeField: 'code',
    codeFieldLabel: '分组编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
  },
  {
    pageCode: 'master-data-material',
    pageName: '物料管理',
    pagePath: '/apps/master-data/materials/materials',
    codeField: 'code',
    codeFieldLabel: '物料编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
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
  },
  {
    pageCode: 'master-data-process-route',
    pageName: '工艺路线',
    pagePath: '/apps/master-data/process/routes',
    codeField: 'code',
    codeFieldLabel: '路线编码',
    module: '主数据管理',
    moduleIcon: 'database',
    autoGenerate: false,
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

