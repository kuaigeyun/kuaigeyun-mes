const P = 'app.kuaizhizao.productionException';

const ALERT_LEVEL_KEYS = ['low', 'medium', 'high', 'critical'] as const;

const STANDARD_EXCEPTION_STATUS_KEYS = ['pending', 'processing', 'resolved', 'cancelled'] as const;

const QUALITY_EXCEPTION_STATUS_KEYS = [
  'pending',
  'investigating',
  'correcting',
  'closed',
  'cancelled',
] as const;

const EXCEPTION_PROCESS_STATUS_KEYS = ['pending', 'processing', 'resolved', 'cancelled'] as const;

export function buildProductionExceptionAlertLevelValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Warning' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Warning' | 'Error'> = {
    low: 'Default',
    medium: 'Warning',
    high: 'Error',
    critical: 'Error',
  };
  return Object.fromEntries(
    ALERT_LEVEL_KEYS.map((key) => [
      key,
      { text: t(`${P}.alertLevel.${key}`), status: statusByKey[key] },
    ]),
  );
}

export function buildStandardProductionExceptionStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    pending: 'Default',
    processing: 'Processing',
    resolved: 'Success',
    cancelled: 'Error',
  };
  return Object.fromEntries(
    STANDARD_EXCEPTION_STATUS_KEYS.map((key) => [
      key,
      { text: t(`${P}.status.${key}`), status: statusByKey[key] },
    ]),
  );
}

export function buildQualityExceptionStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    pending: 'Default',
    investigating: 'Processing',
    correcting: 'Processing',
    closed: 'Success',
    cancelled: 'Error',
  };
  return Object.fromEntries(
    QUALITY_EXCEPTION_STATUS_KEYS.map((key) => [
      key,
      { text: t(`${P}.status.${key}`), status: statusByKey[key] },
    ]),
  );
}

export function buildExceptionProcessStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    pending: 'Default',
    processing: 'Processing',
    resolved: 'Success',
    cancelled: 'Error',
  };
  return Object.fromEntries(
    EXCEPTION_PROCESS_STATUS_KEYS.map((key) => [
      key,
      { text: t(`${P}.status.${key}`), status: statusByKey[key] },
    ]),
  );
}

export function resolveProductionExceptionListStatusParams(
  searchFormValues?: Record<string, unknown> | null,
  statusField: 'status' | 'process_status' = 'status',
): { status?: string; process_status?: string } {
  const raw = searchFormValues?.[statusField];
  if (raw == null || String(raw).trim() === '') return {};
  const value = String(raw).trim();
  if (statusField === 'process_status') {
    if (EXCEPTION_PROCESS_STATUS_KEYS.includes(value as (typeof EXCEPTION_PROCESS_STATUS_KEYS)[number])) {
      return { process_status: value };
    }
    return {};
  }
  if (
    STANDARD_EXCEPTION_STATUS_KEYS.includes(value as (typeof STANDARD_EXCEPTION_STATUS_KEYS)[number])
    || QUALITY_EXCEPTION_STATUS_KEYS.includes(value as (typeof QUALITY_EXCEPTION_STATUS_KEYS)[number])
  ) {
    return { status: value };
  }
  return {};
}
