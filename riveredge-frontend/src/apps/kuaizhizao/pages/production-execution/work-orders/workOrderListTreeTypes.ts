export type WorkOrderListRow = Record<string, any> & {
  id?: number
  code?: string
  row_kind?: string
  work_order_group_id?: number
  group_code?: string
  group_name?: string
  group_role?: string
  group_layout?: 'bom_tree' | 'peer'
  bom_parent_work_order_id?: number
  parent_work_order_id?: number
  list_tree_depth?: number
  children?: WorkOrderListRow[]
}
