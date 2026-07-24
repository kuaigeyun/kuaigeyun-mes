import type { TFunction } from 'i18next';
import { extractProTableSort } from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';

export const EQUIPMENT_OPS_PINNED_STATUS_FIELD = 'status';

/** 设备运维单据/追溯表状态徽章色（Ant Tag color） */
const EQUIPMENT_OPS_STATUS_TAG_COLORS: Record<string, string> = {
  已完成: 'success',
  已修复: 'success',
  已审核: 'success',
  合格: 'success',
  正常: 'success',
  进行中: 'processing',
  处理中: 'processing',
  执行中: 'processing',
  已提交: 'processing',
  已发布: 'processing',
  草稿: 'default',
  待处理: 'default',
  已关闭: 'default',
  已取消: 'default',
  已驳回: 'error',
  不合格: 'error',
  限制使用: 'warning',
};

const EQUIPMENT_FAULT_LEVEL_TAG_COLORS: Record<string, string> = {
  高: 'error',
  中: 'warning',
  低: 'default',
  紧急: 'error',
  一般: 'default',
};

export function equipmentOpsStatusTagColor(status: string | null | undefined): string {
  if (!status) return 'default';
  return EQUIPMENT_OPS_STATUS_TAG_COLORS[status] ?? 'default';
}

export function equipmentFaultLevelTagColor(level: string | null | undefined): string {
  if (!level) return 'default';
  return EQUIPMENT_FAULT_LEVEL_TAG_COLORS[level] ?? 'default';
}

export function normalizeEquipmentListResponse(res: unknown): { data: unknown[]; total: number } {
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  if (res && typeof res === 'object') {
    const obj = res as { items?: unknown[]; data?: unknown[]; total?: number };
    const data = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : [];
    const total = typeof obj.total === 'number' ? obj.total : data.length;
    return { data, total };
  }
  return { data: [], total: 0 };
}

function pickString(searchFormValues: Record<string, unknown> | null | undefined, key: string) {
  const v = searchFormValues?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function resolveOrderBy(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  return sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
}

export function buildSpotCheckStatusValueEnum(_t: TFunction): Record<string, { text: string }> {
  return {
    已完成: { text: '已完成' },
  };
}

export function buildAbnormalityValueEnum(t: TFunction, p: string): Record<string, { text: string }> {
  return {
    true: { text: t(`${p}.abnormal`) },
    false: { text: t(`${p}.normal`) },
  };
}

export function resolveSpotCheckListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: check_start_date, date_end: check_end_date } = parseSalesReportDateRange(s, [
    'check_date_range',
    'checkDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const abn = s.has_abnormality;
  const has_abnormality =
    abn === true || abn === 'true' ? true : abn === false || abn === 'false' ? false : undefined;

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    check_start_date,
    check_end_date,
    created_start_date,
    created_end_date,
    has_abnormality,
  };
}

export function resolveRoutePatrolListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | number | boolean | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: patrol_start_date, date_end: patrol_end_date } = parseSalesReportDateRange(s, [
    'patrol_date_range',
    'patrolDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const abn = s.has_abnormality;
  const has_abnormality =
    abn === true || abn === 'true' ? true : abn === false || abn === 'false' ? false : undefined;

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    patrol_start_date,
    patrol_end_date,
    created_start_date,
    created_end_date,
    has_abnormality,
  };
}

export const EQUIPMENT_FAULT_PINNED_STATUS_FIELD = 'status';

export function buildEquipmentFaultStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.equipmentFault';
  return {
    待处理: { text: t(`${P}.status.pending`) },
    处理中: { text: t(`${P}.status.processing`) },
    已修复: { text: t(`${P}.status.repaired`) },
    已关闭: { text: t(`${P}.status.closed`) },
  };
}

export function buildEquipmentRepairStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.equipmentRepair';
  return {
    进行中: { text: t(`${P}.status.inProgress`) },
    已完成: { text: t(`${P}.status.completed`) },
    已取消: { text: t(`${P}.status.cancelled`) },
  };
}

export function resolveEquipmentFaultListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: fault_start_date, date_end: fault_end_date } = parseSalesReportDateRange(s, [
    'fault_date_range',
    'faultDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    fault_type: typeof s.fault_type === 'string' && s.fault_type ? s.fault_type : undefined,
    fault_start_date,
    fault_end_date,
    created_start_date,
    created_end_date,
  };
}

export function resolveEquipmentRepairListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: repair_start_date, date_end: repair_end_date } = parseSalesReportDateRange(s, [
    'repair_date_range',
    'repairDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    repair_start_date,
    repair_end_date,
    created_start_date,
    created_end_date,
  };
}

export const MAINTENANCE_PLAN_PINNED_STATUS_FIELD = 'status';

export function buildMaintenancePlanStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.maintenancePlan';
  return {
    草稿: { text: t(`${P}.status.draft`) },
    已发布: { text: t(`${P}.status.published`) },
    执行中: { text: t(`${P}.status.running`) },
    已完成: { text: t(`${P}.status.completed`) },
    已取消: { text: t(`${P}.status.cancelled`) },
  };
}

export function resolveMaintenancePlanListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: planned_start_date, date_end: planned_end_date } = parseSalesReportDateRange(s, [
    'planned_start_date_range',
    'plannedStartDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    plan_type: typeof s.plan_type === 'string' && s.plan_type ? s.plan_type : undefined,
    maintenance_type: typeof s.maintenance_type === 'string' && s.maintenance_type ? s.maintenance_type : undefined,
    planned_start_date,
    planned_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export const MAINTENANCE_EXECUTION_PINNED_STATUS_FIELD = 'status';

export function buildMaintenanceExecutionStatusValueEnum(): Record<string, { text: string }> {
  return {
    草稿: { text: '草稿' },
    已确认: { text: '已确认' },
    已验收: { text: '已验收' },
  };
}

export function buildMaintenanceExecutionResultValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.maintenanceExecution';
  return {
    正常: { text: t(`${P}.result.normal`) },
    异常: { text: t(`${P}.result.abnormal`) },
    待处理: { text: t(`${P}.result.pending`) },
  };
}

export function resolveMaintenanceExecutionListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: execution_start_date, date_end: execution_end_date } = parseSalesReportDateRange(s, [
    'execution_date_range',
    'executionDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    execution_result: typeof s.execution_result === 'string' && s.execution_result ? s.execution_result : undefined,
    execution_start_date,
    execution_end_date,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export const APPROVAL_DOC_PINNED_STATUS_FIELD = 'status';

export function buildApprovalDocStatusValueEnum(): Record<string, { text: string }> {
  return {
    草稿: { text: '草稿' },
    已提交: { text: '已提交' },
    已审核: { text: '已审核' },
    已驳回: { text: '已驳回' },
  };
}

export function resolveApprovalDocListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { docDateRangeKeys?: [string, string]; docDateParamPrefix?: string },
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(s, docDateKeys);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
  if (docStart) {
    params[`${docPrefix}_start_date`] = docStart;
  }
  if (docEnd) {
    params[`${docPrefix}_end_date`] = docEnd;
  }
  return params;
}

export const MASTER_DATA_PINNED_ACTIVE_FIELD = 'is_active';

export type EquipmentLedgerGroupMode = 'nature' | 'active' | 'status' | 'workshop' | 'production_line';

export const EQUIPMENT_LEDGER_GROUP_PINNED_FIELD: Record<EquipmentLedgerGroupMode, string> = {
  nature: 'equipment_nature',
  active: 'is_active',
  status: 'status',
  workshop: 'workshop_id',
  production_line: 'production_line_id',
};

function pickNumber(searchFormValues: Record<string, unknown> | null | undefined, key: string) {
  const v = searchFormValues?.[key];
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function buildActiveStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  return {
    true: { text: t('common.enabled') },
    false: { text: t('common.disabled') },
  };
}

/** 与系统字典 EQUIPMENT_NATURE 项一致，供 pinned tabs / 列表 valueEnum 使用 */
export function buildEquipmentNatureValueEnum(_t: TFunction): Record<string, { text: string }> {
  return {
    通用设备: { text: '通用设备' },
    测量设备: { text: '测量设备' },
    特种设备: { text: '特种设备' },
    其他: { text: '其他' },
  };
}

export function resolveMasterDataListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(s, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(s, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const active = s.is_active;
  const is_active =
    active === true || active === 'true' ? true : active === false || active === 'false' ? false : undefined;

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    is_active,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

export function resolveLedgerListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | number | undefined> {
  const s = searchFormValues ?? {};
  const base = resolveMasterDataListParams(searchFormValues, sort);
  // 高级搜索「设备编号」字段 dataIndex=code，后端用 keyword 模糊匹配 code/name/serial
  const codeKeyword = pickString(s, 'code');
  return {
    ...base,
    keyword: codeKeyword ?? base.keyword,
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    type: typeof s.type === 'string' && s.type ? s.type : undefined,
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
    equipment_nature: typeof s.equipment_nature === 'string' && s.equipment_nature ? s.equipment_nature : undefined,
    workshop_id: pickNumber(s, 'workshop_id'),
    production_line_id: pickNumber(s, 'production_line_id'),
  };
}

export function resolveAssetWorkflowListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { docDateRangeKeys?: [string, string]; docDateParamPrefix?: string },
): Record<string, string | undefined> {
  const s = searchFormValues ?? {};
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(s, docDateKeys);
  const base = resolveMasterDataListParams(searchFormValues, sort);

  const params: Record<string, string | undefined> = {
    order_by: base.order_by as string | undefined,
    keyword: base.keyword as string | undefined,
    status: typeof s.status === 'string' && s.status ? s.status : undefined,
    created_start_date: base.created_start_date as string | undefined,
    created_end_date: base.created_end_date as string | undefined,
    updated_start_date: base.updated_start_date as string | undefined,
    updated_end_date: base.updated_end_date as string | undefined,
  };
  if (docStart) params[`${docPrefix}_start_date`] = docStart;
  if (docEnd) params[`${docPrefix}_end_date`] = docEnd;
  return params;
}

export function resolveReminderListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { dateRangeKeys?: [string, string]; dateParamPrefix?: string },
): Record<string, string | boolean | undefined> {
  const s = searchFormValues ?? {};
  const dateKeys = options?.dateRangeKeys ?? ['reminder_date_range', 'reminderDateRange'];
  const datePrefix = options?.dateParamPrefix ?? 'reminder';
  const { date_start: dateStart, date_end: dateEnd } = parseSalesReportDateRange(s, dateKeys);
  const read = s.is_read;
  const handled = s.is_handled;
  const params: Record<string, string | boolean | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickString(s, 'keyword'),
    reminder_type: typeof s.reminder_type === 'string' && s.reminder_type ? s.reminder_type : undefined,
    is_read: read === true || read === 'true' ? true : read === false || read === 'false' ? false : undefined,
    is_handled:
      handled === true || handled === 'true' ? true : handled === false || handled === 'false' ? false : undefined,
  };
  if (dateStart) params[`${datePrefix}_start_date`] = dateStart;
  if (dateEnd) params[`${datePrefix}_end_date`] = dateEnd;
  return params;
}
