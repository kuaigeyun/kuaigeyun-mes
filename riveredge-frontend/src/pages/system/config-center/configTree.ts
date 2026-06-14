/**
 * 统一配置中心 - 配置树结构定义
 *
 * 将配置拆分为 4 个功能大类：参数设置、审核设置、流程设置、业务自动化。
 * 每个大类内部按 8 个系统模块（销售、计划等）组织，实现 1 对 1 菜单映射。
 */

export type ConfigSource = 'business_config' | 'site_setting' | 'system_parameter' | 'quality_stage_toggle';
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
  /** 在源中的路径 */
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
  /** 分类名称 i18n 键（对齐侧边栏菜单） */
  nameKey: string;
  /** 分类描述 i18n 键 */
  descriptionKey?: string;
  params: ParamMeta[];
}

/** 通用分类（每个 Tab 固定置顶） */
const COMMON_CATEGORY = {
  id: 'common',
  nameKey: 'pages.system.configCenter.category.common',
  descriptionKey: 'pages.system.configCenter.category.commonDesc',
};

/** 8 个标准系统模块的基础定义（按快制造菜单顺序） */
const BASE_MODULES = [
  { id: 'sales', nameKey: 'app.kuaizhizao.menu.sales-management' },
  { id: 'planning', nameKey: 'app.kuaizhizao.menu.plan-management' },
  { id: 'procurement', nameKey: 'app.kuaizhizao.menu.purchase-management' },
  { id: 'production', nameKey: 'app.kuaizhizao.menu.production-execution' },
  { id: 'quality', nameKey: 'app.kuaizhizao.menu.quality-management' },
  { id: 'equipment', nameKey: 'app.kuaizhizao.menu.equipment-management' },
  { id: 'warehouse', nameKey: 'app.kuaizhizao.menu.warehouse-management' },
  { id: 'finance', nameKey: 'app.kuaizhizao.menu.finance-management' },
];

/** 辅助函数：根据模块 ID 快速创建分类列表 */
function createCategories(moduleParams: Record<string, ParamMeta[]>): ConfigCategory[] {
  return [COMMON_CATEGORY, ...BASE_MODULES].map(m => ({
    ...m,
    params: moduleParams[m.id] || [],
  }));
}

/** 1. 参数设置（设置业务本身） */
export const PARAMETER_CATEGORIES: ConfigCategory[] = createCategories({
  common: [
    {
      key: 'common.trial_run_mode',
      nameKey: 'pages.system.configCenter.param.common_trial_run_mode',
      descriptionKey: 'pages.system.configCenter.param.common_trial_run_mode_desc',
      source: 'business_config',
      sourcePath: 'parameters.common.trial_run_mode',
      type: 'boolean',
    },
  ],
  planning: [
    { key: 'bom.bom_multi_version_allowed', nameKey: 'pages.system.configCenter.param.bom_bom_multi_version_allowed', descriptionKey: 'pages.system.configCenter.param.bom_bom_multi_version_allowed_desc', source: 'business_config', sourcePath: 'parameters.bom.bom_multi_version_allowed', type: 'boolean' },
    { key: 'work_order.score_enabled', nameKey: 'pages.system.configCenter.param.work_order_score_enabled', descriptionKey: 'pages.system.configCenter.param.work_order_score_enabled_desc', source: 'business_config', sourcePath: 'parameters.work_order.score_enabled', type: 'boolean' },
    { key: 'work_order.score_stale_minutes', nameKey: 'pages.system.configCenter.param.work_order_score_stale_minutes', descriptionKey: 'pages.system.configCenter.param.work_order_score_stale_minutes_desc', source: 'business_config', sourcePath: 'parameters.work_order.score_stale_minutes', type: 'number', min: 5, max: 1440 },
  ],
  production: [
    { key: 'work_order.priority', nameKey: 'pages.system.configCenter.param.work_order_priority', descriptionKey: 'pages.system.configCenter.param.work_order_priority_desc', source: 'business_config', sourcePath: 'parameters.work_order.priority', type: 'boolean' },
    { key: 'work_order.split', nameKey: 'pages.system.configCenter.param.work_order_split', descriptionKey: 'pages.system.configCenter.param.work_order_split_desc', source: 'business_config', sourcePath: 'parameters.work_order.split', type: 'boolean' },
    { key: 'work_order.merge', nameKey: 'pages.system.configCenter.param.work_order_merge', descriptionKey: 'pages.system.configCenter.param.work_order_merge_desc', source: 'business_config', sourcePath: 'parameters.work_order.merge', type: 'boolean' },
    { key: 'reporting.quick_reporting', nameKey: 'pages.system.configCenter.param.reporting_quick_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_quick_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.quick_reporting', type: 'boolean' },
    { key: 'reporting.parameter_reporting', nameKey: 'pages.system.configCenter.param.reporting_parameter_reporting', descriptionKey: 'pages.system.configCenter.param.reporting_parameter_reporting_desc', source: 'business_config', sourcePath: 'parameters.reporting.parameter_reporting', type: 'boolean' },
    { key: 'reporting.data_correction', nameKey: 'pages.system.configCenter.param.reporting_data_correction', descriptionKey: 'pages.system.configCenter.param.reporting_data_correction_desc', source: 'business_config', sourcePath: 'parameters.reporting.data_correction', type: 'boolean' },
  ],
  warehouse: [
    { key: 'warehouse.batch_management', nameKey: 'pages.system.configCenter.param.warehouse_batch_management', descriptionKey: 'pages.system.configCenter.param.warehouse_batch_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.batch_management', type: 'boolean' },
    { key: 'warehouse.serial_management', nameKey: 'pages.system.configCenter.param.warehouse_serial_management', descriptionKey: 'pages.system.configCenter.param.warehouse_serial_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.serial_management', type: 'boolean' },
    { key: 'warehouse.fifo', nameKey: 'pages.system.configCenter.param.warehouse_fifo', descriptionKey: 'pages.system.configCenter.param.warehouse_fifo_desc', source: 'business_config', sourcePath: 'parameters.warehouse.fifo', type: 'boolean' },
    { key: 'warehouse.lifo', nameKey: 'pages.system.configCenter.param.warehouse_lifo', descriptionKey: 'pages.system.configCenter.param.warehouse_lifo_desc', source: 'business_config', sourcePath: 'parameters.warehouse.lifo', type: 'boolean' },
    { key: 'warehouse.location_management', nameKey: 'pages.system.configCenter.param.warehouse_location_management', descriptionKey: 'pages.system.configCenter.param.warehouse_location_management_desc', source: 'business_config', sourcePath: 'parameters.warehouse.location_management', type: 'boolean' },
  ],
  quality: [
    { key: 'quality_stage.iqc_enabled', nameKey: 'pages.system.configCenter.param.quality_stage_iqc_enabled', descriptionKey: 'pages.system.configCenter.param.quality_stage_iqc_enabled_desc', source: 'quality_stage_toggle', sourcePath: 'quality_stage.iqc_enabled', type: 'boolean' },
    { key: 'quality_stage.ipqc_enabled', nameKey: 'pages.system.configCenter.param.quality_stage_ipqc_enabled', descriptionKey: 'pages.system.configCenter.param.quality_stage_ipqc_enabled_desc', source: 'quality_stage_toggle', sourcePath: 'quality_stage.ipqc_enabled', type: 'boolean' },
    { key: 'quality_stage.fqc_enabled', nameKey: 'pages.system.configCenter.param.quality_stage_fqc_enabled', descriptionKey: 'pages.system.configCenter.param.quality_stage_fqc_enabled_desc', source: 'quality_stage_toggle', sourcePath: 'quality_stage.fqc_enabled', type: 'boolean' },
    { key: 'quality_stage.oqc_enabled', nameKey: 'pages.system.configCenter.param.quality_stage_oqc_enabled', descriptionKey: 'pages.system.configCenter.param.quality_stage_oqc_enabled_desc', source: 'quality_stage_toggle', sourcePath: 'quality_stage.oqc_enabled', type: 'boolean' },
    { key: 'quality.incoming_inspection', nameKey: 'pages.system.configCenter.param.quality_incoming_inspection', descriptionKey: 'pages.system.configCenter.param.quality_incoming_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.incoming_inspection', type: 'boolean' },
    { key: 'quality.process_inspection', nameKey: 'pages.system.configCenter.param.quality_process_inspection', descriptionKey: 'pages.system.configCenter.param.quality_process_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.process_inspection', type: 'boolean' },
    { key: 'quality.finished_inspection', nameKey: 'pages.system.configCenter.param.quality_finished_inspection', descriptionKey: 'pages.system.configCenter.param.quality_finished_inspection_desc', source: 'business_config', sourcePath: 'parameters.quality.finished_inspection', type: 'boolean' },
    { key: 'quality.defect_handling', nameKey: 'pages.system.configCenter.param.quality_defect_handling', descriptionKey: 'pages.system.configCenter.param.quality_defect_handling_desc', source: 'business_config', sourcePath: 'parameters.quality.defect_handling', type: 'boolean' },
    { key: 'quality.require_incoming_inspection_for_receipt', nameKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_receipt', descriptionKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_receipt_desc', source: 'business_config', sourcePath: 'parameters.quality.require_incoming_inspection_for_receipt', type: 'boolean' },
    { key: 'quality.require_incoming_inspection_for_customer_material', nameKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_customer_material', descriptionKey: 'pages.system.configCenter.param.quality_require_incoming_inspection_for_customer_material_desc', source: 'business_config', sourcePath: 'parameters.quality.require_incoming_inspection_for_customer_material', type: 'boolean' },
    { key: 'quality.require_fqc_before_finished_goods_receipt', nameKey: 'pages.system.configCenter.param.quality_require_fqc_before_finished_goods_receipt', descriptionKey: 'pages.system.configCenter.param.quality_require_fqc_before_finished_goods_receipt_desc', source: 'business_config', sourcePath: 'parameters.quality.require_fqc_before_finished_goods_receipt', type: 'boolean' },
  ],
  finance: [
    { key: 'finance.auto_write_off_precision_limit', nameKey: 'pages.system.configCenter.param.finance_auto_write_off_precision_limit', descriptionKey: 'pages.system.configCenter.param.finance_auto_write_off_precision_limit_desc', source: 'business_config', sourcePath: 'parameters.finance.auto_write_off_precision_limit', type: 'number', min: 0, max: 100 },
    {
      key: 'finance.revenue_recognition',
      nameKey: 'pages.system.configCenter.param.finance_revenue_recognition',
      descriptionKey: 'pages.system.configCenter.param.finance_revenue_recognition_desc',
      source: 'business_config',
      sourcePath: 'parameters.finance.revenue_recognition',
      type: 'select',
      selectOptions: [
        { value: 'on_shipment', labelKey: 'pages.system.configCenter.param.finance_revenue_recognition_opt_on_shipment' },
        { value: 'on_invoice', labelKey: 'pages.system.configCenter.param.finance_revenue_recognition_opt_on_invoice' },
      ],
    },
    {
      key: 'finance.payable_recognition',
      nameKey: 'pages.system.configCenter.param.finance_payable_recognition',
      descriptionKey: 'pages.system.configCenter.param.finance_payable_recognition_desc',
      source: 'business_config',
      sourcePath: 'parameters.finance.payable_recognition',
      type: 'select',
      selectOptions: [
        { value: 'on_receipt', labelKey: 'pages.system.configCenter.param.finance_payable_recognition_opt_on_receipt' },
        { value: 'on_purchase_invoice', labelKey: 'pages.system.configCenter.param.finance_payable_recognition_opt_on_purchase_invoice' },
      ],
    },
  ],
});

/** 2. 审核设置（唯一源：/core/audit-bindings + manifest.audit） */
export const AUDIT_CATEGORIES: ConfigCategory[] = createCategories({});

/** 3. 流程设置（设置业务之间的关系） */
export const FLOW_CATEGORIES: ConfigCategory[] = createCategories({
  procurement: [
    { key: 'procurement.require_purchase_requisition', nameKey: 'pages.system.configCenter.param.procurement_require_purchase_requisition', descriptionKey: 'pages.system.configCenter.param.procurement_require_purchase_requisition_desc', source: 'business_config', sourcePath: 'parameters.procurement.require_purchase_requisition', type: 'boolean' },
  ],
  production: [
    { key: 'work_order.picking_confirm_warehouse_only', nameKey: 'pages.system.configCenter.param.work_order_picking_confirm_warehouse_only', descriptionKey: 'pages.system.configCenter.param.work_order_picking_confirm_warehouse_only_desc', source: 'business_config', sourcePath: 'parameters.work_order.picking_confirm_warehouse_only', type: 'boolean' },
    { key: 'work_order.require_confirmed_picking_before_operation_start', nameKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_operation_start', descriptionKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_operation_start_desc', source: 'business_config', sourcePath: 'parameters.work_order.require_confirmed_picking_before_operation_start', type: 'boolean' },
    { key: 'work_order.require_confirmed_picking_before_reporting', nameKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_reporting', descriptionKey: 'pages.system.configCenter.param.work_order_require_confirmed_picking_before_reporting_desc', source: 'business_config', sourcePath: 'parameters.work_order.require_confirmed_picking_before_reporting', type: 'boolean' },
  ],
});

/** 4. 业务自动化（配合taskiq进行业务按需的自动完成） */
export const AUTOMATION_CATEGORIES: ConfigCategory[] = createCategories({
  common: [
    {
      key: 'automation.push_default_mode',
      nameKey: 'pages.system.configCenter.param.automation_push_default_mode',
      descriptionKey: 'pages.system.configCenter.param.automation_push_default_mode_desc',
      source: 'business_config',
      sourcePath: 'parameters.automation.push_default_mode',
      type: 'select',
      selectOptions: [
        { value: 'confirm', labelKey: 'pages.system.configCenter.param.automation_push_default_mode_opt_confirm' },
        { value: 'draft', labelKey: 'pages.system.configCenter.param.automation_push_default_mode_opt_draft' },
      ],
    },
  ],
  production: [
    { key: 'work_order.auto_generate', nameKey: 'pages.system.configCenter.param.work_order_auto_generate', descriptionKey: 'pages.system.configCenter.param.work_order_auto_generate_desc', source: 'business_config', sourcePath: 'parameters.work_order.auto_generate', type: 'boolean' },
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
  ],
  warehouse: [
    { key: 'warehouse.auto_outbound', nameKey: 'pages.system.configCenter.param.warehouse_auto_outbound', descriptionKey: 'pages.system.configCenter.param.warehouse_auto_outbound_desc', source: 'business_config', sourcePath: 'parameters.warehouse.auto_outbound', type: 'boolean' },
  ],
  finance: [
    {
      key: 'finance.auto_generate_receivable_from_sales_invoice',
      nameKey: 'pages.system.configCenter.param.finance_auto_generate_receivable_from_sales_invoice',
      descriptionKey: 'pages.system.configCenter.param.finance_auto_generate_receivable_from_sales_invoice_desc',
      source: 'business_config',
      sourcePath: 'parameters.finance.auto_generate_receivable_from_sales_invoice',
      type: 'boolean',
    },
    {
      key: 'finance.auto_generate_payable_from_purchase_invoice',
      nameKey: 'pages.system.configCenter.param.finance_auto_generate_payable_from_purchase_invoice',
      descriptionKey: 'pages.system.configCenter.param.finance_auto_generate_payable_from_purchase_invoice_desc',
      source: 'business_config',
      sourcePath: 'parameters.finance.auto_generate_payable_from_purchase_invoice',
      type: 'boolean',
    },
    {
      key: 'finance.credit_limit_enabled',
      nameKey: 'pages.system.configCenter.param.finance_credit_limit_enabled',
      descriptionKey: 'pages.system.configCenter.param.finance_credit_limit_enabled_desc',
      source: 'business_config',
      sourcePath: 'parameters.finance.credit_limit_enabled',
      type: 'boolean',
    },
  ],
  quality: [
    { key: 'quality.auto_create_iqc_on_purchase_receipt', nameKey: 'pages.system.configCenter.param.quality_auto_create_iqc_on_purchase_receipt', descriptionKey: 'pages.system.configCenter.param.quality_auto_create_iqc_on_purchase_receipt_desc', source: 'business_config', sourcePath: 'parameters.quality.auto_create_iqc_on_purchase_receipt', type: 'boolean' },
    { key: 'quality.auto_create_ipqc_on_reporting', nameKey: 'pages.system.configCenter.param.quality_auto_create_ipqc_on_reporting', descriptionKey: 'pages.system.configCenter.param.quality_auto_create_ipqc_on_reporting_desc', source: 'business_config', sourcePath: 'parameters.quality.auto_create_ipqc_on_reporting', type: 'boolean' },
    { key: 'quality.auto_create_fqc_on_last_reporting', nameKey: 'pages.system.configCenter.param.quality_auto_create_fqc_on_last_reporting', descriptionKey: 'pages.system.configCenter.param.quality_auto_create_fqc_on_last_reporting_desc', source: 'business_config', sourcePath: 'parameters.quality.auto_create_fqc_on_last_reporting', type: 'boolean' },
    { key: 'quality.auto_create_oqc_on_shipment_notice_notify', nameKey: 'pages.system.configCenter.param.quality_auto_create_oqc_on_shipment_notice_notify', descriptionKey: 'pages.system.configCenter.param.quality_auto_create_oqc_on_shipment_notice_notify_desc', source: 'business_config', sourcePath: 'parameters.quality.auto_create_oqc_on_shipment_notice_notify', type: 'boolean' },
    { key: 'quality.auto_create_oqc_on_sales_delivery', nameKey: 'pages.system.configCenter.param.quality_auto_create_oqc_on_sales_delivery', descriptionKey: 'pages.system.configCenter.param.quality_auto_create_oqc_on_sales_delivery_desc', source: 'business_config', sourcePath: 'parameters.quality.auto_create_oqc_on_sales_delivery', type: 'boolean' },
  ],
});

/** 兼容旧逻辑：默认导出为参数分类 */
export const PROCESS_CATEGORIES = FLOW_CATEGORIES;
export const CONFIG_CATEGORIES = PARAMETER_CATEGORIES;
