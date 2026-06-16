/**
 * 研发项目生命周期（列表 Tab / 阶段展示）
 */

import type { TFunction } from 'i18next';
import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from '../../kuaicaiwu/utils/backendLifecycle';
import { parseBackendLifecycle } from '../../kuaicaiwu/utils/backendLifecycle';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';
import { getKuaiplmProjectLifecycleStageLabels } from '../components/kuaiplmMeta';

export const RD_PROJECT_STAGE_LABELS = ['全部', '草稿', '进行中', '已暂停', '已结案', '已取消'] as const;
export type RdProjectStageLabel = (typeof RD_PROJECT_STAGE_LABELS)[number];

const INTERNAL_STAGE_LABELS = ['草稿', '进行中', '已暂停', '已结案', '已取消'] as const;

const STATUS_TO_STAGE: Record<string, string> = {
  DRAFT: '草稿',
  IN_PROGRESS: '进行中',
  ON_HOLD: '已暂停',
  COMPLETED: '已结案',
  CANCELLED: '已取消',
  草稿: '草稿',
  进行中: '进行中',
  已暂停: '已暂停',
  已结案: '已结案',
  已取消: '已取消',
};

export function buildRdProjectLifecycleValueEnum(
  t?: TFunction,
): Record<string, { text: string; status?: string }> {
  const displayLabels = t ? getKuaiplmProjectLifecycleStageLabels(t) : [...INTERNAL_STAGE_LABELS];
  const map: Record<string, { text: string; status?: string }> = {};
  INTERNAL_STAGE_LABELS.forEach((label, i) => {
    map[label] = {
      text: displayLabels[i] ?? label,
      status: label === '已结案' ? 'Success' : label === '已取消' ? 'Default' : 'Processing',
    };
  });
  return map;
}

const STAGE_TO_STATUS: Record<string, string> = {
  草稿: 'DRAFT',
  进行中: 'IN_PROGRESS',
  已暂停: 'ON_HOLD',
  已结案: 'COMPLETED',
  已取消: 'CANCELLED',
};

export function resolveRdProjectListLifecycleParams(
  searchFormValues?: Record<string, unknown> | null,
  params?: Record<string, unknown> | null,
): { status?: string } {
  const stage = resolveListLifecycleStageFromSearch(searchFormValues, params, {
    allowedStages: RD_PROJECT_STAGE_LABELS.filter((s) => s !== '全部'),
  });
  const api = toListLifecycleStageApiParams(stage);
  if (!api.lifecycle_stage) return {};
  return { status: STAGE_TO_STATUS[api.lifecycle_stage] ?? api.lifecycle_stage };
}

export function getRdProjectLifecycle(
  record: Record<string, unknown> | null | undefined,
  t?: TFunction,
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = record.lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);

  const status = String(record.status ?? '').trim();
  const internalStageName = STATUS_TO_STAGE[status] ?? (status || '草稿');
  const displayLabels = t ? getKuaiplmProjectLifecycleStageLabels(t) : [...INTERNAL_STAGE_LABELS];
  const keys = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const idx = INTERNAL_STAGE_LABELS.indexOf(internalStageName as (typeof INTERNAL_STAGE_LABELS)[number]);
  const activeIdx = idx >= 0 ? idx : 0;
  const stageName = idx >= 0 ? displayLabels[idx] : internalStageName;
  const mainStages = INTERNAL_STAGE_LABELS.map((internalLabel, i) => ({
    key: keys[i],
    label: displayLabels[i] ?? internalLabel,
    status: (i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending') as
      | 'done'
      | 'active'
      | 'pending',
  }));
  const percent = Math.round(((activeIdx + 1) / INTERNAL_STAGE_LABELS.length) * 100);
  return {
    percent,
    stageName,
    status:
      internalStageName === '已结案'
        ? 'success'
        : internalStageName === '已取消'
          ? 'exception'
          : 'normal',
    mainStages,
  };
}

export { LIST_LIFECYCLE_STAGE_FIELD };
