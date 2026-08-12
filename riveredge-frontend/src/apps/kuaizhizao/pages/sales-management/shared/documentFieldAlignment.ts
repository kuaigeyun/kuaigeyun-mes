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
 * - 10–14 单据名称 / 编号 / 主标识叠列
 * - 15–19 伙伴主称谓（客户/供应商等，非叠列时）
 * - 20–29 类型类（合同类型、预测周期、版本、业务模式、分类等）
 * - 30–49 品种数 / 数量 / 金额 / 价税度量
 * - 50–59 下推 / 进度类
 * - 60–74 时间相关（业务日、计划日、跟进日等）
 * - 75–84 责任人 / 正文 / 关联单号
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
  receipt_code: 10,
  return_code: 10,
  change_code: 10,
  requirement_code: 10,
  review_code: 10,
  fmea_code: 10,
  demand_code: 10,
  computation_code: 10,
  ticket_code: 10,
  batchNo: 10,
  serialNo: 10,
  photo_file_uuid: 10.2,
  forecast_name: 10.3,
  name: 10.4,
  title: 10.4,
  shortName: 10.5,
  source_code: 10.6,
  /**
   * 发货/收货通知、销退/采退：仓库与关联单号紧跟主标识（列上须设同名 key）。
   * 销售：出库仓库 + 销售订单/关联单据；采购：入库仓库 + 采购订单/关联单据。
   */
  outbound_warehouse: 11,
  inbound_warehouse: 11,
  sales_return_warehouse: 11,
  purchase_return_warehouse: 11,
  shipment_sales_order_code: 12,
  receipt_purchase_order_code: 12,
  sales_return_related_docs: 12,
  purchase_return_related_docs: 12,

  // —— 15 伙伴主称谓 ——
  customer_name: 15,
  partnerName: 15,
  partnerId: 15.1,
  supplier_name: 15.2,

  // —— 20 类型类（同类靠拢，均在数量之前）——
  contract_type: 20,
  forecast_period: 20,
  period: 20,
  forecast_type: 20.2,
  business_mode: 20.2,
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

  // —— 30 品种数 / 数量 / 金额 ——
  items_count: 30,
  total_quantity: 31,
  quantity: 31,
  outsource_quantity: 31.1,
  received_quantity: 31.2,
  inspection_quantity: 31.3,
  sample_qty: 31.3,
  qualified_quantity: 31.4,
  unqualified_quantity: 31.5,
  reported_quantity: 31.6,
  total_hours: 32,
  standardHours: 32,
  total_pieces: 32.1,
  unit_price: 33,
  unitPrice: 33,
  variantPrices: 33.1,
  standard_value: 33.2,
  unit: 33.3,
  total_amount: 34,
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

  // —— 50 下推 / 进度 ——
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
  timeRange: 66,
  occurred_at: 67,
  registered_at: 67,
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
  worker_name: 76.3,
  inspector_name: 76.4,
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
  operation_name: 78.2,
  outsource_operation: 78.3,
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

  // —— 88 审核 / 生命周期 / 系统 ——
  audit_phase: 89,
  phase: 89,
  lifecycle_stage: 90,
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
