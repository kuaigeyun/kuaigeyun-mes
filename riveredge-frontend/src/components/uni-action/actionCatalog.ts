/**
 * 行内操作列文案 / 排序唯一真源（与后端 permission_action_spec.ACTION_DISPLAY_LABELS 对齐，行内语义细化）。
 * 页面禁止手写 type/icon/文案竞争；仅 rowActionKind + onClick（特例用 rowActionLabelKeep）。
 */
import i18next from 'i18next'
import type { RowActionPermissionKind, RowActionVisualProfile } from './actionText'

/** 页面保留自定义文案时显式标记（如「撤回下推」复用 print action） */
export const ROW_ACTION_LABEL_KEEP_ATTR = 'data-action-label-keep' as const

export function rowActionLabelKeep(): { [ROW_ACTION_LABEL_KEEP_ATTR]: true } {
  return { [ROW_ACTION_LABEL_KEEP_ATTR]: true }
}

/** 与后端 ACTION_DISPLAY_LABELS 对齐；行内 read→详情、approve→审核 等细化 */
const ROW_ACTION_LABEL_FALLBACK: Partial<Record<RowActionPermissionKind, string>> = {
  read: '详情',
  display: '展示',
  create: '新建',
  update: '编辑',
  delete: '删除',
  import: '导入',
  export: '导出',
  print: '打印',
  submit: '提交',
  audit: '审核',
  approve: '审核',
  reject: '驳回',
  revoke: '撤销审核',
  execute: '执行',
  complete: '完修',
  assign: '分配',
  dispatch: '发出',
  recall: '确认收回',
  confirm_adjustment: '确认调整',
  claim: '认领',
  recycle: '回收',
  release: '释放',
  close: '关闭',
  obsolete: '作废',
}

const VISUAL_PROFILE_LABEL_FALLBACK: Record<RowActionVisualProfile, string> = {
  'add-follow-up-from-document': '添加跟进',
  'reset-password': '重置',
  'test-connection': '测试连接',
  'balloon-annotate': '标注',
  'copy-create': '复制',
  'collect-receipt': '收款',
  'issue-invoice': '开票',
  'settle-voucher': '核销',
  'create-refund': '退款',
  'fill-invoice-number': '填号',
  'make-payment': '付款',
  'pick-settlement': '选择',
  'match-settlement': '匹配',
  'transfer-settle': '转核',
  'view-doc-chain': '链路',
  'view-bank-flow': '流水',
  'note-endorse': '背书',
  'note-discount': '贴现',
  'note-collect': '托收',
  'note-honor': '兑付',
  'tax-certify': '认证',
  'tax-transfer-out': '转出',
  'tax-red-flush': '红冲',
}

const ROW_ACTION_I18N_KEY: Partial<Record<RowActionPermissionKind, string>> = {
  read: 'components.uniAction.read',
  display: 'components.uniAction.display',
  create: 'components.uniAction.create',
  update: 'components.uniAction.update',
  delete: 'components.uniAction.delete',
  import: 'components.uniAction.import',
  export: 'components.uniAction.export',
  print: 'components.uniAction.print',
  submit: 'components.uniAction.submit',
  audit: 'components.uniAction.audit',
  approve: 'components.uniAction.approve',
  reject: 'components.uniAction.reject',
  revoke: 'components.uniAction.revoke',
  execute: 'components.uniAction.execute',
  complete: 'components.uniAction.complete',
  assign: 'components.uniAction.assign',
  dispatch: 'components.uniAction.dispatch',
  recall: 'components.uniAction.recall',
  confirm_adjustment: 'components.uniAction.confirmAdjustment',
  claim: 'components.uniAction.claim',
  recycle: 'components.uniAction.recycle',
  release: 'components.uniAction.release',
  close: 'components.uniAction.close',
  obsolete: 'components.uniAction.obsolete',
}

const VISUAL_PROFILE_I18N_KEY: Record<RowActionVisualProfile, string> = {
  'add-follow-up-from-document': 'components.uniAction.addFollowUpFromDocument',
  'reset-password': 'components.uniAction.resetPassword',
  'test-connection': 'components.uniAction.testConnection',
  'balloon-annotate': 'components.uniAction.balloonAnnotate',
  'copy-create': 'components.uniAction.copyCreate',
  'collect-receipt': 'components.uniAction.collectReceipt',
  'issue-invoice': 'components.uniAction.issueInvoice',
  'settle-voucher': 'components.uniAction.settleVoucher',
  'create-refund': 'components.uniAction.createRefund',
  'fill-invoice-number': 'components.uniAction.fillInvoiceNumber',
  'make-payment': 'components.uniAction.makePayment',
  'pick-settlement': 'components.uniAction.pickSettlement',
  'match-settlement': 'components.uniAction.matchSettlement',
  'transfer-settle': 'components.uniAction.transferSettle',
  'view-doc-chain': 'components.uniAction.viewDocChain',
  'view-bank-flow': 'components.uniAction.viewBankFlow',
  'note-endorse': 'components.uniAction.noteEndorse',
  'note-discount': 'components.uniAction.noteDiscount',
  'note-collect': 'components.uniAction.noteCollect',
  'note-honor': 'components.uniAction.noteHonor',
  'tax-certify': 'components.uniAction.taxCertify',
  'tax-transfer-out': 'components.uniAction.taxTransferOut',
  'tax-red-flush': 'components.uniAction.taxRedFlush',
}

/** 行内操作排序（细于 detail/edit/delete 三分法；与 overflow 直出/折叠一致） */
const ROW_ACTION_SORT_RANK: Partial<Record<RowActionPermissionKind, number>> = {
  read: 10,
  display: 11,
  update: 20,
  delete: 30,
  submit: 40,
  revoke: 50,
  audit: 60,
  approve: 61,
  reject: 62,
  create: 70,
  execute: 200,
  complete: 201,
  assign: 210,
  dispatch: 211,
  recall: 212,
  confirm_adjustment: 213,
  import: 300,
  export: 301,
  print: 302,
  claim: 320,
  recycle: 330,
  release: 340,
  close: 350,
  obsolete: 360,
  skip: 1000,
}

const VISUAL_PROFILE_SORT_RANK: Record<RowActionVisualProfile, number> = {
  'add-follow-up-from-document': 85,
  'test-connection': 15,
  'balloon-annotate': 15,
  'copy-create': 71,
  'collect-receipt': 72,
  'issue-invoice': 73,
  'settle-voucher': 74,
  'create-refund': 75,
  'fill-invoice-number': 21,
  'make-payment': 72.5,
  'pick-settlement': 12,
  'match-settlement': 13,
  'transfer-settle': 74.5,
  'view-doc-chain': 14,
  'view-bank-flow': 14.5,
  'note-endorse': 22,
  'note-discount': 23,
  'note-collect': 24,
  'note-honor': 22,
  'tax-certify': 200.5,
  'tax-transfer-out': 201,
  'tax-red-flush': 202,
  'reset-password': 990,
}

export function rowActionLabel(kind: RowActionPermissionKind): string {
  const key = ROW_ACTION_I18N_KEY[kind]
  const fallback = ROW_ACTION_LABEL_FALLBACK[kind] ?? kind
  if (!key) return fallback
  return i18next.t(key, { defaultValue: fallback })
}

export function rowActionVisualProfileLabel(profile: RowActionVisualProfile): string {
  const key = VISUAL_PROFILE_I18N_KEY[profile]
  const fallback = VISUAL_PROFILE_LABEL_FALLBACK[profile]
  return i18next.t(key, { defaultValue: fallback })
}

export function rowActionSortRank(
  kind: RowActionPermissionKind | null | undefined,
  profile?: RowActionVisualProfile | null,
): number {
  if (profile && VISUAL_PROFILE_SORT_RANK[profile] != null) {
    return VISUAL_PROFILE_SORT_RANK[profile]
  }
  if (kind && ROW_ACTION_SORT_RANK[kind] != null) {
    return ROW_ACTION_SORT_RANK[kind]!
  }
  return 500
}

/** 是否应对该行内按钮注入目录文案（skip 与 label-keep 除外） */
export function shouldInjectRowActionCatalogLabel(
  kind: RowActionPermissionKind | null | undefined,
  labelKeep: boolean,
  existingLabel?: string | null,
): boolean {
  if (labelKeep || !kind || kind === 'skip') return false
  if ((existingLabel || '').trim()) return false
  return kind in ROW_ACTION_LABEL_FALLBACK
}
