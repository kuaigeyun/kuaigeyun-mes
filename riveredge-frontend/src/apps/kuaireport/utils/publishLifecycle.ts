/**
 * 快报表：看板/报表发布状态 → UniLifecycle（草稿 → 已发布）
 */
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';

export function getPublishDraftLifecycle(record: Record<string, unknown>): LifecycleResult {
  const s = String(record.status ?? '');
  const subStages: SubStage[] = [
    { key: 'draft', label: '草稿', status: 'pending' },
    { key: 'published', label: '已发布', status: 'pending' },
  ];

  if (s === 'PUBLISHED') {
    subStages[0].status = 'done';
    subStages[1].status = 'done';
    return { percent: 100, stageName: '已发布', status: 'success', subStages };
  }
  subStages[0].status = 'active';
  subStages[1].status = 'pending';
  return { percent: 50, stageName: '草稿', status: 'normal', subStages };
}
