import React from 'react'
import type { UniActionRenderOptions } from './types'
import { ROW_ACTIONS_DIRECT_MAX, renderRowActionsOverflow } from './overflow'
import { collectOperationActions } from './collect'
import { normalizeActionTree } from './normalize'
import { filterActionsByResourcePermission } from './filterByPermission'

function extractActionNodes(rendered: React.ReactNode): React.ReactNode[] {
  if (rendered == null || rendered === false) return []
  if (Array.isArray(rendered)) {
    return (rendered as React.ReactNode[]).filter((n) => n != null && n !== false)
  }
  const collected = collectOperationActions(rendered)
  if (collected) return collected
  return [rendered]
}

/**
 * UniTable 操作列 render 的单一入口：数组 / Space 多子项 / 单树 均走统一规范化与溢出策略。
 * 单按钮也必须进溢出包装（`.uni-table-operation-actions`），否则列宽实测找不到锚点，
 * 会一直停在槽位预算宽，和「按内容收列」成为两个真源。
 * 折叠只在这里发生——页面 render 只负责产出动作节点，自己再折一次会让第一次的「更多」
 * 下拉被当成普通动作收进第二层菜单，里面的动作将无法点击。
 */
export function renderUniTableOperationCell(
  rendered: React.ReactNode,
  rowKey: string,
  options?: UniActionRenderOptions,
): React.ReactNode {
  const directMax = options?.directMax ?? ROW_ACTIONS_DIRECT_MAX
  const suppressAuditSemanticActions = options?.suppressAuditSemanticActions ?? false
  const permissionGates = options?.permissionGates
  const ctx = { suppressAuditSemanticActions }

  const applyPermissionFilter = (nodes: React.ReactNode[]) => {
    if (!permissionGates?.enabled) return nodes
    return filterActionsByResourcePermission(nodes, permissionGates)
  }

  const extracted = extractActionNodes(rendered)
  if (extracted.length === 0) return null
  const normalized = applyPermissionFilter(
    extracted
      .map((n) => normalizeActionTree(n, ctx))
      .filter((n) => n != null && n !== false) as React.ReactNode[],
  )
  return renderRowActionsOverflow(normalized, rowKey, { directMax, suppressAuditSemanticActions })
}
