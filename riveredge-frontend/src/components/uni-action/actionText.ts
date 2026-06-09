import React from 'react'
import { Popconfirm, Tooltip } from 'antd'

export function readNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(readNodeText).join('')
  if (!React.isValidElement(node)) return ''
  return readNodeText(node.props?.children)
}

export function normalizeActionLabelText(text: string): string {
  const trimmed = (text || '').trim()
  if (!trimmed) return trimmed
  if (trimmed === '查看') return '详情'
  return trimmed
}

/** 行内操作显式权限标记（与 manifest 标准 action 对齐；skip = 组件自管 RBAC） */
export type RowActionPermissionKind =
  | 'skip'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'import'
  | 'export'
  | 'print'
  | 'display'
  | 'submit'
  | 'audit'
  | 'approve'
  | 'reject'
  | 'revoke'
  | 'execute'
  | 'complete'
  | 'assign'
  | 'dispatch'
  | 'recall'
  | 'confirm_adjustment'
  | 'claim'
  | 'recycle'
  | 'release'
  | 'close'
  | 'obsolete'

export const ROW_ACTION_KIND_ATTR = 'data-action-kind' as const
export const ROW_ACTION_TONE_ATTR = 'data-action-tone' as const

export function rowActionKind(
  kind: RowActionPermissionKind,
): { [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind } {
  return { [ROW_ACTION_KIND_ATTR]: kind }
}

/** 行内高风险操作语义色（如重置密码）；RBAC 仍用 rowActionKind 的 manifest action */
export function rowActionToneDestructive(): { [ROW_ACTION_TONE_ATTR]: 'destructive' } {
  return { [ROW_ACTION_TONE_ATTR]: 'destructive' }
}

/** 溢出排序 / 样式用的语义分类（仅来自显式 `data-action-kind`） */
export type ActionKind = 'detail' | 'edit' | 'delete' | 'print' | 'items' | 'common' | 'other'

function readPropsActionKind(props: Record<string, unknown> | undefined): RowActionPermissionKind | null {
  const raw = props?.[ROW_ACTION_KIND_ATTR]
  if (typeof raw !== 'string') return null
  const kind = raw.trim().toLowerCase()
  return kind ? (kind as RowActionPermissionKind) : null
}

/** 从按钮树读取 `data-action-kind`（Popconfirm / Tooltip / 外层包裹均支持） */
export function readExplicitActionKind(node: React.ReactNode): RowActionPermissionKind | null {
  if (!React.isValidElement(node)) return null

  const props = node.props as Record<string, unknown>
  const onSelf = readPropsActionKind(props)
  if (onSelf) return onSelf

  const t = node.type
  if (t === Popconfirm || t === Tooltip) {
    return readExplicitActionKind(props.children as React.ReactNode)
  }

  const children = props.children
  if (children != null) {
    for (const child of React.Children.toArray(children)) {
      const found = readExplicitActionKind(child)
      if (found) return found
    }
  }

  return null
}

/** 显式 manifest action → 溢出排序语义 */
export function explicitKindToActionKind(kind: RowActionPermissionKind): ActionKind {
  switch (kind) {
    case 'read':
    case 'display':
      return 'detail'
    case 'update':
      return 'edit'
    case 'delete':
    case 'obsolete':
      return 'delete'
    case 'print':
      return 'print'
    case 'create':
    case 'submit':
    case 'audit':
    case 'approve':
    case 'reject':
    case 'revoke':
    case 'execute':
    case 'complete':
    case 'import':
    case 'export':
    case 'assign':
    case 'dispatch':
    case 'recall':
    case 'confirm_adjustment':
    case 'claim':
    case 'recycle':
    case 'release':
    case 'close':
      return 'common'
    case 'skip':
    default:
      return 'other'
  }
}

export function resolveActionKind(node: React.ReactNode): ActionKind {
  const explicit = readExplicitActionKind(node)
  if (!explicit) return 'other'
  return explicitKindToActionKind(explicit)
}

export function readActionPriority(node: React.ReactNode): number | undefined {
  if (!React.isValidElement(node)) return undefined
  const raw = (node.props as any)?.['data-action-priority']
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/**
 * 行内按钮语义色：删除 / 重置 / 卸载 等高风险操作使用主题 **危险红**（`danger`，对应 `--ant-color-error`）。
 */
export type ResolvedRowActionTone =
  | { mode: 'destructive'; type: 'text'; danger: true }
  | { mode: 'default'; type: 'text'; danger?: boolean }

export function resolveButtonTone(_text: string): ResolvedRowActionTone {
  return { mode: 'default', type: 'text' }
}

export function resolveButtonToneFromNode(
  node: React.ReactNode,
  inheritedExplicit?: RowActionPermissionKind | null,
): ResolvedRowActionTone {
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>
    if (props[ROW_ACTION_TONE_ATTR] === 'destructive') {
      return { mode: 'destructive', type: 'text', danger: true }
    }
  }

  const explicit = readExplicitActionKind(node) ?? inheritedExplicit ?? null
  if (
    explicit === 'delete' ||
    explicit === 'obsolete' ||
    explicit === 'reject' ||
    explicit === 'revoke' ||
    explicit === 'recycle'
  ) {
    return { mode: 'destructive', type: 'text', danger: true }
  }
  return { mode: 'default', type: 'text' }
}

/** 应用内简易审核按钮（如 haoligo 模具单），不受站点 business-config audit-required 压制 */
export function isAppLocalAuditAction(props: Record<string, unknown> | undefined): boolean {
  if (!props) return false
  return props['data-mold-sheet-audit'] != null
}
