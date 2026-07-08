import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';

export const QUALITY_INSPECTION_PINNED_STATUS_FIELD = 'status';

export function buildQualityInspectionDocStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string }> {
  return {
    待检验: { text: t('app.kuaizhizao.quality.common.docStatus.pendingInspection') },
    已检验: { text: t('app.kuaizhizao.quality.common.status.inspected') },
  };
}

export function buildQualityInspectionQualityStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string }> {
  return {
    合格: { text: t('app.kuaizhizao.quality.common.qualityStatus.qualified') },
    不合格: { text: t('app.kuaizhizao.quality.common.qualityStatus.unqualified') },
  };
}

export function buildOqcInspectionStatusValueEnum(
  t: (key: string) => string,
): Record<string, { text: string }> {
  return {
    待检验: { text: t('app.kuaizhizao.quality.common.docStatus.pendingInspection') },
    已检验: { text: t('app.kuaizhizao.quality.common.status.inspected') },
    待审核: { text: t('app.kuaizhizao.quality.common.reviewStatus.pendingReview') },
    已审核: { text: t('app.kuaizhizao.quality.common.reviewStatus.reviewed') },
    已驳回: { text: t('app.kuaizhizao.quality.common.reviewStatus.rejected') },
  };
}

export function resolveQualityInspectionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  const order_by =
    sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
  const s = searchFormValues ?? {};
  const pick = (key: string) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const { date_start: inspection_start_date, date_end: inspection_end_date } =
    parseSalesReportDateRange(s, ['inspection_time_range', 'inspectionTimeRange']);
  const { date_start: created_start_date, date_end: created_end_date } =
    parseSalesReportDateRange(s, ['created_at_range', 'createdAtRange']);

  return {
    order_by,
    keyword: pick('keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    quality_status:
      typeof s.quality_status === 'string' && s.quality_status ? s.quality_status : undefined,
    supplier_id: s.supplier_id != null && s.supplier_id !== '' ? Number(s.supplier_id) : undefined,
    material_id: s.material_id != null && s.material_id !== '' ? Number(s.material_id) : undefined,
    work_order_id:
      s.work_order_id != null && s.work_order_id !== '' ? Number(s.work_order_id) : undefined,
    operation_id:
      s.operation_id != null && s.operation_id !== '' ? Number(s.operation_id) : undefined,
    inspection_start_date,
    inspection_end_date,
    created_start_date,
    created_end_date,
  };
}

export function normalizeQualityInspectionListResponse(res: unknown): { data: unknown[]; total: number } {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const obj = res as { data?: unknown[]; items?: unknown[]; total?: number };
    const data = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.items) ? obj.items : [];
    const total = typeof obj.total === 'number' ? obj.total : data.length;
    return { data, total };
  }
  return { data: [], total: 0 };
}
