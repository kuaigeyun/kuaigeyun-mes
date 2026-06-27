/**
 * 工单生命周期：优先使用后端下发的 record.lifecycle，无则前端兜底。
 * 根据 record.status 映射到 mainStages，供 UniLifecycleStepper 展示。
 */

import dayjs from 'dayjs';
import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { WorkOrder } from '../types/production';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
} from '../../../utils/listLifecycleStage';

export { LIST_LIFECYCLE_STAGE_FIELD };

/** 工单生命周期阶段键（筛选 valueEnum / API 映射唯一键） */
export const WORK_ORDER_LIFECYCLE_STAGE_KEYS = [
  'draft',
  'released',
  'in_progress',
  'completed',
  'cancelled',
  'split',
] as const;

export type WorkOrderLifecycleStageKey = (typeof WORK_ORDER_LIFECYCLE_STAGE_KEYS)[number];

const WORK_ORDER_LIFECYCLE_I18N_KEYS: Record<WorkOrderLifecycleStageKey, string> = {
  draft: 'app.kuaizhizao.workOrder.lifecycleDraft',
  released: 'app.kuaizhizao.workOrder.lifecycleReleased',
  in_progress: 'app.kuaizhizao.workOrder.lifecycleInProgress',
  completed: 'app.kuaizhizao.workOrder.lifecycleCompleted',
  cancelled: 'app.kuaizhizao.workOrder.lifecycleCancelled',
  split: 'app.kuaizhizao.workOrder.lifecycleSplit',
};

/** @deprecated 仅兼容旧 saved search / 钉住条件中的中文阶段名 */
export const WORK_ORDER_STAGE_LABELS = ['草稿', '已下达', '执行中', '已完成', '已取消', '已拆分'] as const;

const WORK_ORDER_LIFECYCLE_STAGE_TO_STATUS: Record<string, string> = {
  draft: 'draft',
  released: 'released',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  split: 'split',
  草稿: 'draft',
  已下达: 'released',
  执行中: 'in_progress',
  已完成: 'completed',
  已取消: 'cancelled',
  已拆分: 'split',
};

/** 工单专用阶段 key 集合（与后端 document_lifecycle_service.WORK_ORDER_MAIN_STAGES 一致） */
const WORK_ORDER_STAGE_KEYS = new Set([
  'draft',
  'released',
  'in_progress',
  'completed',
  'cancelled',
  'split',
]);

function isWorkOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return keys.size === WORK_ORDER_STAGE_KEYS.size && [...keys].every((k) => WORK_ORDER_STAGE_KEYS.has(k));
}

const NORMAL_ORDER = ['draft', 'released', 'in_progress', 'completed'];

/** status 中英文映射到 key */
const STATUS_TO_KEY: Record<string, string> = {
  draft: 'draft',
  released: 'released',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  split: 'split',
  草稿: 'draft',
  已下达: 'released',
  执行中: 'in_progress',
  生产中: 'in_progress',
  已完成: 'completed',
  已取消: 'cancelled',
  已拆分: 'split',
};

/** 前端兜底：根据 status 构建 BackendLifecycle */
function buildFallbackLifecycle(record: WorkOrder | Record<string, unknown>): BackendLifecycle {
  const status = (record?.status ?? (record as Record<string, unknown>).status) as string | undefined;
  const key = status ? (STATUS_TO_KEY[status] ?? 'draft') : 'draft';
  const labels: Record<string, string> = {
    draft: '草稿',
    released: '已下达',
    in_progress: '执行中',
    completed: '已完成',
    cancelled: '已取消',
    split: '已拆分',
  };
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'released', label: '已下达' },
    { key: 'in_progress', label: '执行中' },
    { key: 'completed', label: '已完成' },
    { key: 'cancelled', label: '已取消' },
    { key: 'split', label: '已拆分' },
  ];
  const terminalKeys = new Set(['cancelled', 'split']);
  const mainStages = stageDefs.map((s) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (terminalKeys.has(key)) {
      st = s.key === key ? 'active' : s.key === 'completed' || NORMAL_ORDER.indexOf(s.key) >= 0 ? 'done' : 'pending';
    } else {
      const idx = NORMAL_ORDER.indexOf(s.key);
      const curIdx = NORMAL_ORDER.indexOf(key);
      if (s.key === key) st = 'active';
      else if (idx >= 0 && curIdx >= 0 && idx < curIdx) st = 'done';
    }
    return { key: s.key, label: s.label, status: st };
  });
  const nextStepSuggestions: Record<string, string[]> = {
    draft: ['下达工单'],
    released: ['开始执行', '状态流转'],
    in_progress: ['报工', '指定结束', '状态流转'],
    completed: [],
    cancelled: [],
    split: [],
  };
  return {
    current_stage_key: key,
    current_stage_name: labels[key] ?? '-',
    status:
      key === 'cancelled'
        ? 'exception'
        : key === 'completed'
          ? 'success'
          : key === 'in_progress'
            ? 'active'
            : 'normal',
    main_stages: mainStages,
    next_step_suggestions: nextStepSuggestions[key] ?? [],
  };
}

/**
 * 根据工单获取生命周期结果，供 UniLifecycleStepper 使用。
 * 优先使用后端下发的 lifecycle；无则前端根据 status 兜底。
 */
export function getWorkOrderLifecycle(
  record: WorkOrder | Record<string, unknown> | { status?: string; lifecycle?: unknown } | null | undefined
): LifecycleResult {
  if (!record) {
    return { percent: 0, stageName: '-', mainStages: [] };
  }
  const rec = record as WorkOrder & { lifecycle?: unknown } & Record<string, unknown>;
  const backend = (rec.lifecycle ?? rec['lifecycle']) as BackendLifecycle | undefined;
  if (backend?.main_stages?.length && isWorkOrderLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record));
}

export function translateWorkOrderLifecycleStatus(
  t: (key: string) => string,
  status?: string | null,
): string {
  if (!status) return '-';
  const key = STATUS_TO_KEY[status];
  if (key && key in WORK_ORDER_LIFECYCLE_I18N_KEYS) {
    return t(WORK_ORDER_LIFECYCLE_I18N_KEYS[key as WorkOrderLifecycleStageKey]);
  }
  return status;
}

export function buildWorkOrderLifecycleValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning' }> {
  const statusByStage: Record<WorkOrderLifecycleStageKey, 'Default' | 'Processing' | 'Error' | 'Success' | 'Warning'> = {
    draft: 'Default',
    released: 'Processing',
    in_progress: 'Processing',
    completed: 'Success',
    cancelled: 'Error',
    split: 'Warning',
  };
  return Object.fromEntries(
    WORK_ORDER_LIFECYCLE_STAGE_KEYS.map((stage) => [
      stage,
      { text: t(WORK_ORDER_LIFECYCLE_I18N_KEYS[stage]), status: statusByStage[stage] },
    ]),
  );
}

/** 列表筛选：lifecycle_stage（中文阶段名）→ API status */
export function resolveWorkOrderListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: [...WORK_ORDER_LIFECYCLE_STAGE_KEYS, ...WORK_ORDER_STAGE_LABELS],
  });
  if (stage && WORK_ORDER_LIFECYCLE_STAGE_TO_STATUS[stage]) {
    return { status: WORK_ORDER_LIFECYCLE_STAGE_TO_STATUS[stage] };
  }
  return {};
}

/** 列表 API status：唯一来源 lifecycle_stage（见 listLifecycleStage 约定） */
export function resolveWorkOrderListStatusFilter(
  searchFormValues?: Record<string, unknown> | null,
): string | undefined {
  return resolveWorkOrderListLifecycleParams(searchFormValues, searchFormValues).status;
}

/** 计划完工日已早于今天，且工单已下达或执行中（与列表「逾期」Tag 口径一致） */
export function isWorkOrderPlannedEndOverdue(
  record: Pick<WorkOrder, 'planned_end_date' | 'status'>,
): boolean {
  return Boolean(
    record.planned_end_date
      && ['released', 'in_progress', '已下达', '执行中'].includes(record.status || '')
      && dayjs(record.planned_end_date).isBefore(dayjs(), 'day'),
  );
}
