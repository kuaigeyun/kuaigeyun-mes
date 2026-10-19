import type { TFunction } from 'i18next';
import {
  extractProTableSort,
  extractReportProTableSort,
  pickListSearchKeyword,
  pickSearchString,
  pickSearchTriStateBoolean,
} from '../../../utils/tableQueryKey';
import { parseSalesReportDateRange } from '../services/reports';

export const EQUIPMENT_OPS_PINNED_STATUS_FIELD = 'status';

/** 设备运维单据/追溯表状态徽章色（Ant Tag color） */
const EQUIPMENT_OPS_STATUS_TAG_COLORS: Record<string, string> = {
  已完成: 'success',
  已修复: 'success',
  已审核: 'success',
  已批准: 'success',
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

function resolveOrderBy(sort?: Record<string, unknown>) {
  const { sortBy, sortOrder } = extractProTableSort(sort ?? {});
  return sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
}

export function buildSpotCheckStatusValueEnum(_t: TFunction): Record<string, { text: string }> {
  return {
    待执行: { text: '待执行' },
    待审核: { text: '待审核' },
    已审核: { text: '已审核' },
    已驳回: { text: '已驳回' },
    已取消: { text: '已取消' },
  };
}

export function buildRoutePatrolStatusValueEnum(t: TFunction): Record<string, { text: string }> {
  const P = 'app.kuaizhizao.equipmentOps.routePatrol';
  return {
    已完成: { text: t(`${P}.status.completed`) },
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
  const { date_start: check_start_date, date_end: check_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'check_date_range',
    'checkDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const has_abnormality = pickSearchTriStateBoolean(searchFormValues, 'has_abnormality');

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
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
  const { date_start: patrol_start_date, date_end: patrol_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'patrol_date_range',
    'patrolDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const has_abnormality = pickSearchTriStateBoolean(searchFormValues, 'has_abnormality');

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
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
  const { date_start: fault_start_date, date_end: fault_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'fault_date_range',
    'faultDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    fault_type: pickSearchString(searchFormValues, 'fault_type'),
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
  const { date_start: repair_start_date, date_end: repair_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'repair_date_range',
    'repairDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
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

export type MaintenancePlanEquipmentItem = {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
};

export function resolveMaintenancePlanEquipmentUuids(plan: {
  equipment_uuids?: string[];
  equipment_uuid?: string;
  equipment_items?: MaintenancePlanEquipmentItem[];
}): string[] {
  if (Array.isArray(plan.equipment_uuids) && plan.equipment_uuids.length > 0) {
    return plan.equipment_uuids.filter(Boolean);
  }
  if (Array.isArray(plan.equipment_items) && plan.equipment_items.length > 0) {
    return plan.equipment_items.map((item) => item.uuid).filter(Boolean) as string[];
  }
  return plan.equipment_uuid ? [plan.equipment_uuid] : [];
}

export function formatMaintenancePlanEquipmentText(
  plan: {
    bound_equipment_count?: number;
    equipment_name?: string;
    equipment_code?: string;
    equipment_items?: MaintenancePlanEquipmentItem[];
  },
  boundLabel?: (n: number) => string,
): string {
  if (typeof plan.bound_equipment_count === 'number' && boundLabel) {
    return boundLabel(plan.bound_equipment_count);
  }
  const items = plan.equipment_items;
  if (items?.length) {
    if (boundLabel) {
      return boundLabel(items.length);
    }
    return items
      .map((item) => {
        const code = item.code?.trim();
        const name = item.name?.trim() || '-';
        return code ? `${code} - ${name}` : name;
      })
      .join('、');
  }
  if (typeof plan.bound_equipment_count === 'number') {
    return String(plan.bound_equipment_count);
  }
  const code = plan.equipment_code?.trim();
  const name = plan.equipment_name?.trim() || '-';
  return code ? `${code} - ${name}` : name;
}

export function resolveMaintenancePlanListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | undefined> {
  const { date_start: planned_start_date, date_end: planned_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'planned_start_date_range',
    'plannedStartDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    plan_type: pickSearchString(searchFormValues, 'plan_type'),
    maintenance_type: pickSearchString(searchFormValues, 'maintenance_type'),
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
  const { date_start: execution_start_date, date_end: execution_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'execution_date_range',
    'executionDateRange',
  ]);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
    execution_result: pickSearchString(searchFormValues, 'execution_result'),
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
    已批准: { text: '已批准' },
    已驳回: { text: '已驳回' },
  };
}

export function resolveApprovalDocListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { docDateRangeKeys?: [string, string]; docDateParamPrefix?: string },
): Record<string, string | undefined> {
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(searchFormValues ?? {}, docDateKeys);
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);

  const params: Record<string, string | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    status: pickSearchString(searchFormValues, 'status'),
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
  const raw = pickSearchString(searchFormValues, key);
  if (raw == null) return undefined;
  const n = Number(raw);
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

/** 设备台账排除「测量设备」（该性质走计量器具台账），避免钉住页签筛出空列表 */
export function buildEquipmentLedgerNatureValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(buildEquipmentNatureValueEnum(t)).filter(([k]) => k !== '测量设备'),
  );
}

export const DEFAULT_EQUIPMENT_LEDGER_NATURE = '通用设备';

export function resolveMasterDataListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const { date_start: created_start_date, date_end: created_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'created_at_range',
    'createdAtRange',
  ]);
  const { date_start: updated_start_date, date_end: updated_end_date } = parseSalesReportDateRange(searchFormValues ?? {}, [
    'updated_at_range',
    'updatedAtRange',
  ]);
  const is_active = pickSearchTriStateBoolean(searchFormValues, 'is_active');

  return {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    is_active,
    created_start_date,
    created_end_date,
    updated_start_date,
    updated_end_date,
  };
}

/** 设备/模具/工装/计量器具台账默认排序：创建时间倒序（新建在上） */
export const LEDGER_DEFAULT_ORDER_BY = '-created_at';

function resolveLedgerOrderBy(sort?: Record<string, unknown>): string {
  const { sortBy, sortOrder } = extractReportProTableSort(sort ?? {});
  if (sortBy && sortOrder) {
    return sortOrder === 'desc' ? `-${sortBy}` : sortBy;
  }
  return LEDGER_DEFAULT_ORDER_BY;
}

export function resolveLedgerListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
): Record<string, string | boolean | number | undefined> {
  const base = resolveMasterDataListParams(searchFormValues, sort);
  // 高级搜索「设备编号」字段 dataIndex=code，后端用 keyword 模糊匹配 code/name/serial
  const codeKeyword = pickSearchString(searchFormValues, 'code');
  return {
    ...base,
    // 台账未点列头时固定创建时间倒序；禁止 extractProTableSort 无 sort 对象时误注入缺省
    order_by: resolveLedgerOrderBy(sort),
    keyword: codeKeyword ?? base.keyword,
    status: pickSearchString(searchFormValues, 'status'),
    type: pickSearchString(searchFormValues, 'type'),
    category: pickSearchString(searchFormValues, 'category'),
    equipment_nature: pickSearchString(searchFormValues, 'equipment_nature'),
    workshop_id: pickNumber(searchFormValues, 'workshop_id'),
    production_line_id: pickNumber(searchFormValues, 'production_line_id'),
  };
}

export function resolveAssetWorkflowListParams(
  searchFormValues?: Record<string, unknown> | null,
  sort?: Record<string, unknown>,
  options?: { docDateRangeKeys?: [string, string]; docDateParamPrefix?: string },
): Record<string, string | undefined> {
  const docDateKeys = options?.docDateRangeKeys ?? ['doc_date_range', 'docDateRange'];
  const docPrefix = options?.docDateParamPrefix ?? 'doc';
  const { date_start: docStart, date_end: docEnd } = parseSalesReportDateRange(searchFormValues ?? {}, docDateKeys);
  const base = resolveMasterDataListParams(searchFormValues, sort);

  const params: Record<string, string | undefined> = {
    order_by: base.order_by as string | undefined,
    keyword: base.keyword as string | undefined,
    status: pickSearchString(searchFormValues, 'status'),
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
  const dateKeys = options?.dateRangeKeys ?? ['reminder_date_range', 'reminderDateRange'];
  const datePrefix = options?.dateParamPrefix ?? 'reminder';
  const { date_start: dateStart, date_end: dateEnd } = parseSalesReportDateRange(searchFormValues ?? {}, dateKeys);
  const params: Record<string, string | boolean | undefined> = {
    order_by: resolveOrderBy(sort),
    keyword: pickListSearchKeyword(searchFormValues),
    reminder_type: pickSearchString(searchFormValues, 'reminder_type'),
    is_read: pickSearchTriStateBoolean(searchFormValues, 'is_read'),
    is_handled: pickSearchTriStateBoolean(searchFormValues, 'is_handled'),
  };
  if (dateStart) params[`${datePrefix}_start_date`] = dateStart;
  if (dateEnd) params[`${datePrefix}_end_date`] = dateEnd;
  return params;
}
