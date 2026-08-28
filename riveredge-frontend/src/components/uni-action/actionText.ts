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
/** 与 manifest action 正交的统一视觉配置（禁止用文案推断） */
export const ROW_ACTION_VISUAL_PROFILE_ATTR = 'data-action-visual-profile' as const

export type RowActionVisualProfile =
  | 'add-follow-up-from-document'
  | 'reset-password'
  | 'test-connection'
  | 'balloon-annotate'
  | 'copy-create'
  | 'collect-receipt'
  | 'issue-invoice'
  | 'settle-voucher'
  | 'create-refund'
  | 'fill-invoice-number'
  | 'make-payment'
  | 'pick-settlement'
  | 'match-settlement'
  | 'transfer-settle'
  | 'view-doc-chain'
  | 'view-bank-flow'
  | 'note-endorse'
  | 'note-discount'
  | 'note-collect'
  | 'note-honor'
  | 'tax-certify'
  | 'tax-transfer-out'
  | 'tax-red-flush'

export function rowActionKind(
  kind: RowActionPermissionKind,
): { [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind } {
  return { [ROW_ACTION_KIND_ATTR]: kind }
}

/** 单据行「添加跟进」：统一 CommentOutlined + RBAC（跨模块用 skip，本模块用 create） */
export function rowActionAddFollowUpFromDocument(
  permission: 'skip' | 'create' = 'skip',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'add-follow-up-from-document',
  }
}

/** 账户类行操作「重置」：统一视觉语义并在 overflow 排序靠后 */
export function rowActionResetPassword(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'reset-password',
  }
}

/** 行内「测试连接」：ApiOutlined；RBAC 默认 execute */
export function rowActionTestConnection(
  permission: 'skip' | 'execute' | 'read' = 'execute',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'test-connection',
  }
}

/** 图纸气泡标注：排序紧随详情（与检验「执行检验」同级）；RBAC 由页面门控 */
export function rowActionBalloonAnnotate(
  permission: 'skip' | 'read' | 'update' = 'skip',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'balloon-annotate',
  }
}

/** 复制新建：行内双字「复制」；RBAC 默认 create */
export function rowActionCopyCreate(
  permission: 'skip' | 'create' = 'create',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'copy-create',
  }
}

/** 应收下推收款：行内双字「收款」；RBAC 默认 execute */
export function rowActionCollectReceipt(
  permission: 'skip' | 'execute' | 'create' = 'execute',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'collect-receipt',
  }
}

/** 应收/应付下推开票：行内双字「开票」；RBAC 默认 create */
export function rowActionIssueInvoice(
  permission: 'skip' | 'create' = 'create',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'issue-invoice',
  }
}

/** 收/付款核销：行内双字「核销」；RBAC 默认 submit */
export function rowActionSettleVoucher(
  permission: 'skip' | 'submit' | 'execute' = 'submit',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'settle-voucher',
  }
}

/** 收/付款创建退款：行内双字「退款」；RBAC 默认 create */
export function rowActionCreateRefund(
  permission: 'skip' | 'create' | 'submit' = 'create',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'create-refund',
  }
}

/** 销售/采购发票填写号码：行内双字「填号」；RBAC 默认 update */
export function rowActionFillInvoiceNumber(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'fill-invoice-number',
  }
}

/** 应付下推付款：行内双字「付款」；RBAC 默认 execute */
export function rowActionMakePayment(
  permission: 'skip' | 'execute' | 'create' = 'execute',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'make-payment',
  }
}

/** 往来核销：行内双字「选择」；UI 选侧单据，RBAC 默认 skip */
export function rowActionPickSettlement(
  permission: 'skip' | 'read' | 'update' = 'skip',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'pick-settlement',
  }
}

/** 往来核销：行内双字「匹配」；RBAC 默认 update */
export function rowActionMatchSettlement(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'match-settlement',
  }
}

/** 预收预付转核销：行内双字「转核」；RBAC 默认 update */
export function rowActionTransferSettle(
  permission: 'skip' | 'update' | 'execute' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'transfer-settle',
  }
}

/** 单据对账：行内双字「链路」；RBAC 默认 read */
export function rowActionViewDocChain(
  permission: 'skip' | 'read' = 'read',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'view-doc-chain',
  }
}

/** 银行账户：行内双字「流水」；RBAC 默认 read */
export function rowActionViewBankFlow(
  permission: 'skip' | 'read' = 'read',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'view-bank-flow',
  }
}

/** 应收票据背书：行内双字「背书」；RBAC 默认 update */
export function rowActionNoteEndorse(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'note-endorse',
  }
}

/** 应收票据贴现：行内双字「贴现」；RBAC 默认 update */
export function rowActionNoteDiscount(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'note-discount',
  }
}

/** 应收票据托收：行内双字「托收」；RBAC 默认 update */
export function rowActionNoteCollect(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'note-collect',
  }
}

/** 应付票据兑付：行内双字「兑付」；RBAC 默认 update */
export function rowActionNoteHonor(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'note-honor',
  }
}

/** 进项认证：行内双字「认证」；RBAC 默认 update */
export function rowActionTaxCertify(
  permission: 'skip' | 'update' | 'execute' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'tax-certify',
  }
}

/** 进项转出：行内双字「转出」；RBAC 默认 update */
export function rowActionTaxTransferOut(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'tax-transfer-out',
  }
}

/** 进项红冲：行内双字「红冲」；RBAC 默认 update */
export function rowActionTaxRedFlush(
  permission: 'skip' | 'update' = 'update',
): {
  [ROW_ACTION_KIND_ATTR]: RowActionPermissionKind
  [ROW_ACTION_VISUAL_PROFILE_ATTR]: RowActionVisualProfile
} {
  return {
    [ROW_ACTION_KIND_ATTR]: permission,
    [ROW_ACTION_VISUAL_PROFILE_ATTR]: 'tax-red-flush',
  }
}

export function readActionVisualProfile(node: React.ReactNode): RowActionVisualProfile | null {
  if (!React.isValidElement(node)) return null
  const raw = (node.props as Record<string, unknown>)?.[ROW_ACTION_VISUAL_PROFILE_ATTR]
  if (
    raw === 'add-follow-up-from-document' ||
    raw === 'reset-password' ||
    raw === 'test-connection' ||
    raw === 'balloon-annotate' ||
    raw === 'copy-create' ||
    raw === 'collect-receipt' ||
    raw === 'issue-invoice' ||
    raw === 'settle-voucher' ||
    raw === 'create-refund' ||
    raw === 'fill-invoice-number' ||
    raw === 'make-payment' ||
    raw === 'pick-settlement' ||
    raw === 'match-settlement' ||
    raw === 'transfer-settle' ||
    raw === 'view-doc-chain' ||
    raw === 'view-bank-flow' ||
    raw === 'note-endorse' ||
    raw === 'note-discount' ||
    raw === 'note-collect' ||
    raw === 'note-honor' ||
    raw === 'tax-certify' ||
    raw === 'tax-transfer-out' ||
    raw === 'tax-red-flush'
  ) {
    return raw
  }
  const children = (node.props as Record<string, unknown>)?.children
  if (children != null) {
    for (const child of React.Children.toArray(children)) {
      const found = readActionVisualProfile(child)
      if (found) return found
    }
  }
  return null
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
  // skip 仅表示“当前层不声明业务动作”，若子节点声明了真实动作，应以子节点为准。
  if (onSelf && onSelf !== 'skip') return onSelf

  const t = node.type
  if (t === Popconfirm || t === Tooltip) {
    const fromChild = readExplicitActionKind(props.children as React.ReactNode)
    if (fromChild) return fromChild
    return onSelf ?? null
  }

  const children = props.children
  if (children != null) {
    for (const child of React.Children.toArray(children)) {
      const found = readExplicitActionKind(child)
      if (found) return found
    }
  }

  return onSelf ?? null
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
