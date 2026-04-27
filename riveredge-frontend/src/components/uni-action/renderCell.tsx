import React from 'react'
import type { UniActionRenderOptions } from './types'
import { ROW_ACTIONS_DIRECT_MAX, renderRowActionsOverflow } from './overflow'
import { collectOperationActions } from './collect'
import { normalizeActionTree } from './normalize'

/**
 * UniTable 操作列 render 的单一入口：数组 / Space 多子项 / 单树 均走统一规范化与溢出策略。
 */
export function renderUniTableOperationCell(
  rendered: React.ReactNode,
  rowKey: string,
  options?: UniActionRenderOptions,
): React.ReactNode {
  const directMax = options?.directMax ?? ROW_ACTIONS_DIRECT_MAX
  const suppressAuditSemanticActions = options?.suppressAuditSemanticActions ?? false
  const ctx = { suppressAuditSemanticActions }

  if (Array.isArray(rendered)) {
    const normalized = (rendered as React.ReactNode[])
      .map((n) => normalizeActionTree(n, ctx))
      .filter((n) => n != null && n !== false) as React.ReactNode[]
    return renderRowActionsOverflow(normalized, rowKey, { directMax, suppressAuditSemanticActions })
  }

  const collected = collectOperationActions(rendered)
  if (collected) {
    const normalized = collected
      .map((n) => normalizeActionTree(n, ctx))
      .filter((n) => n != null && n !== false) as React.ReactNode[]
    return renderRowActionsOverflow(normalized, rowKey, { directMax, suppressAuditSemanticActions })
  }

  return normalizeActionTree(rendered, ctx)
}
