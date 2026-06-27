import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components'

type FieldRankMap = Record<string, number>

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
      const rank = key && rankMap[key] != null ? rankMap[key] : 10000
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

export const SALES_DOC_LIST_FIELD_RANK = {
  // 主标识与客户
  order_code: 10,
  quotation_code: 10,
  contract_code: 10,
  forecast_code: 10,
  forecast_name: 11,
  customer_name: 20,
  // 商务责任人
  salesman_name: 30,
  salesman_id: 31,
  // 关键日期
  order_date: 40,
  quotation_date: 40,
  contract_date: 40,
  start_date: 41,
  end_date: 42,
  valid_to: 43,
  delivery_date: 44,
  // 业务分类与金额
  forecast_period: 50,
  forecast_type: 51,
  contract_type: 51,
  total_quantity: 60,
  total_amount: 61,
  released_amount: 62,
  // 生命周期与系统字段
  audit_phase: 89,
  phase: 89,
  lifecycle_stage: 90,
  status: 91,
  updated_at: 92,
  created_at: 93,
} satisfies FieldRankMap

export const SALES_DOC_DETAIL_BASIC_FIELD_RANK = {
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

export function getSalesCommonFormLabels(t: (key: string) => string) {
  return {
    contact: t('app.kuaizhizao.salesOrder.customerContact'),
    phone: t('app.kuaizhizao.salesOrder.customerPhone'),
    salesman: t('app.kuaizhizao.salesOrder.salesman'),
  } as const
}
