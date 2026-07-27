import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components'

type FieldRankMap = Record<string, number>
/** 未在 GLOBAL_DOC_LIST_FIELD_RANK 登记的字段落到此段（业务列与审计列之间） */
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
 * 全应用列表列序唯一真源（仓储单据除外，见 WAREHOUSE_DOC_LIST_FIELD_RANK）。
 * 新增列表字段时只改此处；禁止再开 PARTNER_* / MASTER_DATA_* 等旁路 map。
 *
 * 段位约定：
 * - 10–20 主标识 / 伙伴
 * - 20–40 联系 / 物料 / 责任人
 * - 40–70 日期 / 分类 / 数量金额
 * - 88–91.4 生命周期状态类
 * - 91.5 未登记字段（保持声明顺序）
 * - 91.6 isActive（紧挨更新时间之前）
 * - 92–93 审计
 */
export const GLOBAL_DOC_LIST_FIELD_RANK = {
  // 主标识与客户
  code: 10,
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
  demand_code: 10,
  computation_code: 10,
  batchNo: 10,
  serialNo: 10,
  partnerId: 10.2,
  partnerName: 10.3,
  supplier_name: 10.4,
  source_type: 10.5,
  required_date: 10.55,
  planned_start_date: 10.6,
  planned_end_date: 10.65,
  operation_name: 10.7,
  outsource_operation: 10.75,
  source_code: 11,
  forecast_name: 11,
  name: 12,
  shortName: 13,
  customer_name: 20,
  contact_person: 21,
  contactPerson: 21,
  contactTitle: 21.5,
  phone: 22,
  contact_phone: 22,
  mobile: 23,
  email: 23.5,
  address: 23.8,
  buyer_name: 24,
  buyer_id: 24.1,
  buyerName: 24,
  buyerId: 24.1,
  employee_name: 21,
  department_name: 22,
  position_name: 23,
  product_code: 24,
  product_name: 25,
  material_code: 25,
  materialCode: 25,
  material_name: 25.1,
  materialName: 25.1,
  material_id: 25.15,
  materialId: 25.15,
  materialModel: 25.2,
  partnerMaterialCode: 26,
  partnerMaterialName: 26.5,
  // 业务日期
  occurred_at: 40,
  order_date: 40,
  quotation_date: 40,
  contract_date: 40,
  calculation_date: 40,
  return_time: 41,
  next_follow_up_at: 41,
  last_follow_up_at: 42,
  recycle_at: 43,
  assigned_at: 44,
  planned_ship_date: 42,
  notified_at: 43,
  start_date: 41,
  end_date: 42,
  valid_to: 43,
  delivery_date: 44,
  productionDate: 45,
  expiryDate: 45.5,
  factoryDate: 46,
  effectiveFrom: 47,
  effectiveTo: 47.5,
  // 业务责任人（销售员紧跟订单日期之后）
  salesman_name: 40.5,
  salesman_id: 40.6,
  salesmanName: 40.5,
  salesmanId: 40.6,
  // 业务分类与金额
  forecast_period: 50,
  period: 50,
  holidayType: 51,
  category: 52,
  forecast_type: 51,
  demand_type: 51,
  calculation_type: 51,
  calc_type: 52,
  target_type: 51.05,
  target_code: 51.15,
  target_name: 51.25,
  cost_item_type: 51.35,
  standard_value: 61.05,
  unit: 61.15,
  business_mode: 52,
  contract_type: 51,
  activity_type_code: 53,
  pool_status: 54,
  poolStatus: 54,
  calculation_status: 55,
  items_count: 59.5,
  unitPrice: 59.7,
  unit_price: 59.7,
  outsource_quantity: 59.8,
  variantPrices: 59.85,
  total_quantity: 60,
  quantity: 60,
  total_hours: 60,
  total_pieces: 61,
  total_amount: 61,
  time_amount: 62,
  piece_amount: 63,
  released_amount: 62,
  weight: 63,
  rate: 64,
  kpi_score: 64,
  kpi_coefficient: 65,
  material_cost: 66,
  labor_cost: 67,
  manufacturing_cost: 68,
  unit_cost: 69,
  /** 备注/正文：业务列之后、启用状态之前 */
  content: 91.55,
  received_quantity: 60.1,
  /** 报工/检验：人员或检验数量紧挨合格/不合格之前 */
  worker_name: 60.15,
  inspection_quantity: 60.18,
  sample_qty: 60.18,
  qualified_quantity: 60.2,
  unqualified_quantity: 60.3,
  reported_quantity: 60.4,
  crossesMidnight: 88,
  timeRange: 42,
  holidayDate: 40,
  standardHours: 60,
  sales_order_code: 55,
  work_order_code: 56,
  source_order_code: 56,
  change_category: 57,
  change_reason: 56.5,
  change_version: 58,
  delta_amount: 56.8,
  sales_delivery_code: 56,
  warehouse_name: 57,
  applied_at: 58,
  work_order_push_progress: 63,
  delivery_progress: 64,
  order_push_progress: 63,
  downstream_push_progress: 63,
  computation_push_progress: 63,
  outbound_push_progress: 63,
  inbound_push_progress: 63,
  receipt_progress: 64,
  computation_start_time: 41,
  computation_end_time: 42,
  // 生命周期与系统字段
  audit_phase: 89,
  phase: 89,
  lifecycle_stage: 90,
  status: 91,
  inspector_name: 91.9,
  inspectorName: 91.9,
  version_no: 62.5,
  version: 62.5,
  effective_date: 62.65,
  /** 启用状态：业务列之后、更新时间之前（勿再旁路覆盖） */
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
  // 单据标识
  quotation_code: 10,
  contract_code: 10,
  order_code: 10,
  version_no: 11,
  status: 12,
  // 客户块
  customer_name: 20,
  customer_contact: 21,
  customer_phone: 22,
  // 业务块
  salesman_name: 30,
  payment_terms: 31,
  currency_code: 32,
  price_type: 33,
  total_amount: 34,
  released_amount: 35,
  remaining_amount: 36,
  // 履约块
  order_date: 40,
  quotation_date: 40,
  contract_date: 40,
  valid_until: 41,
  valid_from: 41,
  valid_to: 42,
  delivery_date: 43,
  shipping_method: 44,
  shipping_address: 45,
  // 关联与备注
  quotation_code_link: 50,
  sales_order_code: 50,
  notes: 60,
  updated_at: 90,
} satisfies FieldRankMap

/**
 * @deprecated Prefer GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK.
 * Kept for backward compatibility with existing imports.
 */
export const SALES_DOC_DETAIL_BASIC_FIELD_RANK = GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK

export function getSalesCommonFormLabels(t: (key: string) => string) {
  return {
    contact: t('app.kuaizhizao.salesOrder.customerContact'),
    phone: t('app.kuaizhizao.salesOrder.customerPhone'),
    salesman: t('app.kuaizhizao.salesOrder.salesman'),
  } as const
}
