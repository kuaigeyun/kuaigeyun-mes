import React from 'react'
import { Button, Dropdown, Space } from 'antd'
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
  if (node.type === Button || (typeof node.type === 'string' && node.type === 'a')) {
    return node
  }
  if (node.props?.children) {
    if (React.isValidElement(node.props.children)) {
      return findInteractiveElement(node.props.children)
    }
    if (Array.isArray(node.props.children)) {
      for (const child of node.props.children) {
        const found = findInteractiveElement(child)
        if (found) return found
      }
    }
  }
  return null
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
 * 列表操作列：统一顺序 + 超过上限收纳到「更多」
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  directMaxOrOptions?: number | RenderRowActionsOverflowOptions,
): React.ReactNode {
  const { directMax, ctx } = parseOverflowArgs(directMaxOrOptions)
  const sorted = normalizeAndSortActions(nodes, ctx)
  if (sorted.length <= directMax) {
    return (
      <Space size={10} wrap>
        {sorted}
      </Space>
    )
  }
  const inline = sorted.slice(0, Math.max(1, directMax - 1))
  const overflow = sorted.slice(Math.max(1, directMax - 1))

  return (
    <Space size={10} wrap>
      {inline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => toMenuItem(node, `${keyPrefix}-more-${i}`)),
        }}
        trigger={['click']}
      >
        <Button type="text" size="small" className="ant-btn-row-action" icon={<MoreOutlined />} style={{ padding: '4px 6px' }}>
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
