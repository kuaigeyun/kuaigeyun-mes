import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components'

type FieldRankMap = Record<string, number>
const DEFAULT_UNRANKED_FIELD_RANK = 91.5

function normalizeFieldKey(dataIndex: unknown, fallbackKey?: unknown): string {
  if (typeof dataIndex === 'string' && dataIndex.trim()) return dataIndex.trim()
  if (Array.isArray(dataIndex) && dataIndex.length > 0) {
    return String(dataIndex[dataIndex.length - 1] ?? '').trim()
  }
  if (typeof fallbackKey === 'string' && fallbackKey.trim()) return fallbackKey.trim()
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

export function alignProColumns<T extends Record<string, unknown>>(
  columns: ProColumns<T>[],
  rankMap: FieldRankMap,
): ProColumns<T>[] {
  return sortByRank(
    columns,
    (col) => normalizeFieldKey(col.dataIndex as unknown, col.key as unknown),
    rankMap,
  )
}

export function alignDescriptionColumns<T extends Record<string, unknown>>(
  columns: ProDescriptionsItemProps<T>[],
  rankMap: FieldRankMap,
): ProDescriptionsItemProps<T>[] {
  return sortByRank(
    columns,
    (col) => normalizeFieldKey(col.dataIndex as unknown, col.key as unknown),
    rankMap,
  )
}

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
  source_code: 11,
  forecast_name: 11,
  name: 12,
  customer_name: 20,
  contact_person: 21,
  phone: 22,
  contact_phone: 22,
  mobile: 23,
  buyer_name: 24,
  buyer_id: 24.1,
  employee_name: 21,
  department_name: 22,
  position_name: 23,
  product_code: 24,
  product_name: 25,
  // 关键日期
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
  // 商务责任人（销售员紧跟订单日期之后）
  salesman_name: 40.5,
  salesman_id: 40.6,
  // 业务分类与金额
  forecast_period: 50,
  period: 50,
  holidayType: 51,
  category: 52,
  forecast_type: 51,
  demand_type: 51,
  calculation_type: 51,
  calc_type: 52,
  business_mode: 52,
  contract_type: 51,
  activity_type_code: 53,
  pool_status: 54,
  calculation_status: 55,
  items_count: 59.5,
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
  content: 70,
  is_active: 88,
  isActive: 88,
  crossesMidnight: 88,
  timeRange: 42,
  holidayDate: 40,
  updatedAt: 92,
  createdAt: 93,
  standardHours: 60,
  sales_order_code: 55,
  work_order_code: 56,
  source_order_code: 56,
  change_category: 57,
  change_version: 58,
  delta_amount: 59,
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
  updated_at: 92,
  created_at: 93,
} satisfies FieldRankMap

/**
 * @deprecated Prefer GLOBAL_DOC_LIST_FIELD_RANK.
 * Kept for backward compatibility with existing imports.
 */
export const SALES_DOC_LIST_FIELD_RANK = GLOBAL_DOC_LIST_FIELD_RANK

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
  // 商务块
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
