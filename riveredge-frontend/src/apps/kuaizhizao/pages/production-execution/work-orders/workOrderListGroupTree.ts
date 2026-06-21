/**
 * 工单列表：按 work_order_group_id 组装 BOM 树，组节点为 row_kind=work_order_group
 */
import type { WorkOrderListRow } from './workOrderListTreeTypes'

export const WORK_ORDER_GROUP_ROW_KIND = 'work_order_group'

export type WorkOrderGroupLayout = 'bom_tree' | 'peer'

export function isBomTreeWorkOrderGroup(groupRow: WorkOrderListRow): boolean {
  if ((groupRow.row_kind || '') !== WORK_ORDER_GROUP_ROW_KIND) return false
  if (groupRow.group_layout === 'peer') return false
  if (groupRow.group_layout === 'bom_tree') return true
  const childRoots = groupRow.children ?? []
  if (childRoots.some((c) => c.group_role === 'root')) return true
  const workOrders = childRoots.filter((c) => (c.row_kind || 'work_order') === 'work_order')
  if (workOrders.length > 1 && !workOrders.some((c) => c.group_role === 'root')) return false
  return workOrders.some((wo) =>
    (wo.children ?? []).some((c) => (c.row_kind || 'work_order') === 'work_order'),
  )
}

/** 树形组默认展开：组节点 + 组内带 BOM 子工单的父行；平级组/拆/返/委外默认收起 */
export function collectDefaultExpandedWorkOrderTreeKeys(
  rows: WorkOrderListRow[],
  getRowKey: (row: WorkOrderListRow) => string | number,
): Array<string | number> {
  const keys: Array<string | number> = []

  const walk = (row: WorkOrderListRow, insideBomTreeGroup: boolean) => {
    const kind = row.row_kind || 'work_order'
    const children = row.children ?? []
    const hasChildren = children.length > 0

    if (kind === WORK_ORDER_GROUP_ROW_KIND) {
      const expandGroup = isBomTreeWorkOrderGroup(row)
      if (expandGroup) keys.push(getRowKey(row))
      if (hasChildren) {
        for (const child of children) walk(child, expandGroup)
      }
      return
    }

    if (insideBomTreeGroup && kind === 'work_order' && hasChildren) {
      const hasBomChild = children.some((c) => (c.row_kind || 'work_order') === 'work_order')
      if (hasBomChild) keys.push(getRowKey(row))
    }

    if (hasChildren) {
      for (const child of children) walk(child, insideBomTreeGroup)
    }
  }

  for (const row of rows) walk(row, false)
  return keys
}

export function flattenWorkOrderListRows(rows: WorkOrderListRow[]): WorkOrderListRow[] {
  const out: WorkOrderListRow[] = []
  const walk = (row: WorkOrderListRow) => {
    const { children, ...rest } = row
    out.push(rest)
    if (Array.isArray(children)) {
      for (const child of children) walk(child)
    }
  }
  for (const row of rows) walk(row)
  return out
}

function sortWorkOrderChildren(children: WorkOrderListRow[]): void {
  children.sort((a, b) => {
    const order = (row: WorkOrderListRow) => {
      const kind = row.row_kind || 'split'
      if (kind === 'split') return 0
      if (kind === 'rework') return 1
      if (kind === 'outsource') return 2
      return 3
    }
    const kindDiff = order(a) - order(b)
    return kindDiff !== 0 ? kindDiff : String(a.code ?? '').localeCompare(String(b.code ?? ''))
  })
}

/** 将拆分子行、返工单、委外单挂到组内主工单下 */
function attachSplitAndReworkChildren(
  rowById: Map<number, WorkOrderListRow>,
  memberIds: Set<number>,
): Set<number> {
  const SPLIT_CHILD_CODE = /^(.+)-(\d{3})$/
  const rowByCode = new Map<string, WorkOrderListRow>()
  for (const row of rowById.values()) {
    if (row.code) rowByCode.set(String(row.code), row)
  }
  const childIds = new Set<number>()

  const attachChild = (parent: WorkOrderListRow, child: WorkOrderListRow) => {
    if (child.id == null || parent.id == null || child.id === parent.id) return
    if (!parent.children) parent.children = []
    parent.children.push({
      ...child,
      row_kind: child.row_kind || 'split',
      parent_work_order_id: parent.id,
      list_tree_depth: (parent.list_tree_depth ?? 0) + 1,
      operation_steps:
        Array.isArray(child.operation_steps) && child.operation_steps.length > 0
          ? child.operation_steps
          : parent.operation_steps,
    })
    childIds.add(Number(child.id))
  }

  for (const row of rowById.values()) {
    if (row.id == null || !memberIds.has(Number(row.id))) continue
    const kind = row.row_kind || 'work_order'
    if (kind === 'work_order_group') continue
    let parent: WorkOrderListRow | undefined
    const parentId = row.parent_work_order_id
    if (parentId != null && memberIds.has(Number(parentId))) {
      parent = rowById.get(Number(parentId))
    }
    if (!parent && row.code && (kind === 'split' || kind === 'work_order')) {
      const match = SPLIT_CHILD_CODE.exec(String(row.code))
      if (match) parent = rowByCode.get(match[1])
    }
    if (parent) attachChild(parent, row)
  }
  return childIds
}

function attachBomHierarchy(
  rowById: Map<number, WorkOrderListRow>,
  memberIds: Set<number>,
  splitChildIds: Set<number>,
): Set<number> {
  const bomChildIds = new Set<number>()

  for (const row of rowById.values()) {
    if (row.id == null || !memberIds.has(Number(row.id))) continue
    if (splitChildIds.has(Number(row.id))) continue
    const bomParentId = row.bom_parent_work_order_id
    if (bomParentId == null || !memberIds.has(Number(bomParentId))) continue
    const parent = rowById.get(Number(bomParentId))
    if (!parent) continue
    const childCopy: WorkOrderListRow = {
      ...row,
      children: row.children,
      row_kind: row.row_kind || 'work_order',
      list_tree_depth: (parent.list_tree_depth ?? 1) + 1,
    }
    if (!parent.children) parent.children = []
    parent.children.push(childCopy)
    bomChildIds.add(Number(row.id))
  }
  return bomChildIds
}

function pickGroupRootMembers(
  rowById: Map<number, WorkOrderListRow>,
  memberIds: Set<number>,
  attachedIds: Set<number>,
): WorkOrderListRow[] {
  const roots = [...rowById.values()].filter(
    (row) => row.id != null && memberIds.has(Number(row.id)) && !attachedIds.has(Number(row.id)),
  )
  roots.sort((a, b) => {
    const aRoot = a.group_role === 'root' ? 0 : 1
    const bRoot = b.group_role === 'root' ? 0 : 1
    if (aRoot !== bRoot) return aRoot - bRoot
    return String(a.code ?? '').localeCompare(String(b.code ?? ''))
  })
  for (const root of roots) {
    root.list_tree_depth = 1
    if (root.children?.length) sortWorkOrderChildren(root.children)
  }
  return roots
}

function createGroupParentNode(
  groupId: number,
  members: WorkOrderListRow[],
  memberRoots: WorkOrderListRow[],
): WorkOrderListRow {
  const groupCode = members.find((m) => m.group_code)?.group_code ?? `WG-${groupId}`
  const groupName = members
    .map((m) => String(m.group_name ?? '').trim())
    .find((name) => name.length > 0)
  const rootMember = members.find((m) => m.group_role === 'root')
  const hasDesignatedRoot = Boolean(rootMember)
  const workOrderMembers = members.filter((m) => (m.row_kind || 'work_order') === 'work_order')
  const isPeerGroup = !hasDesignatedRoot && workOrderMembers.length > 1
  const productLabel = groupName
    ? groupName
    : hasDesignatedRoot
      ? rootMember!.product_name || rootMember!.product_code || groupCode
      : `平级工单组（${members.length} 张）`
  const displayName = groupName
    ? groupName
    : hasDesignatedRoot
      ? `${productLabel} 工单组`
      : productLabel
  return {
    id: -groupId,
    row_kind: WORK_ORDER_GROUP_ROW_KIND,
    code: groupCode,
    group_code: groupCode,
    group_name: groupName,
    work_order_group_id: groupId,
    product_name: displayName,
    name: displayName,
    member_count: members.filter((m) => (m.row_kind || 'work_order') === 'work_order').length,
    group_layout: isPeerGroup ? 'peer' : 'bom_tree',
    list_tree_depth: 0,
    children: memberRoots,
  }
}

/** 将同属一组的工单行组装为「工单组 → BOM 树 → 拆分子行」结构 */
export function buildWorkOrderGroupForest(
  flatRows: WorkOrderListRow[],
): WorkOrderListRow[] {
  const byGroup = new Map<number, WorkOrderListRow[]>()
  for (const row of flatRows) {
    const gid = row.work_order_group_id
    if (gid == null || row.id == null) continue
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(row)
  }

  const groupNodes: WorkOrderListRow[] = []
  for (const [groupId, members] of byGroup.entries()) {
    const rowById = new Map<number, WorkOrderListRow>()
    const memberIds = new Set<number>()
    for (const m of members) {
      const copy = { ...m, children: undefined as WorkOrderListRow[] | undefined }
      rowById.set(Number(m.id), copy)
      memberIds.add(Number(m.id))
    }
    const splitChildIds = attachSplitAndReworkChildren(rowById, memberIds)
    const bomChildIds = attachBomHierarchy(rowById, memberIds, splitChildIds)
    const attachedIds = new Set([...splitChildIds, ...bomChildIds])
    const memberRoots = pickGroupRootMembers(rowById, memberIds, attachedIds)
    if (memberRoots.length === 0) continue
    groupNodes.push(createGroupParentNode(groupId, members, memberRoots))
  }

  groupNodes.sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')))
  return groupNodes
}
