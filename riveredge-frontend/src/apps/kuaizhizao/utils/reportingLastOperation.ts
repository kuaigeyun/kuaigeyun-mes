/**
 * 报工：末道工序判定与入库提示
 */
import type { MessageInstance } from 'antd/es/message/interface'
import type { TFunction } from 'i18next'
import type { WorkOrderExecutionConfig } from '../services/work-order'

export function resolveIsLastOperation(
  operation: { sequence?: number | string } | null | undefined,
  operations: Array<{ sequence?: number | string }> | null | undefined,
): boolean {
  if (!operation || !operations?.length) return false
  const seq = Number(operation.sequence)
  const maxSeq = Math.max(...operations.map((o) => Number(o.sequence) || 0))
  if (!Number.isFinite(seq) || !Number.isFinite(maxSeq)) return false
  return seq === maxSeq
}

export type LastInboundHintOptions = {
  mode?: string
  fqcEnabled?: boolean
}

export function isFqcEnabledForInboundHint(
  executionConfig?: Pick<
    WorkOrderExecutionConfig,
    'fqc_stage_enabled' | 'fqc_module_enabled'
  > | null,
): boolean {
  return Boolean(executionConfig?.fqc_stage_enabled && executionConfig?.fqc_module_enabled)
}

export function buildLastInboundHintOptions(
  executionConfig?: WorkOrderExecutionConfig | null,
): LastInboundHintOptions {
  return {
    mode: executionConfig?.last_operation_auto_inbound_mode,
    fqcEnabled: isFqcEnabledForInboundHint(executionConfig),
  }
}

export function resolveLastInboundHint(
  t: TFunction,
  options?: LastInboundHintOptions | string,
): string {
  const opts: LastInboundHintOptions =
    typeof options === 'string' ? { mode: options } : (options ?? {})
  const mode = opts.mode ?? 'none'
  const fqc = opts.fqcEnabled === true

  if (mode === 'direct_inbound') {
    return fqc
      ? t('apps.kuaizhizao.workOrder.quickReport.lastOpDirectInboundWithFqc')
      : t('apps.kuaizhizao.workOrder.quickReport.lastOpDirectInbound')
  }
  if (mode === 'inbound_notice') {
    return fqc
      ? t('apps.kuaizhizao.workOrder.quickReport.lastOpInboundNoticeWithFqc')
      : t('apps.kuaizhizao.workOrder.quickReport.lastOpInboundNotice')
  }
  return t('apps.kuaizhizao.workOrder.quickReport.lastOpNoAutoInbound')
}

export function isInboundWarehouseRequiredForLastOperation(
  isLastOperation: boolean,
  mode: string | undefined,
): boolean {
  if (!isLastOperation) return false
  const m = mode ?? 'none'
  return m === 'direct_inbound' || m === 'inbound_notice'
}

export type ReportingPostActionNotice = {
  level?: 'info' | 'warning' | 'success'
  code?: string
  receipt_code?: string | null
}

const POST_ACTION_I18N_PREFIX = 'app.kuaizhizao.workReporting.postAction'

export function showReportingPostActionNotices(
  messageApi: MessageInstance,
  t: TFunction,
  record?: { post_action_notices?: ReportingPostActionNotice[] | null } | null,
): void {
  const notices = record?.post_action_notices
  if (!notices?.length) return
  for (const notice of notices) {
    const code = notice.code?.trim()
    if (!code) continue
    const key = `${POST_ACTION_I18N_PREFIX}.${code}`
    const receiptLabel = notice.receipt_code ? `（${notice.receipt_code}）` : ''
    const text = t(key, { receiptLabel })
    if (text === key) continue
    const level = notice.level ?? 'info'
    if (level === 'warning') {
      messageApi.warning(text, 8)
    } else if (level === 'success') {
      messageApi.success(text, 5)
    } else {
      messageApi.info(text, 8)
    }
  }
}
