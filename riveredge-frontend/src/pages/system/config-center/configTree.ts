/**
 * 统一配置中心 - 配置树结构定义
 *
 * 按功能分类，每个参数项对应一个卡片；名称与描述使用 i18n 键。
 */

export type ConfigSource = 'business_config' | 'site_setting' | 'system_parameter';
export type ParamType = 'boolean' | 'number' | 'string' | 'color';

export interface ParamMeta {
  /** 参数唯一标识（用于 form 字段） */
  key: string;
  /** 显示名称 i18n 键 */
  nameKey: string;
  /** 描述 i18n 键 */
  descriptionKey: string;
  /** 数据源 */
  source: ConfigSource;
  /** 在源中的路径，如 business_config: "parameters.work_order.allow_production_without_material" */
  sourcePath: string;
  /** 参数类型 */
  type: ParamType;
  /** 数字类型：最小值 */
  min?: number;
  /** 数字类型：最大值 */
  max?: number;
}

export interface ConfigCategory {
  id: string;
  /** 分类名称 i18n 键 */
  nameKey: string;
  /** 分类描述 i18n 键 */
  descriptionKey?: string;
  params: ParamMeta[];
}

/** 流程设置分类（审核、流转、自动审批等） */
export const PROCESS_CATEGORIES: ConfigCategory[] = [
  {
    id: 'process_sales',
    nameKey: 'pages.system.configCenter.processCategory.sales',
    descriptionKey: 'pages.system.configCenter.processCategory.salesDesc',
    params: [
      { key: 'sales.audit_enabled', nameKey: 'pages.system.configCenter.param.sales_audit_enabled', descriptionKey: 'pages.system.configCenter.param.sales_audit_enabled_desc', source: 'business_config', sourcePath: 'parameters.sales.audit_enabled', type: 'boolean' },
    ],
  },
  {
    id: 'process_planning',
    nameKey: 'pages.system.configCenter.processCategory.planning',
    descriptionKey: 'pages.system.configCenter.processCategory.planningDesc',
    params: [
      { key: 'planning.require_production_plan', nameKey: 'pages.system.configCenter.param.planning_require_production_plan', descriptionKey: 'pages.system.configCenter.param.planning_require_production_plan_desc', source: 'business_config', sourcePath: 'parameters.planning.require_production_plan', type: 'boolean' },
    ],
  },
  {
    id: 'process_procurement',
    nameKey: 'pages.system.configCenter.processCategory.procurement',
    descriptionKey: 'pages.system.configCenter.processCategory.procurementDesc',
    params: [
      { key: 'procurement.require_purchase_requisition', nameKey: 'pages.system.configCenter.param.procurement_require_purchase_requisition', descriptionKey: 'pages.system.configCenter.param.procurement_require_purchase_requisition_desc', source: 'business_config', sourcePath: 'parameters.procurement.require_purchase_requisition', type: 'boolean' },
      { key: 'purchase.auto_approval', nameKey: 'pages.system.configCenter.param.purchase_auto_approval', descriptionKey: 'pages.system.configCenter.param.purchase_auto_approval_desc', source: 'business_config', sourcePath: 'parameters.purchase.auto_approval', type: 'boolean' },
    ],
  },
  {
    id: 'process_reporting',
    nameKey: 'pages.system.configCenter.processCategory.reporting',
    descriptionKey: 'pages.system.configCenter.processCategory.reportingDesc',
    params: [
      { key: 'reporting.auto_approve', nameKey: 'pages.system.configCenter.param.reporting_auto_approve', descriptionKey: 'pages.system.configCenter.param.reporting_auto_approve_desc', source: 'business_config', sourcePath: 'parameters.reporting.auto_approve', type: 'boolean' },
    ],
  },
];

/** 参数设置分类（业务值、功能开关，不含流程类） */
export const PARAMETER_CATEGORIES: ConfigCategory[] = [
  {
    id: 'production',
    nameKey: 'pages.system.configCenter.category.production',
    descriptionKey: 'pages.system.configCenter.category.productionDesc',
    params: [
      { key: 'work_order.allow_production_without_material', nameKey: 'pages.system.configCenter.param.work_order_allow_production_without_material', descriptionKey: 'pages.system.configCenter.param.work_order_allow_production_without_material_desc', source: 'business_config', sourcePath: 'parameters.work_order.allow_production_without_material', type: 'boolean' },
      { key: 'work_order.auto_generate', nameKey: 'pages.system.configCenter.param.work_order_auto_generate', descriptionKey: 'pages.system.configCenter.param.work_order_auto_generate_desc', source: 'business_config', sourcePath: 'parameters.work_order.auto_generate', type: 'boolean' },
      { key: 'work_order.priority', nameKey: 'pages.system.configCenter.param.work_order_priority', descriptionKey: 'pages.system.configCenter.param.work_order_priority_desc', source: 'business_config', sourcePath: 'parameters.work_order.priority', type: 'boolean' },
      { key: 'work_order.split', nameKey: 'pages.system.configCenter.param.work_order_split', descriptionKey: 'pages.system.configCenter.param.work_order_split_desc', source: 'business_config', sourcePath: 'parameters.work_order.split', type: 'boolean' },
      { key: 'work_order.merge', nameKey: 'pages.system.configCenter.param.work_order_merge', descriptionKey: 'pages.system.configCenter.param.work_order_merge_desc', source: 'business_config', sourcePath: 'parameters.work_order.merge', type: 'boolean' },
      { key: 'reporting.quick_reporting', nameKey: 'pages.system.configCenter.param.reporting_quick_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_quick_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.quick_reporting', type: 'boolean' },
      { key: 'reporting.parameter_reporting', nameKey: 'pages.system.configCenter.param.reporting_parameter_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_parameter_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.parameter_reporting', type: 'boolean' },
      { key: 'reporting.auto_fill', nameKey: 'pages.system.configCenter.param.reporting_auto_fill', descriptionKey: 'pages.system.configCenter.param.reporting_auto_fill_desc', source: 'business_config', sourcePath: 'parameters.reporting.auto_fill', type: 'boolean' },
      { key: 'reporting.data_correction', nameKey: 'pages.system.configCenter.param.reporting_data_correction', descriptionKey: 'pages.system.configCenter.param.reporting_data_correction_desc', source: 'business_config', sourcePath: 'parameters.reporting.data_correction', type: 'boolean' },
      { key: 'bom.bom_multi_version_allowed', nameKey: 'pages.system.configCenter.param.bom_bom_multi_version_allowed', descriptionKey: 'pages.system.configCenter.param.bom_bom_multi_version_allowed_desc', source: 'business_config', sourcePath: 'parameters.bom.bom_multi_version_allowed', type: 'boolean' },
    ],
  },
  {
    id: 'supply',
    nameKey: 'pages.system.configCenter.category.supply',
    descriptionKey: 'pages.system.configCenter.category.supplyDesc',
    params: [
      { key: 'warehouse.batch_management', nameKey: 'pages.system.configCenter.param.warehouse_batch_management', descriptionKey: 'pages.system.configCenter.param.warehouse_batch_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.batch_management', type: 'boolean' },
      { key: 'warehouse.serial_management', nameKey: 'pages.system.configCenter.param.warehouse_serial_management', descriptionKey: 'pages.system.configCenter.param.warehouse_serial_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.serial_management', type: 'boolean' },
      { key: 'warehouse.multi_unit', nameKey: 'pages.system.configCenter.param.warehouse_multi_unit', descriptionKey: 'pages.system.configCenter.param.warehouse_multi_unit_desc', source: 'business_config', sourcePath: 'parameters.warehouse.multi_unit', type: 'boolean' },
      { key: 'warehouse.fifo', nameKey: 'pages.system.configCenter.param.warehouse_fifo', descriptionKey: 'pages.system.configCenter.param.warehouse_fifo_desc', source: 'business_config', sourcePath: 'parameters.warehouse.fifo', type: 'boolean' },
      { key: 'warehouse.lifo', nameKey: 'pages.system.configCenter.param.warehouse_lifo', descriptionKey: 'pages.system.configCenter.param.warehouse_lifo_desc', source: 'business_config', sourcePath: 'parameters.warehouse.lifo', type: 'boolean' },
      { key: 'warehouse.location_management', nameKey: 'pages.system.configCenter.param.warehouse_location_management', descriptionKey: 'pages.system.configCenter.param.warehouse_location_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.location_management', type: 'boolean' },
      { key: 'warehouse.auto_outbound', nameKey: 'pages.system.configCenter.param.warehouse_auto_outbound', descriptionKey: 'pages.system.configCenter.param.warehouse_auto_outbound_desc', source: 'business_config', sourcePath: 'parameters.warehouse.auto_outbound', type: 'boolean' },
    ],
  },
  {
    id: 'sales_quality',
    nameKey: 'pages.system.configCenter.category.sales_quality',
    descriptionKey: 'pages.system.configCenter.category.sales_qualityDesc',
    params: [
      { key: 'quality.incoming_inspection', nameKey: 'pages.system.configCenter.param.quality_incoming_inspection', descriptionKey: 'pages.system.configCenter.param.quality_incoming_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.incoming_inspection', type: 'boolean' },
      { key: 'quality.process_inspection', nameKey: 'pages.system.configCenter.param.quality_process_inspection', descriptionKey: 'pages.system.configCenter.param.quality_process_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.process_inspection', type: 'boolean' },
      { key: 'quality.finished_inspection', nameKey: 'pages.system.configCenter.param.quality_finished_inspection', descriptionKey: 'pages.system.configCenter.param.quality_finished_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.finished_inspection', type: 'boolean' },
      { key: 'quality.defect_handling', nameKey: 'pages.system.configCenter.param.quality_defect_handling', descriptionKey: 'pages.system.configCenter.param.quality_defect_handling_desc', source: 'business_config', sourcePath: 'parameters.quality.defect_handling', type: 'boolean' },
    ],
  },
];

/** 兼容旧代码：参数设置分类（等同于 PARAMETER_CATEGORIES） */
export const CONFIG_CATEGORIES = PARAMETER_CATEGORIES;
