import type { TFunction } from 'i18next';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';
import { normalizeQualityInspectionListResponse } from './qualityInspectionListCore';
import {
  EIGHT_D_SEVERITY_I18N_KEY,
  EIGHT_D_STATUS_I18N_KEY,
} from '../pages/quality-management/eight-d-reports/components/eightDMeta';
import {
  QUALITY_DEFECT_TYPE_I18N,
  QUALITY_DISPOSAL_I18N,
  QUALITY_NC_LEDGER_STATUS_I18N,
  QUALITY_PLAN_TYPE_I18N,
} from '../pages/quality-management/components/qualityMeta';
import { formatDateTime } from '../../../utils/format';

export const NC_LEDGER_PINNED_STATUS_FIELD = 'status';
export const EIGHT_D_PINNED_STATUS_FIELD = 'status';
export const INSPECTION_PLAN_PINNED_STATUS_FIELD = 'is_active';

export { normalizeQualityInspectionListResponse as normalizeQualityImprovementListResponse };

export function buildNcLedgerStatusValueEnum(
  t: TFunction,
): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(QUALITY_NC_LEDGER_STATUS_I18N).map(([value, key]) => [
      value,
      { text: t(key) },
    ]),
  );
}

export function buildNcDefectTypeValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(QUALITY_DEFECT_TYPE_I18N).map(([value, key]) => [value, { text: t(key) }]),
  );
}

export function buildNcDispositionValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(QUALITY_DISPOSAL_I18N).map(([value, key]) => [value, { text: t(key) }]),
  );
}

export function buildEightDStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(EIGHT_D_STATUS_I18N_KEY).map(([value, key]) => [value, { text: t(key) }]),
  );
}

export function buildEightDSeverityValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(EIGHT_D_SEVERITY_I18N_KEY).map(([value, key]) => [value, { text: t(key) }]),
  );
}

export function buildInspectionPlanTypeValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(QUALITY_PLAN_TYPE_I18N).map(([value, key]) => [value, { text: t(key) }]),
  );
}

export function buildInspectionPlanActiveValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    true: { text: t('app.kuaizhizao.quality.plans.active.enabled') },
    false: { text: t('app.kuaizhizao.quality.plans.active.disabled') },
  };
}

function pickString(searchFormValues: Record<string, unknown> | null | undefined, key: string) {
  const v = searchFormValues?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveOrderBy(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  return sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
}

function parseDateTimeRange(range: unknown): { from?: string; to?: string } {
  if (!range || !Array.isArray(range) || !range[0]) {
    return {};
  }
  const from = formatDateTime(range[0] as string | Date, 'YYYY-MM-DD HH:mm:ss');
  const to = range[1] ? formatDateTime(range[1] as string | Date, 'YYYY-MM-DD HH:mm:ss') : from;
  return { from, to };
}

export function formatQualityDateTimeCell(value: unknown): string {
  if (!value) return '-';
  return formatDateTime(value as string | Date, 'YYYY-MM-DD HH:mm');
}

export function resolveInspectionPlanListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | number | boolean | undefined> = {
    order_by: resolveOrderBy(sort),
    plan_type: typeof s.plan_type === 'string' && s.plan_type ? s.plan_type : undefined,
    is_active:
      s.is_active === true || s.is_active === 'true'
        ? true
        : s.is_active === false || s.is_active === 'false'
          ? false
          : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const planCode = pickString(s, 'plan_code');
    const planName = pickString(s, 'plan_name');
    if (planCode) params.plan_code = planCode;
    if (planName) params.plan_name = planName;
  }

  return params;
}

export function resolveSpcSampleListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const s = searchFormValues ?? {};
  const fuzzyKeyword = pickString(s, 'keyword');
  const sampleTimeRange = parseDateTimeRange(s.sample_time_range);

  const params: Record<string, string | number | undefined> = {
    order_by: resolveOrderBy(sort),
    sample_time_from: sampleTimeRange.from,
    sample_time_to: sampleTimeRange.to,
  };

  if (fuzzyKeyword) {
    params.keyword = fuzzyKeyword;
  } else {
    const characteristicName = pickString(s, 'characteristic_name');
    if (characteristicName) params.characteristic_name = characteristicName;
  }

  return params;
}

export function resolveNonconformingLedgerListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  urlFilters?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const order_by =
    sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
  const s = searchFormValues ?? {};
  const pick = (key: string) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const { date_start: created_start_date, date_end: created_end_date } =
    parseSalesReportDateRange(s, ['created_at_range', 'createdAtRange']);

  const pickUrlId = (key: string) => {
    const v = urlFilters?.[key];
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    order_by,
    keyword: pick('keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    defect_type: typeof s.defect_type === 'string' && s.defect_type ? s.defect_type : undefined,
    disposition: typeof s.disposition === 'string' && s.disposition ? s.disposition : undefined,
    created_start_date,
    created_end_date,
    defect_id: pickUrlId('defect_id'),
    incoming_inspection_id: pickUrlId('incoming_inspection_id'),
    process_inspection_id: pickUrlId('process_inspection_id'),
    finished_goods_inspection_id: pickUrlId('finished_goods_inspection_id'),
  };
}

export function resolveEightDReportListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const order_by =
    sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
  const s = searchFormValues ?? {};
  const pick = (key: string) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const { date_start: created_start_date, date_end: created_end_date } =
    parseSalesReportDateRange(s, ['created_at_range', 'createdAtRange']);
  const { date_start: due_start_date, date_end: due_end_date } = parseSalesReportDateRange(s, [
    'due_date_range',
    'dueDateRange',
  ]);
  const overdueRaw = s.overdue_only;
  const overdue_only =
    overdueRaw === true ||
    overdueRaw === 'true' ||
    (Array.isArray(overdueRaw) && overdueRaw.includes('true'));

  return {
    order_by,
    keyword: pick('keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    severity: typeof s.severity === 'string' && s.severity ? s.severity : undefined,
    overdue_only: overdue_only || undefined,
    created_start_date,
    created_end_date,
    due_start_date,
    due_end_date,
  };
}
