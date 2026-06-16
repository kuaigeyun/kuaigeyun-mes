import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import {
  getGlobalLifecycleStageLabelKeys,
  translateLifecycleStageByKey,
  type LifecycleTranslateFn,
} from '../../../utils/globalLifecycleI18n';

export type { LifecycleTranslateFn };

/** 按 SubStage.key 翻译生命周期展示文案（覆盖后端/兜底中文 label） */
export function applyLifecycleI18n(
  result: LifecycleResult,
  t: LifecycleTranslateFn,
  stageLabelKeysByKey: Record<string, string> = {},
  nextStepKeysByStageKey?: Record<string, string[]>,
): LifecycleResult {
  const mergedKeys = { ...getGlobalLifecycleStageLabelKeys(), ...stageLabelKeysByKey };

  const translateStage = (stage: SubStage): SubStage => {
    const i18nKey = mergedKeys[stage.key];
    const label = i18nKey
      ? t(i18nKey)
      : translateLifecycleStageByKey(t, stage.key, stage.label);
    return { ...stage, label: label || stage.label };
  };

  const mainStages = result.mainStages?.map(translateStage);
  const subStages = result.subStages?.map(translateStage);

  const activeKey =
    mainStages?.find((s) => s.status === 'active')?.key ??
    result.mainStages?.find((s) => s.status === 'active')?.key;

  const terminalKey = (() => {
    if (activeKey) return activeKey;
    const stages = mainStages ?? result.mainStages ?? [];
    const done = stages.filter((s) => s.status === 'done');
    if (done.length) return done[done.length - 1]?.key;
    return stages[stages.length - 1]?.key;
  })();

  let stageName = result.stageName;
  if (terminalKey && mergedKeys[terminalKey]) {
    stageName = t(mergedKeys[terminalKey]);
  } else if (stageName) {
    stageName = translateLifecycleStageByKey(t, terminalKey, stageName);
  }

  let nextStepSuggestions = result.nextStepSuggestions;
  const suggestionKey = activeKey ?? terminalKey;
  if (suggestionKey && nextStepKeysByStageKey?.[suggestionKey]?.length) {
    nextStepSuggestions = nextStepKeysByStageKey[suggestionKey].map((key) => t(key));
  }

  return {
    ...result,
    stageName,
    mainStages,
    subStages,
    nextStepSuggestions,
  };
}
