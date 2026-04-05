/**
 * 成本管理：核算台账生命周期（草稿 → 已核算 → 已审核）
 */
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';

export function getCostCalculationLifecycle(record: Record<string, unknown>): LifecycleResult {
  const s = String(record.calculation_status ?? '');
  const subStages: SubStage[] = [
    { key: 'draft', label: '草稿', status: 'pending' },
    { key: 'calc', label: '已核算', status: 'pending' },
    { key: 'audit', label: '已审核', status: 'pending' },
  ];

  if (s === '已审核') {
    subStages[0].status = 'done';
    subStages[1].status = 'done';
    subStages[2].status = 'done';
    return { percent: 100, stageName: '已审核', status: 'success', subStages };
  }
  if (s === '已核算') {
    subStages[0].status = 'done';
    subStages[1].status = 'active';
    subStages[2].status = 'pending';
    return { percent: 66, stageName: '已核算', status: 'normal', subStages };
  }
  subStages[0].status = 'active';
  return { percent: 33, stageName: s === '草稿' ? '草稿' : s || '草稿', status: 'normal', subStages };
}
