import React from 'react'
import type { UniActionRenderOptions } from './types'
import { ROW_ACTIONS_DIRECT_MAX, renderRowActionsOverflow } from './overflow'
import { collectOperationActions } from './collect'
import { normalizeActionTree } from './normalize'
import { filterActionsByResourcePermission } from './filterByPermission'

function extractActionNodes(rendered: React.ReactNode): React.ReactNode[] | null {
  if (Array.isArray(rendered)) {
    return (rendered as React.ReactNode[]).filter((n) => n != null && n !== false)
  }
  const collected = collectOperationActions(rendered)
  if (collected) return collected
  return null
}

/**
 * UniTable 操作列 render 的单一入口：数组 / Space 多子项 / 单树 均走统一规范化与溢出策略。
 * 已预调用 `renderRowActionsOverflow` 的结果也会拆出子按钮并重新过滤权限，避免「更多」布局绕过 RBAC。
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
  if (extracted) {
    const normalized = applyPermissionFilter(
      extracted
        .map((n) => normalizeActionTree(n, ctx))
        .filter((n) => n != null && n !== false) as React.ReactNode[],
    )
    return renderRowActionsOverflow(normalized, rowKey, { directMax, suppressAuditSemanticActions })
  }

  return normalizeActionTree(rendered, ctx)
}
