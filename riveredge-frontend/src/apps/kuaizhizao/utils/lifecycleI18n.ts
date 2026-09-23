import type { LifecycleResult, SubStage } from '../../../components/uni-lifecycle/types';
import {
  getGlobalLifecycleStageLabelKeys,
  LIFECYCLE_ZH_LABEL_TO_KEY,
  resolveLifecycleStageI18nKey,
  translateLifecycleStageByKey,
  type LifecycleTranslateFn,
} from '../../../utils/globalLifecycleI18n';

export type { LifecycleTranslateFn };

const TERMINAL_EXCEPTION_STAGE_NAMES = new Set([
  '已关闭',
  '已取消',
  '已驳回',
  'closed',
  'cancelled',
  'rejected',
]);

/** 禁止兜底：翻译缺失或与 key 相同时直接抛错 */
export function requireI18nText(t: LifecycleTranslateFn, key: string): string {
  const text = t(key);
  if (!text || text === key) {
    throw new Error(`Missing i18n label for key: ${key}`);
  }
  return text;
}

function resolveStageLabelKey(
  stage: SubStage,
  mergedKeys: Record<string, string>,
): string {
  const moduleKey = mergedKeys[stage.key];
  if (moduleKey) return moduleKey;
  const globalKey = resolveLifecycleStageI18nKey(stage.key);
  if (globalKey) return globalKey;
  throw new Error(`Missing lifecycle stage i18n key for stage.key=${stage.key}`);
}

/** 按 SubStage.key 翻译生命周期展示文案（禁止回退后端/硬编码 label） */
export function applyLifecycleI18n(
  result: LifecycleResult,
  t: LifecycleTranslateFn,
  stageLabelKeysByKey: Record<string, string> = {},
  nextStepKeysByStageKey: Record<string, string[]> = {},
): LifecycleResult {
  const mergedKeys = { ...getGlobalLifecycleStageLabelKeys(), ...stageLabelKeysByKey };

  const translateStage = (stage: SubStage): SubStage => ({
    ...stage,
    label: requireI18nText(t, resolveStageLabelKey(stage, mergedKeys)),
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
    // 模式 A 预生效：主轴全 pending、后端 stageName 为 — 时，禁止用末节点冒充当前阶段
    return undefined;
  })();

  const backendStageName = (result.stageName ?? '').trim();
  const isPreEffective =
    !backendStageName || backendStageName === '-' || backendStageName === '—';
  /** 终态异常（已关闭/已取消等）：禁止用主轴末节点 completed 盖成「已完成」 */
  const isTerminalException =
    result.status === 'exception' || TERMINAL_EXCEPTION_STAGE_NAMES.has(backendStageName);

  let stageName = result.stageName;
  if (isPreEffective) {
    stageName = backendStageName || '—';
  } else if (isTerminalException && backendStageName) {
    const mappedKey = LIFECYCLE_ZH_LABEL_TO_KEY[backendStageName] ?? backendStageName;
    if (mergedKeys[mappedKey]) {
      stageName = requireI18nText(t, mergedKeys[mappedKey]!);
    } else {
      stageName = translateLifecycleStageByKey(t, mappedKey, backendStageName);
    }
  } else if (terminalKey && mergedKeys[terminalKey]) {
    stageName = requireI18nText(t, mergedKeys[terminalKey]!);
  } else if (terminalKey) {
    const globalKey = resolveLifecycleStageI18nKey(terminalKey);
    if (globalKey) {
      stageName = requireI18nText(t, globalKey);
    } else {
      throw new Error(`Missing lifecycle stageName i18n key for terminalKey=${terminalKey}`);
    }
  }

  const suggestionKey = activeKey ?? terminalKey;
  const nextStepSuggestions =
    suggestionKey && nextStepKeysByStageKey[suggestionKey]?.length
      ? nextStepKeysByStageKey[suggestionKey]!.map((key) => requireI18nText(t, key))
      : [];

  return {
    ...result,
    stageName,
    mainStages,
    subStages,
    nextStepSuggestions,
  };
}
