import React from 'react'
import { Button, Dropdown, Space, Popconfirm, Tooltip } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import type { NormalizeActionContext, RenderRowActionsOverflowOptions } from './types'
import {
  readNodeText,
  normalizeActionLabelText,
  resolveActionKind,
  readActionPriority,
  resolveButtonTone,
} from './actionText'
import { normalizeActionTree } from './normalize'

export const ROW_ACTIONS_DIRECT_MAX = 4

/**
 * 有溢出菜单时，主行至少展示的可点击操作数（会从「更多」中顺延补足）。
 * 与 ROW_ACTIONS_DIRECT_MAX 兼容：`max(directMax - 1, 该常量)`。
 */
export const ROW_ACTIONS_MIN_PRIMARY_VISIBLE = 4

/** 列表操作列内联按钮横向间距（Ant Design Space） */
export const ROW_ACTIONS_INLINE_GAP = 4

function normalizeAndSortActions(
  nodes: React.ReactNode[],
  ctx: NormalizeActionContext,
): React.ReactNode[] {
  const flat = (nodes.filter(Boolean) as React.ReactNode[])
    .map((node) => normalizeActionTree(node, ctx))
    .filter((n) => n != null && n !== false) as React.ReactNode[]

  const withMeta = flat.map((node, index) => {
    const kind = resolveActionKind(node)
    const explicitPriority = readActionPriority(node)
    const kindRank =
      kind === 'detail' ? 0 : kind === 'edit' ? 1 : kind === 'delete' ? 2 : kind === 'common' ? 3 : 4
    const finalPriority = explicitPriority ?? kindRank
    return { node, index, finalPriority, kindRank }
  })

  withMeta.sort((a, b) => {
    if (a.finalPriority !== b.finalPriority) return a.finalPriority - b.finalPriority
    if (a.kindRank !== b.kindRank) return a.kindRank - b.kindRank
    return a.index - b.index
  })

  return withMeta.map((x) => x.node)
}

function findInteractiveElement(node: React.ReactNode): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  const t = node.type
  if (t === Button || (typeof node.type === 'string' && node.type === 'a')) {
    return node
  }
  if (t === Popconfirm || t === Tooltip) {
    return findInteractiveElement((node.props as { children?: React.ReactNode }).children)
  }
  const ch = (node.props as { children?: React.ReactNode } | undefined)?.children
  if (ch != null) {
    for (const child of React.Children.toArray(ch)) {
      const found = findInteractiveElement(child)
      if (found) return found
    }
  }
  return null
}

/** 不可点（disabled 或无按钮/链接）的操作不展示 */
function isClickableVisibleAction(node: React.ReactNode): boolean {
  const interactive = findInteractiveElement(node)
  if (!interactive) return false
  const p = (interactive.props || {}) as { disabled?: boolean }
  return !p.disabled
}

function toMenuItem(node: React.ReactNode, key: string) {
  const text = normalizeActionLabelText(readNodeText(node)) || '操作'
  const interactive = findInteractiveElement(node)

  if (interactive) {
    const props = (interactive.props || {}) as Record<string, unknown>
    const onClick = typeof props.onClick === 'function' ? (props.onClick as () => void) : undefined
    return {
      key,
      label: text,
      danger: !!props.danger || resolveButtonTone(text).danger,
      disabled: !!props.disabled,
      onClick,
    }
  }

  return {
    key,
    label: text,
  }
}

function parseOverflowArgs(directMaxOrOptions?: number | RenderRowActionsOverflowOptions): {
  directMax: number
  ctx: NormalizeActionContext
} {
  let directMax = ROW_ACTIONS_DIRECT_MAX
  let suppressAudit = false
  if (typeof directMaxOrOptions === 'number') {
    directMax = directMaxOrOptions
  } else if (directMaxOrOptions != null && typeof directMaxOrOptions === 'object') {
    if (typeof directMaxOrOptions.directMax === 'number') directMax = directMaxOrOptions.directMax
    if (directMaxOrOptions.suppressAuditSemanticActions === true) suppressAudit = true
  }
  return { directMax, ctx: { suppressAuditSemanticActions: suppressAudit } }
}

/**
 * 列表操作列：统一顺序；禁用项隐藏；需要溢出时主行至少 ROW_ACTIONS_MIN_PRIMARY_VISIBLE 个可点操作，其余进「更多」。
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  directMaxOrOptions?: number | RenderRowActionsOverflowOptions,
): React.ReactNode {
  const { directMax, ctx } = parseOverflowArgs(directMaxOrOptions)
  const sorted = normalizeAndSortActions(nodes, ctx)
  const enabled = sorted.filter(isClickableVisibleAction)
  /** 原先为 directMax-1 留「更多」一格；抬高下限为 4，避免禁项隐藏后主行过空 */
  const primarySlotsBeforeMore = Math.max(1, directMax - 1, ROW_ACTIONS_MIN_PRIMARY_VISIBLE)

  if (enabled.length === 0) {
    return null
  }

  if (enabled.length <= primarySlotsBeforeMore) {
    return (
      <Space size={ROW_ACTIONS_INLINE_GAP} wrap={false} style={{ whiteSpace: 'nowrap' }}>
        {enabled}
      </Space>
    )
  }

  const inline = enabled.slice(0, primarySlotsBeforeMore)
  const overflow = enabled.slice(primarySlotsBeforeMore)

  return (
    <Space size={ROW_ACTIONS_INLINE_GAP} wrap={false} style={{ whiteSpace: 'nowrap' }}>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => toMenuItem(node, `${keyPrefix}-more-${i}`)),
        }}
        trigger={['click']}
      >
        <Button type="text" size="small" className="ant-btn-row-action" icon={<MoreOutlined />} style={{ padding: '4px 4px' }}>
          {overflow.length > 0 ? (
            <Space size={4}>
              <span>更多</span>
            </Space>
          ) : (
            ''
          )}
        </Button>
      </Dropdown>
    </Space>
  )
}
