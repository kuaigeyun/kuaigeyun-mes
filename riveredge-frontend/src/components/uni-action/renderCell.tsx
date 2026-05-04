import React from 'react'
import { Dropdown, Space } from 'antd'
import type { UniActionRenderOptions } from './types'
import { ROW_ACTIONS_DIRECT_MAX, renderRowActionsOverflow } from './overflow'
import { collectOperationActions } from './collect'
import { normalizeActionTree } from './normalize'

/**
 * 页面若在 render 里已调用 `renderRowActionsOverflow`，会得到 `Space` + 末尾 `Dropdown`。
 * UniTable 若再收集子节点并二次折叠，会出现双重「更多」与行高异常。
 */
function isRowActionsOverflowLayout(node: React.ReactNode): boolean {
  if (!React.isValidElement(node)) return false
  if (node.type !== Space) return false
  const raw = (node.props as { children?: React.ReactNode }).children
  const kids = React.Children.toArray(raw).filter(Boolean)
  if (kids.length < 2) return false
  const last = kids[kids.length - 1]
  return React.isValidElement(last) && last.type === Dropdown
}

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

  if (!Array.isArray(rendered) && isRowActionsOverflowLayout(rendered)) {
    return rendered
  }

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
