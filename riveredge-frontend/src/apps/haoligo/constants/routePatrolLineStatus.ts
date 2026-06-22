export const ROUTE_PATROL_LINE_STATUS_NORMAL = 'normal' as const;
export const ROUTE_PATROL_LINE_STATUS_ABNORMAL = 'abnormal' as const;
export const ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING = 'not_producing' as const;

export type RoutePatrolLineStatus =
  | typeof ROUTE_PATROL_LINE_STATUS_NORMAL
  | typeof ROUTE_PATROL_LINE_STATUS_ABNORMAL
  | typeof ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING;

export const ROUTE_PATROL_LINE_STATUS_OPTIONS: Array<{
  value: RoutePatrolLineStatus;
  labelKey: string;
  fallback: string;
}> = [
  {
    value: ROUTE_PATROL_LINE_STATUS_NORMAL,
    labelKey: 'app.haoligo.equipment.documents.resultNormal',
    fallback: '正常',
  },
  {
    value: ROUTE_PATROL_LINE_STATUS_ABNORMAL,
    labelKey: 'app.haoligo.equipment.documents.resultAbnormal',
    fallback: '异常',
  },
  {
    value: ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING,
    labelKey: 'app.haoligo.equipment.documents.resultNotProducing',
    fallback: '未生产',
  },
];

export function normalizeRoutePatrolLineStatus(
  value: unknown,
  fallback: RoutePatrolLineStatus = ROUTE_PATROL_LINE_STATUS_NORMAL,
): RoutePatrolLineStatus {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === ROUTE_PATROL_LINE_STATUS_ABNORMAL) return ROUTE_PATROL_LINE_STATUS_ABNORMAL;
  if (raw === ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING) return ROUTE_PATROL_LINE_STATUS_NOT_PRODUCING;
  if (raw === ROUTE_PATROL_LINE_STATUS_NORMAL) return ROUTE_PATROL_LINE_STATUS_NORMAL;
  if (raw === 'false') return ROUTE_PATROL_LINE_STATUS_ABNORMAL;
  if (raw === 'true') return ROUTE_PATROL_LINE_STATUS_NORMAL;
  return fallback;
}

export function isRoutePatrolLineAbnormal(status: unknown): boolean {
  return normalizeRoutePatrolLineStatus(status) === ROUTE_PATROL_LINE_STATUS_ABNORMAL;
}

export function patchRoutePatrolLineStatus<T extends { line_status: RoutePatrolLineStatus; abnormal_description?: string | null; attachment_file_ids?: string[] | null }>(
  line: T,
  nextStatus: RoutePatrolLineStatus,
): T {
  if (nextStatus === ROUTE_PATROL_LINE_STATUS_ABNORMAL) {
    return { ...line, line_status: nextStatus };
  }
  return {
    ...line,
    line_status: nextStatus,
    abnormal_description: null,
    attachment_file_ids: null,
  };
}
