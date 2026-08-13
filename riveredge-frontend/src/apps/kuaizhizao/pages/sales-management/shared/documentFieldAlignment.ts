import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components'

type FieldRankMap = Record<string, number>
/** 未在对应视图 rank 登记的字段落到此段（业务列与审计列之间） */
export const DEFAULT_UNRANKED_FIELD_RANK = 91.5

function normalizeFieldKey(dataIndex: unknown, fallbackKey?: unknown): string {
  // 显式 key 优先：多字段 dataIndex 数组时仍按业务意图排序（如来源单号）。
  if (typeof fallbackKey === 'string' && fallbackKey.trim()) return fallbackKey.trim()
  if (typeof dataIndex === 'string' && dataIndex.trim()) return dataIndex.trim()
  if (Array.isArray(dataIndex) && dataIndex.length > 0) {
    return String(dataIndex[dataIndex.length - 1] ?? '').trim()
  }
  return ''
}

function sortByRank<T>(
  items: T[],
  getKey: (item: T) => string,
  rankMap: FieldRankMap,
): T[] {
  return items
    .map((item, index) => {
      const key = getKey(item)
      const rank = key && rankMap[key] != null ? rankMap[key] : DEFAULT_UNRANKED_FIELD_RANK
      return { item, index, rank }
    })
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((x) => x.item)
}

/**
 * 普通表格视图（订单/头表）列序唯一真源。
 * 仓储单据除外，见 WAREHOUSE_DOC_LIST_FIELD_RANK。
 *
 * 禁止：页面内 `...GLOBAL_DOC_LIST_FIELD_RANK` 浅覆盖另起 map。
 * 新增/调序：只改本对象；同类字段必须落在同一段位。
 *
 * 段位约定（语义聚类）：
 * - 10–14 单据名称 / 编号 / 主标识叠列；报工：workOrderStacked→operation；返工：product_name_code_stacked→rework_type→original_work_order_code；异常单据：exception_doc_work_order_code→物料/计划结束；检验四单据（同来料）：inspection_code→第二业务叠列→quality_inspection_material；设备单据：单号→设备/路线/计划名
 * - 15–19 伙伴主称谓（客户/供应商等，非叠列时）
 * - 20–29 类型类（合同类型、预测周期、版本、业务模式、分类等）；工单委外：owo_product_stacked→priority；异常：exception_type/alert_level/severity；设备：fault/repair/plan 类型→级别/结果标识
 * - 30–49 品种数 / 数量 / 金额 / 价税度量；报工：work_hours(32) → worker_name(32.5)；work_start_end_stacked(67.05)→reported_at
 * - 50–59 下推 / 进度类
 * - 60–74 时间相关（业务日、计划日、跟进日等）；设备：点检/巡检/故障/维修/执行/调拨/报废/校准日
 * - 75–84 责任人 / 正文 / 关联单号；设备：维修人/执行人/申请人、校准证书号
 * - 88–91.4 审核相位 / 生命周期 / 状态
 * - 91.5 未登记字段（保持声明顺序）
 * - 91.6 isActive
 * - 92–94 更新时间 / 操作
 */
export const GLOBAL_DOC_LIST_FIELD_RANK = {
  // —— 10 单据名称 / 编号 ——
  code: 10,
  name_code: 10,
  calculation_no: 10,
  order_code: 10,
  quotation_code: 10,
  contract_code: 10,
  forecast_code: 10,
  notice_code: 10,
  requisition_code: 10,
  inquiry_code: 10,
  purchase_order_code: 10,
  purchase_receipt_code: 10,
  /** 质量检验单号（来料/工序/成品/OQC） */
  inspection_code: 10,
  receipt_code: 10,
  /** 轻财务单据主标识叠列（伙伴名 + 单号） */
  finance_doc_partner_stacked: 10,
  receivable_code: 10,
  payment_code: 10,
  invoice_code: 10,
  account_code: 10,
  statement_code: 10,
  /** 系统配置：账户/应用/字典等编码列 */
  username: 10,
  account: 10,
  app_code: 10,
  dict_code: 10,
  locale: 10,
  return_code: 10,
  change_code: 10,
  project_code: 10,
  requirement_code: 10,
  review_code: 10,
  fmea_code: 10,
  /** 轻办公：申请/采买/模板/计划/证照编码（asset_code 见资产段） */
  request_code: 10,
  purchase_code: 10,
  template_code: 10,
  plan_code: 10,
  record_code: 10,
  license_code: 10,
  document_code: 10,
  document_type: 21,
  demand_code: 10,
  computation_code: 10,
  /** 需求变更（重排任务）编码 */
  task_code: 10,
  ticket_code: 10,
  batchNo: 10,
  serialNo: 10,
  photo_file_uuid: 10.2,
  forecast_name: 10.3,
  name: 10.4,
  title: 10.4,
  shortName: 10.5,
  source_code: 10.6,
  /** 报工等：工单名称/编号叠列（列上须设 key=workOrderStacked） */
  workOrderStacked: 10,
  /** 返工工单：产品名称/返工单编号叠列 */
  product_name_code_stacked: 10,
  /** 报工等：工序紧跟主标识，固定为第二业务列 */
  operation_name: 11,
  outsource_operation: 11.1,
  /** 工序委外：供应商/单号叠列 → 工序名称/工单编号叠列（第二业务列） */
  supplier_code_stacked: 10,
  operation_work_order_stacked: 11,
  /** 返工工单：返工类型 → 原工单号（第二、第三业务列） */
  rework_type: 11,
  original_work_order_code: 12,
  /**
   * 发货/收货通知、销退/采退：仓库与关联单号紧跟主标识（列上须设同名 key）。
   * 销售：出库仓库 + 销售订单/关联单据；采购：入库仓库 + 采购订单/关联单据。
   */
  outbound_warehouse: 12,
  inbound_warehouse: 12,
  sales_return_warehouse: 12,
  purchase_return_warehouse: 12,
  shipment_sales_order_code: 12.5,
  receipt_purchase_order_code: 12.5,
  sales_return_related_docs: 12.5,
  purchase_return_related_docs: 12.5,

  // —— 15 伙伴主称谓 ——
  customer_name: 15,
  partnerName: 15,
  partnerId: 15.1,
  supplier_name: 15.2,

  /**
   * 异常单据（缺料/延期/质量）：工单编号 → 第二业务列（物料叠列 / 计划结束）→ 类型/级别 → …
   * 异常处理流程：exception_doc_work_order_code → exception_process_type → exception_process_steps
   */
  exception_doc_work_order_code: 10,
  exception_material_stacked: 11,
  exception_planned_end: 11,
  /** 异常处理流程：类型（filled）→ 步骤节点轴 */
  exception_process_type: 11,
  exception_process_steps: 12,
  /**
   * 检验四单据列表段位（以来料检验为准，四页共用同一 map，勿页面浅覆盖）：
   * inspection_code → supplierReceipt / quality_inspection_partner_stacked → quality_inspection_material
   * → 数量类 → quality_inspection_extra → downstream_push_progress → inspector_name → lifecycle
   */
  supplierReceipt: 11,
  quality_inspection_partner_stacked: 11,
  quality_inspection_material: 12,
  /**
   * 8D 管理：标题/编号叠列 → 严重度 → 阶段节点轴 → 来源 → 负责人 → 验证结果 → 计划完成
   */
  eightDStacked: 10,
  eight_d_stages: 23,
  eight_d_source: 24,
  eight_d_owner: 25,
  verification_result: 26,
  /**
   * 设备/模具/工装单据：单号 → 资产编码/名称 → 类型/级别/紧急度 → 结果标识 → 日期 → 人员 → lifecycle/status → action
   */
  document_no: 10,
  fault_no: 10,
  repair_no: 10,
  plan_no: 10,
  execution_no: 10,
  requisition_no: 10,
  application_no: 10,
  route_name: 11,
  plan_name: 11,
  equipment_code: 12,
  equipment_name: 12.5,
  mold_code: 12,
  mold_name: 12.5,
  tool_code: 12,
  tool_name: 12.5,
  fault_type: 20,
  repair_type: 20,
  plan_type: 20,
  maintenance_type: 20.5,
  fault_level: 21,
  urgency: 21,
  repair_required: 22,
  has_abnormality: 23,
  execution_result: 23.5,
  repair_result: 23.5,
  trial_result: 23.5,
  /** 校准结果列 dataIndex 为 result，须设 key=equipment_calibration_result */
  equipment_calibration_result: 23.5,
  purpose: 40,
  check_date: 60,
  patrol_date: 60,
  fault_date: 60,
  repair_date: 60,
  execution_date: 60,
  transfer_date: 60,
  scrap_date: 60,
  calibration_date: 60,
  maintenance_date: 60,
  trial_date: 60,
  borrow_date: 60,
  return_date: 60,
  certificate_no: 81,
  repairer_name: 76.6,
  executor_name: 76.6,
  applicant_name: 76.7,
  /**
   * 物流：货运单/运费单 → 主单号 → 方向/类型 → 承运商 → 运单号 → 金额/应付 → lifecycle
   * 主数据：车牌/承运商名码/驾驶员名码 → 类型/归属 → 联系人 → 启用/状态 → action
   */
  bill_code: 10,
  plate_number: 10,
  logistics_carrier_stacked: 10,
  logistics_driver_stacked: 10,
  business_direction: 20,
  transport_mode: 20.1,
  vehicle_type: 20,
  carrier_type: 20,
  ownership: 21,
  carrier_name: 22,
  tracking_number: 23,
  payable_code: 24,
  contact_name: 77,
  is_enabled: 91.6,
  review_status: 90,
  lifecycle: 91,
  /**
   * 售后：工单/安装/维修/派工/备件/结算/回访/装机档案
   * 主单号(+客户) → 类型/方式 → 来源/工程师 → 时间 → lifecycle
   */
  asset_code: 10,
  job_code: 10,
  dispatch_code: 10,
  settlement_code: 10,
  visit_code: 10,
  after_sales_ticket_stacked: 10,
  after_sales_install_stacked: 10,
  after_sales_asset_stacked: 10,
  repair_mode: 20.4,
  supply_source: 20.4,
  visit_method: 20.4,
  current_stage_key: 23,
  engineer_name: 76.3,
  satisfaction_score: 35,
  planned_start_at: 71,
  visited_at: 71,
  site_address: 77.6,
  serial_number: 28,
  /**
   * 绩效：主数据名码/员工叠列 → 类型 → 数量金额 → 日期/时段 → 启用/汇总状态 → action
   */
  performance_name_code_stacked: 10,
  performance_employee_stacked: 10,
  performance_dept_pos_stacked: 10,
  performance_holiday_stacked: 10,
  calc_mode: 20.4,
  description: 82,
  hourly_rate: 34.05,
  default_piece_rate: 34.15,
  base_salary: 34.25,
  overtimeDate: 60,
  startAt: 70,
  endAt: 70.5,
  stationId: 22,
  reason: 82.1,
  // —— 20 类型类（同类靠拢，均在数量之前）——
  /** 质量异常等：异常子类型（非流程页首列） */
  exception_type: 20,
  exception_work_order_code: 21,
  alert_level: 22,
  severity: 22,
  /** 快数采：连接/点位/规则/边缘类型与健康类 MarkerTag 列 */
  tag_key: 10.15,
  connection_type: 20,
  protocol: 20.05,
  rule_type: 20.1,
  value_type: 20.15,
  map_target: 20.2,
  health_status: 22.1,
  agent_status: 22.15,
  is_online: 91.55,
  last_seen_at: 70,
  last_agent_heartbeat_at: 70.1,
  contract_type: 20,
  forecast_period: 20,
  period: 20,
  forecast_type: 20.2,
  business_mode: 20.2,
  /** 需求变更：重排模式（净变更/全量/what-if） */
  mode: 20.2,
  source_type: 20.3,
  version_no: 20.5,
  version: 20.5,
  change_version: 20.55,
  holidayType: 21,
  category: 21,
  review_type: 21,
  fmea_type: 21,
  demand_type: 21,
  calculation_type: 21,
  calc_type: 21.1,
  target_type: 21.2,
  cost_item_type: 21.3,
  /** 工单委外：产品名称/编码叠列（列上须设 key=owo_product_stacked），优先级紧随其后 */
  owo_product_stacked: 21.9,
  priority: 22,
  activity_type_code: 22,
  /** 客户跟进：跟进内容紧跟跟进方式；售后工单等同名字段同段 */
  content: 22.05,
  request_type: 22.1,
  pool_status: 22.5,
  poolStatus: 22.5,
  /** 客户池：归属业务员 / 协作人 / 联系人电话 紧跟池状态 */
  pool_salesman_name: 22.6,
  collaborators: 22.7,
  pool_contact_phone_stacked: 22.8,
  risk_level: 22.5,
  requirement_source_type: 23,
  change_category: 23,
  calculation_status: 23.5,
  /** 轻财务：开票/收票状态（MarkerTag） */
  invoice_status: 23.6,
  batch_no: 25,

  // —— 30 品种数 / 数量 / 金额 ——
  items_count: 30,
  total_quantity: 31,
  quantity: 31,
  required_quantity: 31,
  available_quantity: 31.1,
  shortage_quantity: 31.2,
  delay_days: 31,
  outsource_quantity: 31.1,
  received_quantity: 31.2,
  inspection_quantity: 31.3,
  sample_qty: 31.3,
  qualified_quantity: 31.4,
  unqualified_quantity: 31.5,
  /** 检验四单据：数量类之后、下推进度之前的专属结论列（如 OQC 放行） */
  quality_inspection_extra: 32,
  reported_quantity: 31.6,
  total_hours: 32,
  standardHours: 32,
  /** 报工工时；生产人员紧随其后 */
  work_hours: 32,
  worker_name: 32.5,
  total_pieces: 32.1,
  unit_price: 33,
  unitPrice: 33,
  variantPrices: 33.1,
  standard_value: 33.2,
  unit: 33.3,
  total_amount: 34,
  /** 工单委外：已发料数量（紧接金额；下推进度 50 须排在其后） */
  issued_quantity: 34.5,
  issuedQuantity: 34.5,
  time_amount: 34.1,
  piece_amount: 34.2,
  released_amount: 34.3,
  delta_amount: 34.4,
  weight: 35,
  rate: 35.1,
  kpi_score: 35.2,
  kpi_coefficient: 35.3,
  material_cost: 36,
  labor_cost: 36.1,
  manufacturing_cost: 36.2,
  unit_cost: 36.3,
  effective_date: 37,
  /** 异常单据：延期原因 / 问题描述 */
  delay_reason: 40,
  problem_description: 40,
  /** 异常单据：建议动作 */
  suggested_action: 50,

  // —— 50 下推 / 进度（工单委外：须在 issued_quantity 34.5 之后）——
  work_order_push_progress: 50,
  order_push_progress: 50,
  downstream_push_progress: 50,
  computation_push_progress: 50,
  /** 发货/收货通知：出库转单 / 入库转单，紧挨关联单号之后、下推进度之前 */
  shipment_outbound_conversion: 13,
  receipt_inbound_conversion: 13,
  outbound_push_progress: 50,
  inbound_push_progress: 50,
  delivery_progress: 51,
  receipt_progress: 51,

  // —— 60 时间相关 ——
  order_date: 60,
  quotation_date: 60,
  contract_date: 60,
  calculation_date: 60,
  holidayDate: 60,
  start_date: 60.5,
  end_date: 60.6,
  planned_start_date: 61,
  planned_end_date: 61.1,
  /** 返工等：计划开始/结束叠列 */
  planned_start_end_stacked: 61,
  /** 工单委外 / 工序委外：计划起止叠列 */
  planned_range_stacked: 61,
  required_date: 61.2,
  delivery_date: 62,
  planned_ship_date: 62.1,
  planned_receipt_date: 62.1,
  valid_to: 62.5,
  effectiveFrom: 63,
  effectiveTo: 63.1,
  productionDate: 63.2,
  expiryDate: 63.3,
  factoryDate: 63.4,
  return_time: 64,
  notified_at: 64.1,
  assigned_at: 64.2,
  recycle_at: 64.3,
  applied_at: 64.4,
  scheduled_at: 65,
  review_date: 65,
  computation_start_time: 65.1,
  computation_end_time: 65.2,
  started_at: 65.1,
  finished_at: 65.2,
  /** 需求变更：创建时间（非固定列末位，列用 key 避开全局 created_at=93） */
  task_created_at: 88,
  timeRange: 66,
  occurred_at: 67,
  registered_at: 67,
  /** 报工：工序开始/完成时间叠列（须在 reported_at / 更新时间之前） */
  work_start_end_stacked: 67.05,
  reported_at: 67.1,
  next_follow_up_at: 68,
  last_follow_up_at: 68.1,
  closed_at: 68.5,
  crossesMidnight: 69,

  // —— 75 责任人 / 正文 / 关联 / 物料（列表偶发列）——
  salesman_name: 75,
  salesman_quotation_date_stacked: 75,
  salesman_id: 75.1,
  salesmanName: 75,
  salesmanId: 75.1,
  buyer_name: 75.5,
  buyer_id: 75.55,
  buyerName: 75.5,
  buyerId: 75.55,
  employee_name: 76,
  reviewer_name: 76.1,
  owner_name: 76.2,
  inspector_name: 76.4,
  responsible_person_name: 76.5,
  inspectorName: 76.4,
  contact_person: 77,
  contactPerson: 77,
  contactTitle: 77.1,
  phone: 77.2,
  contact_phone: 77.2,
  mobile: 77.3,
  email: 77.4,
  address: 77.5,
  department_name: 78,
  position_name: 78.1,
  warehouse_name: 78.5,
  product_code: 79,
  product_name: 79.1,
  material_code: 79.2,
  materialCode: 79.2,
  material_name: 79.3,
  materialName: 79.3,
  material_id: 79.35,
  materialId: 79.35,
  materialModel: 79.4,
  partnerMaterialCode: 79.5,
  partnerMaterialName: 79.6,
  project_name: 80,
  target_code: 80.1,
  target_name: 80.2,
  sales_order_code: 81,
  work_order_code: 81.1,
  source_order_code: 81.2,
  sales_delivery_code: 81.3,
  change_reason: 82,
  failure_reason: 82.1,

  // —— 88 审核 / 生命周期 / 系统 ——
  audit_phase: 89,
  phase: 89,
  /** 需求变更：审批态（右固定，紧挨 lifecycle 之前） */
  approval_status: 90,
  lifecycle_stage: 90.5,
  status: 91,
  is_active: 91.6,
  isActive: 91.6,
  updatedAt: 92,
  createdAt: 93,
  updated_at: 92,
  created_at: 93,
  action: 94,
} satisfies FieldRankMap

/**
 * @deprecated 与 GLOBAL_DOC_LIST_FIELD_RANK 同一对象；保留别名兼容旧 import。
 */
export const SALES_DOC_LIST_FIELD_RANK = GLOBAL_DOC_LIST_FIELD_RANK

/**
 * 明细表格视图列序唯一真源（UniTable detailTable）。
 * 禁止套用 GLOBAL_DOC_LIST_FIELD_RANK；禁止页面浅覆盖另起 map。
 *
 * 段位约定（与头表语义对齐）：
 * - 10 单据主标识
 * - 20 产品 / 物料（品种）
 * - 25 类型类（周期/类型等行上带回）
 * - 30–39 数量 / 价税 / 已交未交
 * - 50–59 行下推 / 进度
 * - 60–69 时间
 * - 88–94 更新时间 / 审核 / 生命周期 / 操作
 */
export const GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK = {
  // 单据标识
  quotation_code: 10,
  order_code: 10,
  contract_code: 10,
  forecast_code: 10,
  inquiry_code: 10,
  purchase_order_code: 10,
  requisition_code: 10,
  notice_code: 10,
  // 品种 / 物料
  material_display: 20,
  material_name: 20,
  material_code: 20.1,
  materialName: 20,
  materialCode: 20.1,
  // 类型类
  forecast_period: 25,
  forecast_type: 25.2,
  // 数量 / 金额
  quote_quantity: 30,
  required_quantity: 30,
  contract_quantity: 30,
  forecast_quantity: 30,
  ordered_quantity: 30,
  quantity: 30,
  unit_price: 31,
  unitPrice: 31,
  tax_rate: 32,
  total_amount: 33,
  item_amount: 33,
  total_price: 33,
  delivered_quantity: 34,
  received_quantity: 34,
  remaining_quantity: 35,
  outstanding_quantity: 35,
  bom_check: 36,
  // 行下推 / 进度
  line_push_progress: 50,
  line_delivery_progress: 51,
  line_release_progress: 52,
  line_receipt_progress: 53,
  // 时间
  quotation_date: 60,
  contract_date: 60,
  forecast_date: 60,
  order_date: 60,
  delivery_date: 61,
  required_date: 62,
  quote_deadline: 63,
  // 系统尾部
  updated_at: 88,
  audit_phase: 89,
  lifecycle_stage: 90,
  status: 91,
  action: 94,
} satisfies FieldRankMap

export function alignProColumns<T extends Record<string, unknown>>(
  columns: ProColumns<T>[],
  rankMap: FieldRankMap = GLOBAL_DOC_LIST_FIELD_RANK,
): ProColumns<T>[] {
  return sortByRank(
    columns,
    (col) => normalizeFieldKey(col.dataIndex as unknown, col.key as unknown),
    rankMap,
  )
}

export function alignDescriptionColumns<T extends Record<string, unknown>>(
  columns: ProDescriptionsItemProps<T>[],
  rankMap: FieldRankMap = GLOBAL_DOC_LIST_FIELD_RANK,
): ProDescriptionsItemProps<T>[] {
  return sortByRank(
    columns,
    (col) => normalizeFieldKey(col.dataIndex as unknown, col.key as unknown),
    rankMap,
  )
}

export const GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK = {
  // 单据标识（详情抽屉 ProDescriptions，非明细表格）
  quotation_code: 10,
  contract_code: 10,
  order_code: 10,
  version_no: 20.5,
  status: 91,
  customer_name: 15,
  customer_contact: 77,
  customer_phone: 77.2,
  salesman_name: 75,
  payment_terms: 78,
  currency_code: 78.1,
  price_type: 20.2,
  total_amount: 34,
  released_amount: 34.3,
  remaining_amount: 35,
  order_date: 60,
  quotation_date: 60,
  contract_date: 60,
  valid_until: 62.5,
  valid_from: 63,
  valid_to: 62.5,
  delivery_date: 62,
  shipping_method: 78.2,
  shipping_address: 77.5,
  quotation_code_link: 81,
  sales_order_code: 81,
  notes: 83,
  updated_at: 92,
} satisfies FieldRankMap

/**
 * @deprecated Prefer GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK.
 */
export const SALES_DOC_DETAIL_BASIC_FIELD_RANK = GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK

export function getSalesCommonFormLabels(t: (key: string) => string) {
  return {
    contact: t('app.kuaizhizao.salesOrder.customerContact'),
    phone: t('app.kuaizhizao.salesOrder.customerPhone'),
    salesman: t('app.kuaizhizao.salesOrder.salesman'),
  } as const
}
