import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';

export type LifecycleTranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** 按 SubStage.key 翻译生命周期展示文案（覆盖后端/兜底中文 label） */
export function applyLifecycleI18n(
  result: LifecycleResult,
  t: LifecycleTranslateFn,
  stageLabelKeysByKey: Record<string, string>,
  nextStepKeysByStageKey?: Record<string, string[]>,
): LifecycleResult {
  const translateStage = (stage: SubStage): SubStage => ({
    ...stage,
    label: stageLabelKeysByKey[stage.key] ? t(stageLabelKeysByKey[stage.key]) : stage.label,
  });

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
  if (terminalKey && stageLabelKeysByKey[terminalKey]) {
    stageName = t(stageLabelKeysByKey[terminalKey]);
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
