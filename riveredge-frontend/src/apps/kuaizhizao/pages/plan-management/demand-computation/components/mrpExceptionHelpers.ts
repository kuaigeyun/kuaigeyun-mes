import type { TFunction } from 'i18next'

export type MrpExceptionRow = {
  code?: string
  severity?: string
  message?: string
  qty?: number
  document_code?: string
}

export const MRP_EXCEPTION_ERROR_CODES = new Set([
  'PAST_DUE_START',
  'PAST_DUE_SUPPLY',
  'SHORTAGE_WITHIN_LEAD_TIME',
  'FIRM_FROZEN_SHORTAGE',
  'FENCE_SHORTAGE',
  'NEW_ORDER',
  'CANCEL_SUPPLY',
])

export const MRP_EXCEPTION_WARNING_CODES = new Set([
  'RESCHEDULE_IN',
  'RESCHEDULE_OUT',
  'LATE_VS_DEMAND',
  'EXCESS_SUPPLY',
  'BUCKET_RANGE_CLAMPED',
])

export function mrpExceptionTagColor(ex: MrpExceptionRow): 'error' | 'warning' | 'default' {
  if (ex.severity === 'error' || MRP_EXCEPTION_ERROR_CODES.has(String(ex.code || ''))) {
    return 'error'
  }
  if (ex.severity === 'warning' || MRP_EXCEPTION_WARNING_CODES.has(String(ex.code || ''))) {
    return 'warning'
  }
  return 'default'
}

export function mrpExceptionMessage(ex: MrpExceptionRow): string {
  const msg = ex.message
  if (msg && !['error', 'warning', 'info'].includes(msg)) return msg
  const sev = ex.severity
  if (sev && !['error', 'warning', 'info'].includes(sev)) return sev
  return '-'
}

export function mrpExceptionCodeLabel(code: string | undefined, t: TFunction): string {
  const key = String(code || '').trim()
  if (!key) return 'INFO'
  const i18nKey = `app.kuaizhizao.demandComputation.mrpExceptionCode.${key}`
  const translated = t(i18nKey)
  return translated === i18nKey ? key : translated
}

export function mrpExceptionListHasError(exceptions: MrpExceptionRow[]): boolean {
  return exceptions.some((e) => mrpExceptionTagColor(e) === 'error')
}
