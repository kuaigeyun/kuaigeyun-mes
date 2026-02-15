/**
 * 统一配置中心 - 配置树结构定义
 *
 * 按功能分类，每个参数项对应一个卡片
 */

export type ConfigSource = 'business_config' | 'site_setting' | 'system_parameter';
export type ParamType = 'boolean' | 'number' | 'string' | 'color';

export interface ParamMeta {
  /** 参数唯一标识（用于 form 字段） */
  key: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
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
  name: string;
  description?: string;
  params: ParamMeta[];
}

/** 配置分类树 */
export const CONFIG_CATEGORIES: ConfigCategory[] = [
  {
    id: 'production',
    name: '生产与计划',
    description: '工单、报工、BOM、计划相关参数',
    params: [
      {
        key: 'work_order.allow_production_without_material',
        name: '允许不带料生产',
        description: '开启时，工单下达不检查缺料，只管制造过程；关闭时，缺料则禁止下达。',
        source: 'business_config',
        sourcePath: 'parameters.work_order.allow_production_without_material',
        type: 'boolean',
      },
      {
        key: 'work_order.auto_generate',
        name: '自动生成工单',
        description: '是否自动根据需求生成工单',
        source: 'business_config',
        sourcePath: 'parameters.work_order.auto_generate',
        type: 'boolean',
      },
      {
        key: 'work_order.priority',
        name: '工单优先级',
        description: '是否启用工单优先级管理',
        source: 'business_config',
        sourcePath: 'parameters.work_order.priority',
        type: 'boolean',
      },
      {
        key: 'work_order.split',
        name: '工单拆分',
        description: '是否支持工单拆分',
        source: 'business_config',
        sourcePath: 'parameters.work_order.split',
        type: 'boolean',
      },
      {
        key: 'work_order.merge',
        name: '工单合并',
        description: '是否支持工单合并',
        source: 'business_config',
        sourcePath: 'parameters.work_order.merge',
        type: 'boolean',
      },
      {
        key: 'reporting.quick_reporting',
        name: '快速报工',
        description: '是否启用快速报工功能',
        source: 'business_config',
        sourcePath: 'parameters.reporting.quick_reporting',
        type: 'boolean',
      },
      {
        key: 'reporting.parameter_reporting',
        name: '带参数报工',
        description: '是否支持带参数报工',
        source: 'business_config',
        sourcePath: 'parameters.reporting.parameter_reporting',
        type: 'boolean',
      },
      {
        key: 'reporting.auto_fill',
        name: '自动填充',
        description: '是否自动填充报工数据',
        source: 'business_config',
        sourcePath: 'parameters.reporting.auto_fill',
        type: 'boolean',
      },
      {
        key: 'reporting.data_correction',
        name: '报工数据修正',
        description: '是否允许修正已提交的报工数据',
        source: 'business_config',
        sourcePath: 'parameters.reporting.data_correction',
        type: 'boolean',
      },
      {
        key: 'bom.bom_multi_version_allowed',
        name: 'BOM 允许多版本共存',
        description: '开启时，需求计算时可选择 BOM 版本；关闭时，统一使用各物料的默认 BOM 版本。',
        source: 'business_config',
        sourcePath: 'parameters.bom.bom_multi_version_allowed',
        type: 'boolean',
      },
      {
        key: 'planning.require_production_plan',
        name: '需求必须经生产计划',
        description: '开启时，需求计算必须生成生产计划再下工单；关闭时可直连工单。',
        source: 'business_config',
        sourcePath: 'parameters.planning.require_production_plan',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'supply',
    name: '供应链',
    description: '采购、仓储相关参数',
    params: [
      {
        key: 'procurement.require_purchase_requisition',
        name: '必须采购申请',
        description: '是否必须先创建采购申请才能下达采购订单',
        source: 'business_config',
        sourcePath: 'parameters.procurement.require_purchase_requisition',
        type: 'boolean',
      },
      {
        key: 'warehouse.batch_management',
        name: '批号管理',
        description: '是否启用批号管理',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.batch_management',
        type: 'boolean',
      },
      {
        key: 'warehouse.serial_management',
        name: '序列号管理',
        description: '是否启用序列号管理',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.serial_management',
        type: 'boolean',
      },
      {
        key: 'warehouse.multi_unit',
        name: '多单位管理',
        description: '是否启用多单位管理',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.multi_unit',
        type: 'boolean',
      },
      {
        key: 'warehouse.fifo',
        name: '先进先出（FIFO）',
        description: '是否启用先进先出规则',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.fifo',
        type: 'boolean',
      },
      {
        key: 'warehouse.lifo',
        name: '后进先出（LIFO）',
        description: '是否启用后进先出规则',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.lifo',
        type: 'boolean',
      },
      {
        key: 'warehouse.location_management',
        name: '库位管理',
        description: '是否启用库位管理',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.location_management',
        type: 'boolean',
      },
      {
        key: 'warehouse.auto_outbound',
        name: '自动出库',
        description: '是否支持自动出库',
        source: 'business_config',
        sourcePath: 'parameters.warehouse.auto_outbound',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'sales_quality',
    name: '销售与质量',
    description: '销售订单、质量管理参数',
    params: [
      {
        key: 'sales.audit_enabled',
        name: '销售订单审核',
        description: '是否启用销售订单审核流程。若关闭，订单提交后将自动通过/生效。',
        source: 'business_config',
        sourcePath: 'parameters.sales.audit_enabled',
        type: 'boolean',
      },
      {
        key: 'quality.incoming_inspection',
        name: '来料检验',
        description: '是否启用来料检验',
        source: 'business_config',
        sourcePath: 'parameters.quality.incoming_inspection',
        type: 'boolean',
      },
      {
        key: 'quality.process_inspection',
        name: '过程检验',
        description: '是否启用过程检验',
        source: 'business_config',
        sourcePath: 'parameters.quality.process_inspection',
        type: 'boolean',
      },
      {
        key: 'quality.finished_inspection',
        name: '成品检验',
        description: '是否启用成品检验',
        source: 'business_config',
        sourcePath: 'parameters.quality.finished_inspection',
        type: 'boolean',
      },
      {
        key: 'quality.defect_handling',
        name: '不合格品处理',
        description: '是否启用不合格品处理',
        source: 'business_config',
        sourcePath: 'parameters.quality.defect_handling',
        type: 'boolean',
      },
    ],
  },
  {
    id: 'system',
    name: '系统设置',
    description: '安全、界面、网络等系统级参数',
    params: [
      {
        key: 'security.token_check_interval',
        name: 'Token 检查间隔 (秒)',
        description: '前端检查 Token 是否过期的频率',
        source: 'site_setting',
        sourcePath: 'security.token_check_interval',
        type: 'number',
        min: 10,
        max: 300,
      },
      {
        key: 'security.inactivity_timeout',
        name: '用户不活动超时 (秒)',
        description: '用户无操作多长时间后自动登出，0 表示禁用',
        source: 'site_setting',
        sourcePath: 'security.inactivity_timeout',
        type: 'number',
        min: 0,
      },
      {
        key: 'security.user_cache_time',
        name: '用户信息缓存时间 (秒)',
        description: '用户信息在前端缓存的时间，过期后会重新获取',
        source: 'site_setting',
        sourcePath: 'security.user_cache_time',
        type: 'number',
        min: 0,
      },
      {
        key: 'ui.max_tabs',
        name: '最大打开标签页数',
        description: '超过限制数量时，最旧的未固定标签将被自动关闭',
        source: 'site_setting',
        sourcePath: 'ui.max_tabs',
        type: 'number',
        min: 5,
        max: 50,
      },
      {
        key: 'ui.default_page_size',
        name: '表格默认每页条数',
        description: '所有表格默认的分页大小',
        source: 'site_setting',
        sourcePath: 'ui.default_page_size',
        type: 'number',
        min: 5,
        max: 100,
      },
      {
        key: 'ui.table_loading_delay',
        name: '表格加载延迟 (毫秒)',
        description: '设置加载状态显示的延迟时间，避免快速请求时的闪烁',
        source: 'site_setting',
        sourcePath: 'ui.table_loading_delay',
        type: 'number',
        min: 0,
        max: 1000,
      },
      {
        key: 'theme_config.colorPrimary',
        name: '默认主题色',
        description: '系统的默认主色调',
        source: 'site_setting',
        sourcePath: 'theme_config.colorPrimary',
        type: 'color',
      },
      {
        key: 'network.timeout',
        name: '请求超时时间 (毫秒)',
        description: 'API 请求的默认超时时间',
        source: 'site_setting',
        sourcePath: 'network.timeout',
        type: 'number',
        min: 1000,
      },
      {
        key: 'system.max_retries',
        name: '最大重试次数',
        description: '请求失败时的最大自动重试次数',
        source: 'site_setting',
        sourcePath: 'system.max_retries',
        type: 'number',
        min: 0,
        max: 5,
      },
    ],
  },
];
