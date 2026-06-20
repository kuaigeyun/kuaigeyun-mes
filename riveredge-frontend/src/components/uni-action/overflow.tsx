import React from 'react'
import { Button, Dropdown, Modal, Space, Popconfirm, Tooltip } from 'antd'
import i18next from 'i18next'
import {
  ApartmentOutlined,
  FileTextOutlined,
  FormOutlined,
  MoreOutlined,
  SettingOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import type { NormalizeActionContext, RenderRowActionsOverflowOptions } from './types'
import {
  readNodeText,
  normalizeActionLabelText,
  resolveActionKind,
  readActionPriority,
  resolveButtonToneFromNode,
  readExplicitActionKind,
  readActionVisualProfile,
} from './actionText'
import { rowActionSortRank } from './actionCatalog'
import { normalizeActionTree } from './normalize'

/**
 * 行内默认仅直出基础动作（详情/编辑/删除等），其余动作统一折叠到「更多」，
 * 以收窄操作列宽度并提升右侧固定列稳定性。
 */
export const ROW_ACTIONS_DIRECT_MAX = 3

/**
 * 有溢出菜单时，主行至少展示的可点击操作数（会从「更多」中顺延补足）。
 * 与 ROW_ACTIONS_DIRECT_MAX 兼容：`max(directMax - 1, 该常量)`。
 */
export const ROW_ACTIONS_MIN_PRIMARY_VISIBLE = 3

/** 列表操作列内联按钮横向间距（Ant Design Space） */
export const ROW_ACTIONS_INLINE_GAP = 4

function getMoreButtonLabel(): string {
  const lang = String(i18next.resolvedLanguage ?? i18next.language ?? '').toLowerCase()
  if (lang.startsWith('zh')) return '更多'
  return i18next.t('common.more', { defaultValue: 'More' })
}

function normalizeAndSortActions(
  nodes: React.ReactNode[],
  ctx: NormalizeActionContext,
): React.ReactNode[] {
  const flat = (nodes.filter(Boolean) as React.ReactNode[])
    .map((node) => normalizeActionTree(node, ctx))
    .filter((n) => n != null && n !== false) as React.ReactNode[]

  const withMeta = flat.map((node, index) => {
    const kind = resolveActionKind(node)
    const explicit = readExplicitActionKind(node)
    const profile = readActionVisualProfile(node)
    const explicitPriority = readActionPriority(node)
    const kindRank = rowActionSortRank(explicit, profile)
    const finalPriority = explicitPriority ?? kindRank
    return { node, index, finalPriority, kindRank, kind }
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

function findPopconfirmElement(node: React.ReactNode): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  const t = node.type
  if (t === Popconfirm) return node
  const ch = (node.props as { children?: React.ReactNode } | undefined)?.children
  if (ch != null) {
    for (const child of React.Children.toArray(ch)) {
      const found = findPopconfirmElement(child)
      if (found) return found
    }
  }
  return null
}

/**
 * 并列主行上出现相同图标组件时，按序换成备选图标（不改变文案与点击）。
 */
const FALLBACK_ICON_TYPES = [
  FormOutlined,
  FileTextOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  TagsOutlined,
  SettingOutlined,
] as const

function pickDistinctFallbackIcon(usedTypes: Set<unknown>): React.ReactElement {
  for (const Comp of FALLBACK_ICON_TYPES) {
    if (!usedTypes.has(Comp)) {
      usedTypes.add(Comp)
      return React.createElement(Comp)
    }
  }
  const fallback = FALLBACK_ICON_TYPES[FALLBACK_ICON_TYPES.length - 1]
  return React.createElement(fallback)
}

function replaceDeepButtonIcon(node: React.ReactNode, newIcon: React.ReactElement): React.ReactNode {
  if (!React.isValidElement(node)) return node
  const t = node.type
  if (t === Button) {
    return React.cloneElement(node as React.ReactElement<Record<string, unknown>>, {
      icon: newIcon,
    })
  }
  if (t === Popconfirm || t === Tooltip) {
    const props = node.props as { children?: React.ReactNode }
    const nextChild = replaceDeepButtonIcon(props.children, newIcon)
    return React.cloneElement(node as React.ReactElement<Record<string, unknown>>, {
      children: nextChild,
    })
  }
  const props = node.props as { children?: React.ReactNode }
  const rawChildren = props?.children
  if (rawChildren != null && React.Children.count(rawChildren) === 1) {
    const only = React.Children.only(rawChildren)
    const replaced = replaceDeepButtonIcon(only, newIcon)
    if (replaced !== only) {
      return React.cloneElement(node as React.ReactElement<Record<string, unknown>>, {
        children: replaced,
      })
    }
  }
  return node
}

function dedupeInlineRowIcons(nodes: React.ReactNode[]): React.ReactNode[] {
  const seenIconTypes = new Set<unknown>()
  return nodes.map((node) => {
    const interactive = findInteractiveElement(node)
    if (!interactive || interactive.type !== Button) return node
    const rawIcon = (interactive.props as { icon?: React.ReactNode }).icon
    if (!React.isValidElement(rawIcon)) return node
    const ty = rawIcon.type
    if (!seenIconTypes.has(ty)) {
      seenIconTypes.add(ty)
      return node
    }
    const replacement = pickDistinctFallbackIcon(seenIconTypes)
    return replaceDeepButtonIcon(node, replacement)
  })
}

/** 业务可在 Tooltip 等外层节点设 data-row-action-visible-when-disabled，禁用时仍露出操作（配合 Tooltip 说明原因） */
function isVisibleWhenDisabledRowAction(node: React.ReactNode): boolean {
  if (!React.isValidElement(node)) return false
  const p = node.props as Record<string, unknown>
  if (p['data-row-action-visible-when-disabled'] === true) return true
  const ch = p.children as React.ReactNode
  if (ch != null && React.Children.count(ch) === 1) {
    try {
      return isVisibleWhenDisabledRowAction(React.Children.only(ch))
    } catch {
      return false
    }
  }
  return false
}

/** 不可点（disabled 或无按钮/链接）的操作默认不展示；带显式标记的可保留展示 */
function isClickableVisibleAction(node: React.ReactNode): boolean {
  const interactive = findInteractiveElement(node)
  const explicitKind = readExplicitActionKind(node)
  // skip 仅在“无可静态识别交互”的自管组件场景下直出（如 UniWorkflowActions）。
  if (explicitKind === 'skip' && !interactive) return true
  if (!interactive) return false
  const p = (interactive.props || {}) as { disabled?: boolean }
  if (p.disabled && isVisibleWhenDisabledRowAction(node)) return true
  return !p.disabled
}

function toMenuItem(node: React.ReactNode, key: string) {
  const text = normalizeActionLabelText(readNodeText(node)) || '操作'
  const interactive = findInteractiveElement(node)
  const popconfirm = findPopconfirmElement(node)
  const inheritedExplicit = readExplicitActionKind(node)
  const tone = resolveButtonToneFromNode(interactive ?? node, inheritedExplicit)

  if (interactive) {
    const props = (interactive.props || {}) as Record<string, unknown>
    let onClick = typeof props.onClick === 'function' ? (props.onClick as () => void) : undefined
    const destructive = tone.mode === 'destructive'

    // 折叠到「更多」后，Popconfirm 不会自动触发；这里显式转成 Modal.confirm 以保留二次确认。
    if (popconfirm) {
      const popProps = (popconfirm.props || {}) as Record<string, unknown>
      onClick = () => {
        const onConfirm = popProps.onConfirm
        Modal.confirm({
          title: (popProps.title as React.ReactNode) ?? text,
          content: popProps.description as React.ReactNode,
          okText: (popProps.okText as string) || i18next.t('common.confirm', { defaultValue: 'Confirm' }),
          cancelText:
            (popProps.cancelText as string) || i18next.t('common.cancel', { defaultValue: 'Cancel' }),
          okButtonProps: destructive ? { danger: true } : undefined,
          onOk: async () => {
            if (typeof onConfirm === 'function') {
              await (onConfirm as () => void | Promise<void>)()
            }
          },
        })
      }
    }

    return {
      key,
      label: text,
      danger: destructive || !!props.danger,
      disabled: !!props.disabled,
      onClick,
    }
  }

  return {
    key,
    label: text,
  }
}

/** Space 子项需稳定 key，避免 React 在表格 Cell 内报 list key 警告 */
function withRowActionKeys(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    if (React.isValidElement(node) && node.key != null) {
      return node
    }
    const key = `${keyPrefix}-inline-${index}`
    if (React.isValidElement(node)) {
      return React.cloneElement(node, { key })
    }
    return <React.Fragment key={key}>{node}</React.Fragment>
  })
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
  const enabled = dedupeInlineRowIcons(sorted.filter(isClickableVisibleAction))
  /** 原先为 directMax-1 留「更多」一格；抬高下限为 4，避免禁项隐藏后主行过空 */
  const primarySlotsBeforeMore = Math.max(1, directMax - 1, ROW_ACTIONS_MIN_PRIMARY_VISIBLE)

  if (enabled.length === 0) {
    return null
  }

  const keyedEnabled = withRowActionKeys(enabled, keyPrefix)

  // 自管组件（skip 且外层无可静态识别交互）若折叠进“更多”会变成不可执行菜单项；
  // 这类节点始终保持主行直出。
  const hasInlineOnlySkipComponent = enabled.some((node) => {
    if (readExplicitActionKind(node) !== 'skip') return false
    return !findInteractiveElement(node)
  })
  if (hasInlineOnlySkipComponent) {
    return (
      <Space
        align="center"
        size={ROW_ACTIONS_INLINE_GAP}
        wrap={false}
        style={{ whiteSpace: 'nowrap' }}
      >
        {keyedEnabled}
      </Space>
    )
  }

  if (enabled.length <= primarySlotsBeforeMore) {
    return (
      <Space
        align="center"
        size={ROW_ACTIONS_INLINE_GAP}
        wrap={false}
        style={{ whiteSpace: 'nowrap' }}
      >
        {keyedEnabled}
      </Space>
    )
  }

  const inline = enabled.slice(0, primarySlotsBeforeMore)
  const overflow = enabled.slice(primarySlotsBeforeMore)
  // 若溢出区仅 1 个动作，直接平铺展示，避免把单个按钮折叠进“更多”。
  if (overflow.length <= 1) {
    return (
      <Space
        align="center"
        size={ROW_ACTIONS_INLINE_GAP}
        wrap={false}
        style={{ whiteSpace: 'nowrap' }}
      >
        {keyedEnabled}
      </Space>
    )
  }

  const keyedInline = withRowActionKeys(inline, keyPrefix)

  return (
    <Space
      align="center"
      size={ROW_ACTIONS_INLINE_GAP}
      wrap={false}
      style={{ whiteSpace: 'nowrap' }}
    >
      {keyedInline}
      <Dropdown
        menu={{
          items: overflow.map((node, i) => toMenuItem(node, `${keyPrefix}-more-${i}`)),
        }}
        trigger={['click']}
      >
        <Button type="text" size="small" className="ant-btn-row-action" icon={<MoreOutlined />}>
          {getMoreButtonLabel()}
        </Button>
      </Dropdown>
    </Space>
  )
}
