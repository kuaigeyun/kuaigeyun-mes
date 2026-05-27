import React from 'react'

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

export type ActionKind = 'detail' | 'edit' | 'delete' | 'items' | 'common' | 'other'

export function resolveActionKind(node: React.ReactNode): ActionKind {
  const text = readNodeText(node).replace(/\s+/g, '').trim()
  if (!text) return 'other'
  if (text.includes('详情') || text.includes('查看')) return 'detail'
  if (text.includes('编辑') || text.includes('修改') || text.includes('设置') || text.includes('配置')) return 'edit'
  if (text.includes('删除')) return 'delete'
  if (text.includes('项') || text.includes('列表') || text.includes('明细')) return 'items'
  if (/下推|提交|审核|确认|执行|发布|启用|停用|同步|添加|新增/.test(text)) return 'common'
  return 'other'
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

export function resolveButtonTone(text: string): ResolvedRowActionTone {
  const normalized = text.replace(/\s+/g, '')
  if (/删除|驳回|报废|重置|清空|清除|卸载/.test(normalized)) {
    return { mode: 'destructive', type: 'text', danger: true }
  }
  return { mode: 'default', type: 'text' }
}

/** 应用内简易审核按钮（如 haoligo 模具单），不受站点 business-config audit-required 压制 */
export function isAppLocalAuditAction(props: Record<string, unknown> | undefined): boolean {
  if (!props) return false
  return props['data-mold-sheet-audit'] != null
}

export function isAuditSemanticAction(text: string): boolean {
  const normalized = text.replace(/\s+/g, '')
  // 撤回/撤销审核不属于「发起审核」语义，不应被站点审核开关隐藏
  if (/撤回|撤销/.test(normalized)) return false
  return (
    normalized === '确认' ||
    normalized.includes('审核') ||
    normalized.includes('审批') ||
    normalized.includes('驳回')
  )
}
