/**
 * 入库管理生命周期：草稿→已确认/待退料→已退料（生产退料）/已完成（采购/成品）
 */

import type { LifecycleResult } from '../../../components/uni-lifecycle/types';
import type { BackendLifecycle } from './backendLifecycle';
import { parseBackendLifecycle } from './backendLifecycle';

function norm(s: string | undefined): string {
  return (s ?? '').trim();
}

const STATUS_TO_STAGE: Record<string, string> = {
  草稿: '草稿',
  draft: '草稿',
  DRAFT: '草稿',
  待入库: '待入库',
  已确认: '已确认',
  已完成: '已完成',
  completed: '已完成',
  COMPLETED: '已完成',
  /** 采购/成品入库确认后后端状态 */
  已入库: '已入库',
  已取消: '已取消',
  待退料: '待退料',
  已退料: '已退料',
};

function buildFallbackLifecycle(record: Record<string, unknown>): BackendLifecycle {
  const status = norm(record?.status as string);
  const stageName = (STATUS_TO_STAGE[status] ?? status) || '草稿';
  const keyMap: Record<string, string> = {
    草稿: 'draft',
    待入库: 'pending_inbound',
    已确认: 'confirmed',
    已完成: 'completed',
    已入库: 'completed',
    已取消: 'cancelled',
    待退料: 'pending_return',
    已退料: 'returned',
  };
  const key = keyMap[stageName] ?? 'draft';
  const stageDefs = [
    { key: 'draft', label: '草稿' },
    { key: 'confirmed', label: '已确认' },
    { key: 'completed', label: '已完成' },
  ];
  const stageToIdx: Record<string, number> = {
    草稿: 0,
    待入库: 1,
    已确认: 1,
    已完成: 2,
    已入库: 2,
    已取消: 0,
    待退料: 1,
    已退料: 2,
  };
  const curIdx = stageToIdx[stageName] ?? 0;
  const isException = stageName === '已取消';
  const isDone = stageName === '已完成' || stageName === '已退料' || stageName === '已入库';
  const mainStages = stageDefs.map((s, idx) => {
    let st: 'done' | 'active' | 'pending' = 'pending';
    if (isException) st = 'pending';
    else if (idx < curIdx) st = 'done';
    else if (idx === curIdx) st = 'active';
    return { key: s.key, label: s.label, status: st };
  });
  return {
    current_stage_key: key,
    /** 列表接口常不带 lifecycle，需与后端采购入库「已入库」语义一致 */
    current_stage_name: stageName === '已入库' ? '已入库' : stageName,
    status: isException ? 'exception' : isDone ? 'success' : 'normal',
    main_stages: mainStages,
    next_step_suggestions: ['草稿', '待入库'].includes(stageName)
      ? ['确认']
      : ['已确认', '待退料'].includes(stageName)
        ? ['完成']
        : [],
  };
}

export function getInboundLifecycle(
  record: Record<string, unknown> | null | undefined
): LifecycleResult {
  if (!record) return { percent: 0, stageName: '-', mainStages: [] };
  const backend = (record as Record<string, unknown>).lifecycle as BackendLifecycle | undefined;
  if (backend?.main_stages?.length) return parseBackendLifecycle(backend);
  return parseBackendLifecycle(buildFallbackLifecycle(record as Record<string, unknown>));
}
