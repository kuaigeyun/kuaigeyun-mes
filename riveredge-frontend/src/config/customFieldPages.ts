/**
 * 自定义字段功能页面配置
 * 
 * 定义哪些功能页面可以使用自定义字段
 */

/**
 * 自定义字段功能页面配置接口
 */
export interface CustomFieldPageConfig {
  module: string; // 模块名称
  moduleIcon?: string; // 模块图标
  pageCode: string; // 页面代码（唯一标识）
  pageName: string; // 页面名称
  pagePath: string; // 页面路径
  tableName: string; // 关联的表名（数据库表名）
  tableNameLabel: string; // 表名显示标签
}

/**
 * 功能页面配置列表
 * 
 * 以车间管理为例，后续可以扩展其他页面
 */
export const CUSTOM_FIELD_PAGES: CustomFieldPageConfig[] = [
  // 主数据管理 - 工厂建模
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-factory-workshop',
    pageName: '车间管理',
    pagePath: '/apps/master-data/factory/workshops',
    tableName: 'master_data_factory_workshops',
    tableNameLabel: '车间表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-factory-production-line',
    pageName: '产线管理',
    pagePath: '/apps/master-data/factory/production-lines',
    tableName: 'master_data_factory_production_lines',
    tableNameLabel: '产线表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-factory-workstation',
    pageName: '工位管理',
    pagePath: '/apps/master-data/factory/workstations',
    tableName: 'master_data_factory_workstations',
    tableNameLabel: '工位表',
  },
  // 主数据管理 - 仓库管理
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-warehouse-warehouse',
    pageName: '仓库管理',
    pagePath: '/apps/master-data/warehouse/warehouses',
    tableName: 'master_data_warehouse_warehouses',
    tableNameLabel: '仓库表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-warehouse-storage-area',
    pageName: '库区管理',
    pagePath: '/apps/master-data/warehouse/storage-areas',
    tableName: 'master_data_warehouse_storage_areas',
    tableNameLabel: '库区表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-warehouse-storage-location',
    pageName: '库位管理',
    pagePath: '/apps/master-data/warehouse/storage-locations',
    tableName: 'master_data_warehouse_storage_locations',
    tableNameLabel: '库位表',
  },
  // 主数据管理 - 物料管理
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-material-group',
    pageName: '物料分组',
    pagePath: '/apps/master-data/materials',
    tableName: 'master_data_material_groups',
    tableNameLabel: '物料分组表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-material',
    pageName: '物料管理',
    pagePath: '/apps/master-data/materials',
    tableName: 'master_data_materials',
    tableNameLabel: '物料表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-engineering-bom',
    pageName: '工程BOM',
    pagePath: '/apps/master-data/process/engineering-bom',
    tableName: 'master_data_boms',
    tableNameLabel: '工程BOM表',
  },
  // 主数据管理 - 工艺管理
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-defect-type',
    pageName: '缺陷类型管理',
    pagePath: '/apps/master-data/process/defect-types',
    tableName: 'master_data_defect_types',
    tableNameLabel: '缺陷类型表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-operation',
    pageName: '工序管理',
    pagePath: '/apps/master-data/process/operations',
    tableName: 'master_data_operations',
    tableNameLabel: '工序表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-process-route',
    pageName: '工艺路线管理',
    pagePath: '/apps/master-data/process/routes',
    tableName: 'master_data_process_routes',
    tableNameLabel: '工艺路线表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-manufacturing-bom',
    pageName: '制造SOP',
    pagePath: '/apps/master-data/process/sop',
    tableName: 'master_data_sops',
    tableNameLabel: '制造SOP表',
  },
  // 主数据管理 - 供应链
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-customer',
    pageName: '客户管理',
    pagePath: '/apps/master-data/supply-chain/customers',
    tableName: 'master_data_customers',
    tableNameLabel: '客户表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-supplier',
    pageName: '供应商管理',
    pagePath: '/apps/master-data/supply-chain/suppliers',
    tableName: 'master_data_suppliers',
    tableNameLabel: '供应商表',
  },
  // 主数据管理 - 绩效管理
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-holiday',
    pageName: '节假日管理',
    pagePath: '/apps/master-data/performance/holidays',
    tableName: 'master_data_holidays',
    tableNameLabel: '节假日表',
  },
  {
    module: '主数据管理',
    moduleIcon: 'database',
    pageCode: 'master-data-skill',
    pageName: '技能管理',
    pagePath: '/apps/master-data/performance/skills',
    tableName: 'master_data_skills',
    tableNameLabel: '技能表',
  },
];

/**
 * 按模块分组获取功能页面配置
 */
export const getCustomFieldPagesByModule = (): Record<string, CustomFieldPageConfig[]> => {
  return CUSTOM_FIELD_PAGES.reduce((acc, page) => {
    if (!acc[page.module]) {
      acc[page.module] = [];
    }
    acc[page.module].push(page);
    return acc;
  }, {} as Record<string, CustomFieldPageConfig[]>);
};

/**
 * 获取所有模块名称
 */
export const getCustomFieldModules = (): string[] => {
  return Array.from(new Set(CUSTOM_FIELD_PAGES.map(page => page.module)));
};

/**
 * 根据页面代码获取页面配置
 */
export const getCustomFieldPageByCode = (pageCode: string): CustomFieldPageConfig | undefined => {
  return CUSTOM_FIELD_PAGES.find(page => page.pageCode === pageCode);
};

