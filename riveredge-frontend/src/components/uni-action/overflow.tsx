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
import { getAntdModal } from '../../utils/antdAppApis';
/**
 * 行内默认仅直出基础动作（详情/编辑/删除等），其余动作折叠到「更多」，
 * 以收窄操作列宽度并提升右侧固定列稳定性；「更多」仅 1 项时仍直出。
 */
export const ROW_ACTIONS_DIRECT_MAX = 3

/**
 * 有溢出菜单时，主行至少展示的可点击操作数（会从「更多」中顺延补足）。
 * 与 ROW_ACTIONS_DIRECT_MAX 兼容：`max(directMax - 1, 该常量)`。
 */
export const ROW_ACTIONS_MIN_PRIMARY_VISIBLE = 3

/**
 * 动作条测量锚点：UniTable 按此类名量出操作列的实际内容宽并据以定列宽。
 * 配套 CSS 令其 max-content，宽度不随列宽变化，测量因此不会自反馈。
 */
export const ROW_ACTIONS_STRIP_CLASS = 'uni-table-operation-actions'

/**
 * 主行槽位数（唯一公式）：渲染折叠与操作列宽度必须消费同一个值，
 * 否则「直出几个」与「列宽够放几个」会成为两个互相竞争的真源。
 * 列宽推导见 `utils/uniTableLayoutColumns.ts`。
 */
export type ResolveRowActionInlineSlotOptions = {
  directMax?: number
  minPrimaryVisible?: number
}

export function resolveRowActionInlineSlots(
  options?: number | ResolveRowActionInlineSlotOptions,
): number {
  let directMax = ROW_ACTIONS_DIRECT_MAX
  let minPrimaryVisible = ROW_ACTIONS_MIN_PRIMARY_VISIBLE
  if (typeof options === 'number' && Number.isFinite(options)) {
    directMax = options
  } else if (options != null && typeof options === 'object') {
    if (typeof options.directMax === 'number' && Number.isFinite(options.directMax)) {
      directMax = options.directMax
    }
    if (typeof options.minPrimaryVisible === 'number' && Number.isFinite(options.minPrimaryVisible)) {
      minPrimaryVisible = options.minPrimaryVisible
    }
  }
  return Math.max(1, directMax - 1, minPrimaryVisible)
}

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

/** Menu 项 onClick 传入 MenuInfo（含 domEvent），行内 Button 常写 e.stopPropagation()，须兼容两种调用形态。 */
function invokeRowActionClick(
  rawOnClick: unknown,
  menuInfo?: { domEvent?: React.MouseEvent },
): void {
  if (typeof rawOnClick !== 'function') return
  const handler = rawOnClick as React.MouseEventHandler
  const domEvent = menuInfo?.domEvent
  if (domEvent && typeof domEvent.stopPropagation === 'function') {
    handler(domEvent)
    return
  }
  handler({
    stopPropagation: () => {},
    preventDefault: () => {},
  } as React.MouseEvent)
}

function toMenuItem(node: React.ReactNode, key: string) {
  const text = normalizeActionLabelText(readNodeText(node)) || '操作'
  const interactive = findInteractiveElement(node)
  const popconfirm = findPopconfirmElement(node)
  const inheritedExplicit = readExplicitActionKind(node)
  const tone = resolveButtonToneFromNode(interactive ?? node, inheritedExplicit)

  if (interactive) {
    const props = (interactive.props || {}) as Record<string, unknown>
    const rawOnClick = props.onClick
    let onClick =
      typeof rawOnClick === 'function'
        ? (info?: { domEvent?: React.MouseEvent }) => invokeRowActionClick(rawOnClick, info)
        : undefined
    const destructive = tone.mode === 'destructive'

    // 折叠到「更多」后，Popconfirm 不会自动触发；转成与 Popconfirm 同构的确认（问句贴图标，避免空正文 Modal）。
    if (popconfirm) {
      const popProps = (popconfirm.props || {}) as Record<string, unknown>
      onClick = () => {
        const onConfirm = popProps.onConfirm
        const titleNode = (popProps.title as React.ReactNode) ?? text
        const descriptionNode = popProps.description as React.ReactNode
        const hasDescription =
          descriptionNode != null && descriptionNode !== false && descriptionNode !== ''
        getAntdModal().confirm({
          // 无 description 时把问句放在 content，布局接近行内 Popconfirm（图标 + 文案）
          title: hasDescription ? titleNode : undefined,
          content: hasDescription ? descriptionNode : titleNode,
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
  minPrimaryVisible?: number
  ctx: NormalizeActionContext
} {
  let directMax = ROW_ACTIONS_DIRECT_MAX
  let minPrimaryVisible: number | undefined
  let suppressAudit = false
  if (typeof directMaxOrOptions === 'number') {
    directMax = directMaxOrOptions
  } else if (directMaxOrOptions != null && typeof directMaxOrOptions === 'object') {
    if (typeof directMaxOrOptions.directMax === 'number') directMax = directMaxOrOptions.directMax
    if (typeof directMaxOrOptions.minPrimaryVisible === 'number') {
      minPrimaryVisible = directMaxOrOptions.minPrimaryVisible
    }
    if (directMaxOrOptions.suppressAuditSemanticActions === true) suppressAudit = true
  }
  return { directMax, minPrimaryVisible, ctx: { suppressAuditSemanticActions: suppressAudit } }
}

/**
 * 页面自带的「更多」类 Dropdown（已有 menu.items）。
 * 绝不能再被系统溢出折进第二层「更多」，否则菜单项只剩不可点的「更多」文案。
 */
function isSelfManagedMenuDropdown(node: React.ReactNode): boolean {
  if (!React.isValidElement(node)) return false
  if (node.type !== Dropdown) return false
  const items = (node.props as { menu?: { items?: unknown } } | undefined)?.menu?.items
  return Array.isArray(items)
}

function mergeOverflowIntoSelfManagedDropdown(
  dropdown: React.ReactElement,
  overflow: React.ReactNode[],
  keyPrefix: string,
): React.ReactElement {
  const props = dropdown.props as {
    menu?: { items?: Array<Record<string, unknown> | null | undefined>; [k: string]: unknown }
    [k: string]: unknown
  }
  const existing = Array.isArray(props.menu?.items) ? [...props.menu.items] : []
  const extras = overflow.map((node, i) => toMenuItem(node, `${keyPrefix}-merged-${i}`))
  const needsDivider =
    existing.some((it) => it != null && (it as { type?: string }).type !== 'divider') &&
    extras.length > 0
  const items = needsDivider
    ? [...existing, { type: 'divider', key: `${keyPrefix}-merged-divider` }, ...extras]
    : [...existing, ...extras]
  return React.cloneElement(dropdown, {
    menu: {
      ...props.menu,
      items,
    },
  })
}

/**
 * 列表操作列：统一顺序；禁用项隐藏；需要溢出时主行至少 ROW_ACTIONS_MIN_PRIMARY_VISIBLE 个可点操作，其余进「更多」。
 * 若「更多」仅剩 1 项则改回主行直出（再点一层无收益，且「更多」触发器往往更宽）。
 */
export function renderRowActionsOverflow(
  nodes: React.ReactNode[],
  keyPrefix: string,
  directMaxOrOptions?: number | RenderRowActionsOverflowOptions,
): React.ReactNode {
  const { directMax, minPrimaryVisible, ctx } = parseOverflowArgs(directMaxOrOptions)
  const sorted = normalizeAndSortActions(nodes, ctx)
  const enabled = dedupeInlineRowIcons(sorted.filter(isClickableVisibleAction))
  /** 主行槽位：与操作列宽度共用 resolveRowActionInlineSlots，禁止在此另写公式 */
  const primarySlotsBeforeMore = resolveRowActionInlineSlots({ directMax, minPrimaryVisible })

  if (enabled.length === 0) {
    return null
  }

  /**
   * 钉住主行、不进系统「更多」：
   * 1) 页面自管 Dropdown（已有菜单）——再折会叠成「更多里套更多」
   * 2) skip 且无可静态识别交互的自管组件（如 UniWorkflowActions）
   *
   * 自管 Dropdown 不占主行动作槽位（它本身就是溢出容器）；其余钉住项仍从槽位扣除。
   */
  const isPinnedInlineAction = (node: React.ReactNode): boolean =>
    isSelfManagedMenuDropdown(node) ||
    (readExplicitActionKind(node) === 'skip' && !findInteractiveElement(node))

  const pinnedSlotConsumers = enabled.filter(
    (node) => isPinnedInlineAction(node) && !isSelfManagedMenuDropdown(node),
  ).length
  const collapsibleSlots = Math.max(0, primarySlotsBeforeMore - pinnedSlotConsumers)

  const inline: React.ReactNode[] = []
  let overflow: React.ReactNode[] = []
  let usedSlots = 0
  for (const node of enabled) {
    if (isPinnedInlineAction(node)) {
      inline.push(node)
      continue
    }
    if (usedSlots < collapsibleSlots) {
      inline.push(node)
      usedSlots += 1
      continue
    }
    overflow.push(node)
  }

  let finalInline = inline
  if (overflow.length > 0) {
    const selfManagedIdx = inline.findIndex((node) => isSelfManagedMenuDropdown(node))
    if (selfManagedIdx >= 0 && React.isValidElement(inline[selfManagedIdx])) {
      const merged = mergeOverflowIntoSelfManagedDropdown(
        inline[selfManagedIdx] as React.ReactElement,
        overflow,
        keyPrefix,
      )
      finalInline = [
        ...inline.slice(0, selfManagedIdx),
        merged,
        ...inline.slice(selfManagedIdx + 1),
      ]
      return (
        <Space
          className={ROW_ACTIONS_STRIP_CLASS}
          align="center"
          size={ROW_ACTIONS_INLINE_GAP}
          wrap={false}
          style={{ whiteSpace: 'nowrap' }}
        >
          {withRowActionKeys(finalInline, keyPrefix)}
        </Space>
      )
    }
  }

  // 系统「更多」仅 1 项时直出，避免多点一层
  if (overflow.length === 1) {
    finalInline = [...inline, overflow[0]]
    overflow = []
  }

  if (overflow.length === 0) {
    return (
      <Space
        className={ROW_ACTIONS_STRIP_CLASS}
        align="center"
        size={ROW_ACTIONS_INLINE_GAP}
        wrap={false}
        style={{ whiteSpace: 'nowrap' }}
      >
        {withRowActionKeys(finalInline, keyPrefix)}
      </Space>
    )
  }

  const keyedInline = withRowActionKeys(finalInline, keyPrefix)

  return (
    <Space
      className={ROW_ACTIONS_STRIP_CLASS}
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
