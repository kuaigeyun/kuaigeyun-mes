/**
 * 报工：末道工序判定与入库提示
 */
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

export function resolveLastInboundHint(
  t: (key: string) => string,
  mode: string | undefined,
): string {
  const m = mode ?? 'none'
  if (m === 'direct_inbound') return t('apps.kuaizhizao.workOrder.quickReport.lastOpDirectInbound')
  if (m === 'inbound_notice') return t('apps.kuaizhizao.workOrder.quickReport.lastOpInboundNotice')
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
