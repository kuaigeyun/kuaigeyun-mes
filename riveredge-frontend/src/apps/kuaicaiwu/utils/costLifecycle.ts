/**
 * 成本管理：核算台账生命周期（草稿 → 已核算 → 已审核）
 */
import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import {
  applyLifecycleI18n,
  type LifecycleTranslateFn,
} from '../../kuaizhizao/utils/lifecycleI18n';

const P = 'app.kuaicaiwu.costCalculation.lifecycle';

const STAGE_LABEL_KEYS: Record<string, string> = {
  draft: `${P}.draft`,
  calc: `${P}.calculated`,
  audit: `${P}.audited`,
};

const STATUS_TO_STAGE_KEY: Record<string, string> = {
  草稿: 'draft',
  已核算: 'calc',
  已审核: 'audit',
};

export function getCostCalculationLifecycle(
  record: Record<string, unknown>,
  t?: LifecycleTranslateFn,
): LifecycleResult {
  const s = String(record.calculation_status ?? '');
  const subStages: SubStage[] = [
    { key: 'draft', label: '草稿', status: 'pending' },
    { key: 'calc', label: '已核算', status: 'pending' },
    { key: 'audit', label: '已审核', status: 'pending' },
  ];

  let result: LifecycleResult;

  if (s === '已审核') {
    subStages[0].status = 'done';
    subStages[1].status = 'done';
    subStages[2].status = 'done';
    result = { percent: 100, stageName: '已审核', status: 'success', subStages };
  } else if (s === '已核算') {
    subStages[0].status = 'done';
    subStages[1].status = 'active';
    subStages[2].status = 'pending';
    result = { percent: 66, stageName: '已核算', status: 'normal', subStages };
  } else {
    subStages[0].status = 'active';
    result = {
      percent: 33,
      stageName: s === '草稿' ? '草稿' : s || '草稿',
      status: 'normal',
      subStages,
    };
  }

  if (t) {
    result = applyLifecycleI18n(result, t, STAGE_LABEL_KEYS);
    const stageKey = STATUS_TO_STAGE_KEY[s];
    if (stageKey && STAGE_LABEL_KEYS[stageKey]) {
      result = { ...result, stageName: t(STAGE_LABEL_KEYS[stageKey]) };
    }
  }

  return result;
}
