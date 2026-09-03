/**
 * 现场补料生命周期：待处理→备料中→(部分送达)→已完成 / 已取消
 * 后端状态：pending / processing / partial / completed / cancelled
 *
 * 注意：pending 不可走全局 documentStatus.pending（=待审核），须用模块专用 labelKey。
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import { parseBackendLifecycle, type BackendLifecycle } from './backendLifecycle';
import { applyLifecycleI18n, type LifecycleTranslateFn } from './lifecycleI18n';

const STAGE_DEFS = [
  { key: 'pending', label: '待处理', labelKey: 'app.kuaizhizao.materialCall.lifecycle.pending' },
  { key: 'processing', label: '备料中', labelKey: 'app.kuaizhizao.materialCall.lifecycle.processing' },
  { key: 'partial', label: '部分送达', labelKey: 'app.kuaizhizao.materialCall.lifecycle.partial' },
  { key: 'completed', label: '已完成', labelKey: 'app.kuaizhizao.materialCall.lifecycle.completed' },
  { key: 'cancelled', label: '已取消', labelKey: 'app.kuaizhizao.materialCall.lifecycle.cancelled' },
] as const;

const STAGE_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  STAGE_DEFS.map((d) => [d.key, d.labelKey]),
);

const STATUS_TO_KEY: Record<string, string> = {
  pending: 'pending',
  processing: 'processing',
  partial: 'partial',
  completed: 'completed',
  cancelled: 'cancelled',
  picking: 'processing',
};

const EXCEPTION_KEYS = new Set(['cancelled']);
const SUCCESS_KEYS = new Set(['completed']);

function resolveStatusKey(record: Record<string, unknown>): string {
  let status = String(record.status ?? '').trim();
  if (status === 'picking') status = 'processing';
  return STATUS_TO_KEY[status] ?? STATUS_TO_KEY[status.toLowerCase()] ?? '';
}

function lifecycleFromStatus(record: Record<string, unknown>, t: LifecycleTranslateFn): LifecycleResult {
  const key = resolveStatusKey(record);
  const stageIndex = STAGE_DEFS.findIndex((d) => d.key === key);
  const mainStages = STAGE_DEFS.map((d, i) => {
    let status: 'done' | 'active' | 'pending' = 'pending';
    if (stageIndex < 0) {
      status = 'pending';
    } else if (EXCEPTION_KEYS.has(key)) {
      status = d.key === key ? 'active' : i < stageIndex ? 'done' : 'pending';
    } else if (SUCCESS_KEYS.has(key)) {
      status = i <= stageIndex ? 'done' : 'pending';
    } else if (i < stageIndex) {
      status = 'done';
    } else if (i === stageIndex) {
      status = 'active';
    }
    return { key: d.key, label: d.label, status };
  });
  const percent =
    stageIndex >= 0 ? Math.round(((stageIndex + 1) / STAGE_DEFS.length) * 100) : 0;
  let status: LifecycleResult['status'] = 'active';
  if (EXCEPTION_KEYS.has(key)) status = 'exception';
  else if (SUCCESS_KEYS.has(key)) status = 'success';

  const stageDef = STAGE_DEFS.find((d) => d.key === key);
  return applyLifecycleI18n(
    {
      percent,
      stageName: stageDef?.label ?? (String(record.status ?? '').trim() || '-'),
      status,
      mainStages,
      currentStageKey: key || undefined,
    },
    t,
    STAGE_LABEL_KEYS,
    {},
  );
}

export function getMaterialCallLifecycle(
  record: Record<string, unknown> | null | undefined,
  t: LifecycleTranslateFn,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = record.lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) {
    return applyLifecycleI18n(parseBackendLifecycle(backend), t, STAGE_LABEL_KEYS, {});
  }
  return lifecycleFromStatus(record, t);
}
