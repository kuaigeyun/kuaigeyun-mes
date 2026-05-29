/**
 * 研发项目生命周期（列表 Tab / 阶段展示）
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from '../../kuaicaiwu/utils/backendLifecycle';
import { parseBackendLifecycle } from '../../kuaicaiwu/utils/backendLifecycle';
import {
  LIST_LIFECYCLE_STAGE_FIELD,
  resolveListLifecycleStageFromSearch,
  toListLifecycleStageApiParams,
} from '../../../utils/listLifecycleStage';

export const RD_PROJECT_STAGE_LABELS = ['全部', '草稿', '进行中', '已暂停', '已结案', '已取消'] as const;
export type RdProjectStageLabel = (typeof RD_PROJECT_STAGE_LABELS)[number];

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

export function buildRdProjectLifecycleValueEnum(): Record<string, { text: string; status?: string }> {
  const map: Record<string, { text: string; status?: string }> = {};
  RD_PROJECT_STAGE_LABELS.filter((s) => s !== '全部').forEach((label) => {
    map[label] = {
      text: label,
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

export function getRdProjectLifecycle(record: Record<string, unknown> | null | undefined): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = record.lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);

  const status = String(record.status ?? '').trim();
  const stageName = STATUS_TO_STAGE[status] ?? (status || '草稿');
  const keys = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const labels = ['草稿', '进行中', '已暂停', '已结案', '已取消'];
  const idx = labels.indexOf(stageName);
  const activeIdx = idx >= 0 ? idx : 0;
  const mainStages = labels.map((label, i) => ({
    key: keys[i],
    label,
    status: (i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending') as 'done' | 'active' | 'pending',
  }));
  const percent = Math.round(((activeIdx + 1) / labels.length) * 100);
  return {
    percent,
    stageName,
    status: stageName === '已结案' ? 'success' : stageName === '已取消' ? 'exception' : 'normal',
    mainStages,
  };
}

export { LIST_LIFECYCLE_STAGE_FIELD };
