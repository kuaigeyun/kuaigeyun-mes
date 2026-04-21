/**
 * 统一配置中心 - 配置树结构定义
 *
 * 按功能分类，每个参数项对应一个卡片；名称与描述使用 i18n 键。
 */

export type ConfigSource = 'business_config' | 'site_setting' | 'system_parameter';
export type ParamType = 'boolean' | 'number' | 'string' | 'color' | 'select';

/** 下拉选项（label 使用 i18n key，由页面 t(labelKey) 渲染） */
export interface ParamSelectOption {
  value: string;
  labelKey: string;
}

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
  /** type 为 select 时的选项 */
  selectOptions?: ParamSelectOption[];
}

export interface ConfigCategory {
  id: string;
  /** 分类名称 i18n 键 */
  nameKey: string;
  /** 分类描述 i18n 键 */
  descriptionKey?: string;
  params: ParamMeta[];
}

/** 流程设置分类（流转、前置条件等；单据人工审核请在「审批流程」中启用对应流程） */
export const PROCESS_CATEGORIES: ConfigCategory[] = [
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
    ],
  },
  {
    id: 'process_work_order',
    nameKey: 'pages.system.configCenter.processCategory.work_order',
    descriptionKey: 'pages.system.configCenter.processCategory.work_orderDesc',
    params: [
      { key: 'work_order.picking_confirm_warehouse_only', nameKey: 'pages.system.configCenter.param.work_order_picking_confirm_warehouse_only', descriptionKey: 'pages.system.configCenter.param.work_order_picking_confirm_warehouse_only_desc', source: 'business_config', sourcePath: 'parameters.work_order.picking_confirm_warehouse_only', type: 'boolean' },
      { key: 'work_order.require_confirmed_picking_before_operation_start', nameKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_operation_start', descriptionKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_operation_start_desc', source: 'business_config', sourcePath: 'parameters.work_order.require_confirmed_picking_before_operation_start', type: 'boolean' },
      { key: 'work_order.require_confirmed_picking_before_reporting', nameKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_reporting', descriptionKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_reporting_desc', source: 'business_config', sourcePath: 'parameters.work_order.require_confirmed_picking_before_reporting', type: 'boolean' },
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
      {
        key: 'work_order.last_operation_auto_inbound_mode',
        nameKey: 'pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode',
        descriptionKey: 'pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_desc',
        source: 'business_config',
        sourcePath: 'parameters.work_order.last_operation_auto_inbound_mode',
        type: 'select',
        selectOptions: [
          { value: 'none', labelKey: 'pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_none' },
          { value: 'direct_inbound', labelKey: 'pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_direct' },
          { value: 'inbound_notice', labelKey: 'pages.system.configCenter.param.work_order_last_operation_auto_inbound_mode_opt_notice' },
        ],
      },
      { key: 'reporting.quick_reporting', nameKey: 'pages.system.configCenter.param.reporting_quick_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_quick_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.quick_reporting', type: 'boolean' },
      { key: 'reporting.parameter_reporting', nameKey: 'pages.system.configCenter.param.reporting_parameter_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_parameter_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.parameter_reporting', type: 'boolean' },
      { key: 'reporting.data_correction', nameKey: 'pages.system.configCenter.param.reporting_data_correction', descriptionKey: 'pages.system.configCenter.param.reporting_data_correction_desc', source: 'business_config', sourcePath: 'parameters.reporting.data_correction', type: 'boolean' },
      { key: 'reporting.auto_approve', nameKey: 'pages.system.configCenter.param.reporting_auto_approve', descriptionKey: 'pages.system.configCenter.param.reporting_auto_approve_desc', source: 'business_config', sourcePath: 'parameters.reporting.auto_approve', type: 'boolean' },
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
      { key: 'quality.require_incoming_inspection_for_receipt', nameKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_receipt', descriptionKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_receipt_desc', source: 'business_config', sourcePath: 'parameters.quality.require_incoming_inspection_for_receipt', type: 'boolean' },
      { key: 'quality.incoming_inspection', nameKey: 'pages.system.configCenter.param.quality_incoming_inspection', descriptionKey: 'pages.system.configCenter.param.quality_incoming_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.incoming_inspection', type: 'boolean' },
      { key: 'quality.process_inspection', nameKey: 'pages.system.configCenter.param.quality_process_inspection', descriptionKey: 'pages.system.configCenter.param.quality_process_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.process_inspection', type: 'boolean' },
      { key: 'quality.finished_inspection', nameKey: 'pages.system.configCenter.param.quality_finished_inspection', descriptionKey: 'pages.system.configCenter.param.quality_finished_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.finished_inspection', type: 'boolean' },
      { key: 'quality.defect_handling', nameKey: 'pages.system.configCenter.param.quality_defect_handling', descriptionKey: 'pages.system.configCenter.param.quality_defect_handling_desc', source: 'business_config', sourcePath: 'parameters.quality.defect_handling', type: 'boolean' },
    ],
  },
];

/** 兼容旧代码：参数设置分类（等同于 PARAMETER_CATEGORIES） */
export const CONFIG_CATEGORIES = PARAMETER_CATEGORIES;
