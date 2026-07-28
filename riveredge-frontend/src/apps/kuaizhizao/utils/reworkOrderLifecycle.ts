/**
 * 返工单生命周期：草稿→已下达→执行中→待复检→质量放行→已关闭
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

const REWORK_ORDER_STAGE_KEYS = new Set([
  'draft',
  'released',
  'in_progress',
  'pending_verification',
  'quality_released',
  'closed',
  'cancelled',
  'on_hold',
]);

function isReworkOrderLifecycle(backend: BackendLifecycle): boolean {
  const stages = backend?.main_stages ?? [];
  if (stages.length === 0) return false;
  const keys = new Set(stages.map((s) => s.key));
  return [...keys].some((k) => REWORK_ORDER_STAGE_KEYS.has(k));
}

const STATUS_TO_KEY: Record<string, string> = {
  draft: 'draft',
  released: 'released',
  in_progress: 'in_progress',
  pending_verification: 'pending_verification',
  quality_released: 'quality_released',
  closed: 'closed',
  cancelled: 'cancelled',
  on_hold: 'on_hold',
  completed: 'closed',
  草稿: 'draft',
  已下达: 'released',
  执行中: 'in_progress',
  待复检: 'pending_verification',
  质量放行: 'quality_released',
  已关闭: 'closed',
  已完成: 'closed',
  已取消: 'cancelled',
  已暂停: 'on_hold',
};

const NORMAL_ORDER = [
  'draft',
  'released',
  'in_progress',
  'pending_verification',
  'quality_released',
  'closed',
];

const LABELS: Record<string, string> = {
  draft: '草稿',
  released: '已下达',
  in_progress: '执行中',
  pending_verification: '待复检',
  quality_released: '质量放行',
  closed: '已关闭',
  cancelled: '已取消',
  on_hold: '已暂停',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = (record?.status ?? '') as string;
  const key = status ? (STATUS_TO_KEY[status] ?? STATUS_TO_KEY[status.toLowerCase()] ?? 'draft') : 'draft';
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'released', label: '已下达' },
    { key: 'in_progress', label: '执行中' },
    { key: 'pending_verification', label: '待复检' },
    { key: 'quality_released', label: '质量放行' },
    { key: 'closed', label: '已关闭' },
    { key: 'cancelled', label: '已取消' },
    { key: 'on_hold', label: '已暂停' },
  ];
  const mainStages = stageDefs.map((s) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (key === 'cancelled') {
      st = s.key === 'cancelled' ? 'active' : 'pending';
    } else if (key === 'on_hold') {
      st = s.key === 'in_progress' ? 'active' : s.key === 'draft' || s.key === 'released' ? 'done' : 'pending';
    } else {
      const idx = NORMAL_ORDER.indexOf(s.key);
      const curIdx = NORMAL_ORDER.indexOf(key);
      if (s.key === key) st = 'active';
      else if (idx >= 0 && curIdx >= 0 && idx < curIdx) st = 'done';
    }
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    current_stage_name: LABELS[key] ?? '-',
    status:
      key === 'cancelled'
        ? 'exception'
        : key === 'closed' || key === 'quality_released'
          ? 'success'
          : key === 'in_progress' || key === 'released'
            ? 'active'
            : 'normal',
    main_stages: mainStages,
    next_step_suggestions:
      key === 'draft'
        ? ['下达']
        : key === 'released' || key === 'in_progress'
          ? ['报工', '下一工序', '申请完修']
          : key === 'pending_verification'
            ? ['复检', '质量放行']
            : key === 'quality_released'
              ? ['关闭']
              : [],
  };
}

export interface ReworkOrderLike {
  status?: string;
  lifecycle?: unknown;
  capabilities?: Record<string, { allowed?: boolean; reason?: string }>;
}

export function getReworkOrderLifecycle(
  record: ReworkOrderLike | Record<string, unknown> | null | undefined,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record?.lifecycle ?? (record as Record<string, unknown>).lifecycle) as
    | BackendLifecycle
    | undefined;
  if (backend?.main_stages?.length && isReworkOrderLifecycle(backend)) {
    return parseBackendLifecycle(backend);
  }
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}

const REWORK_ORDER_LIFECYCLE_KEYS = [
  'draft',
  'released',
  'in_progress',
  'pending_verification',
  'quality_released',
  'closed',
  'cancelled',
  'on_hold',
] as const;

const REWORK_ORDER_LIFECYCLE_I18N: Record<string, string> = {
  draft: 'app.kuaizhizao.reworkOrder.lifecycleDraft',
  released: 'app.kuaizhizao.reworkOrder.lifecycleReleased',
  in_progress: 'app.kuaizhizao.reworkOrder.lifecycleInProgress',
  pending_verification: 'app.kuaizhizao.reworkOrder.lifecyclePendingVerification',
  quality_released: 'app.kuaizhizao.reworkOrder.lifecycleQualityReleased',
  closed: 'app.kuaizhizao.reworkOrder.lifecycleClosed',
  cancelled: 'app.kuaizhizao.reworkOrder.lifecycleCancelled',
  on_hold: 'app.kuaizhizao.reworkOrder.lifecycleOnHold',
};

export function buildReworkOrderLifecycleValueEnum(
  t: (key: string) => string,
): Record<string, { text: string; status?: 'Default' | 'Processing' | 'Success' | 'Error' }> {
  const statusByKey: Record<string, 'Default' | 'Processing' | 'Success' | 'Error'> = {
    draft: 'Default',
    released: 'Processing',
    in_progress: 'Processing',
    pending_verification: 'Processing',
    quality_released: 'Processing',
    closed: 'Success',
    cancelled: 'Error',
    on_hold: 'Default',
  };
  return Object.fromEntries(
    REWORK_ORDER_LIFECYCLE_KEYS.map((key) => [
      key,
      {
        text: REWORK_ORDER_LIFECYCLE_I18N[key]
          ? t(REWORK_ORDER_LIFECYCLE_I18N[key]!)
          : LABELS[key] ?? key,
        status: statusByKey[key],
      },
    ]),
  );
}

export function resolveReworkOrderListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
): { status?: string } {
  const raw = searchFormValues?.status ?? searchFormValues?.lifecycle_stage;
  if (raw == null || String(raw).trim() === '') return {};
  const status = String(raw).trim();
  if (REWORK_ORDER_LIFECYCLE_KEYS.includes(status as (typeof REWORK_ORDER_LIFECYCLE_KEYS)[number])) {
    return { status };
  }
  return {};
}

export function reworkCapabilityAllowed(
  record: ReworkOrderLike | null | undefined,
  action: string,
): boolean {
  return record?.capabilities?.[action]?.allowed === true;
}
