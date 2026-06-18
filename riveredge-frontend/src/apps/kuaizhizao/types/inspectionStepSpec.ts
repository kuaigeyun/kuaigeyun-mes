import type { TFunction } from 'i18next';

export const INSPECTION_STEP_VALUE_TYPES = [
  'boolean',
  'single_select',
  'multi_select',
  'text',
  'numeric',
] as const;

export type InspectionStepValueType = (typeof INSPECTION_STEP_VALUE_TYPES)[number];

export type InspectionStepValueSpec = Record<string, unknown>;

export interface SamplingSpec {
  sample_size: number;
  accept_num: number;
  reject_num: number;
}

export function normalizeSamplingSpec(raw?: unknown): SamplingSpec {
  const base = { sample_size: 1, accept_num: 0, reject_num: 1 };
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  const out = { ...base };
  for (const key of ['sample_size', 'accept_num', 'reject_num'] as const) {
    if (src[key] == null) continue;
    const n = Number(src[key]);
    if (!Number.isNaN(n)) out[key] = Math.max(0, Math.floor(n));
  }
  if (out.sample_size < 1) out.sample_size = 1;
  return out;
}

export function getSamplingSpec(
  step: Pick<InspectionPlanStepItem, 'value_spec' | 'sampling_type'>,
): SamplingSpec | undefined {
  if (step.sampling_type !== 'sampling') return undefined;
  const nested = step.value_spec?.sampling;
  return normalizeSamplingSpec(nested);
}

export function formatSamplingCriteriaPreview(
  samplingType: string | undefined,
  valueSpec: InspectionStepValueSpec | undefined,
  t?: TFunction,
): string {
  if (samplingType !== 'sampling') return '';
  const s = normalizeSamplingSpec(valueSpec?.sampling);
  if (!t) {
    return `抽检 n=${s.sample_size}，Ac=${s.accept_num}，Re=${s.reject_num}`;
  }
  return t('app.kuaizhizao.quality.plans.stepSpec.samplingCriteria', {
    n: s.sample_size,
    ac: s.accept_num,
    re: s.reject_num,
  });
}

export function applySamplingToValueSpec(
  valueSpec: InspectionStepValueSpec,
  samplingType: 'full' | 'sampling',
  samplingSpec?: SamplingSpec,
): InspectionStepValueSpec {
  const next = { ...valueSpec };
  if (samplingType === 'sampling') {
    next.sampling = normalizeSamplingSpec(samplingSpec ?? next.sampling);
  } else {
    delete next.sampling;
  }
  return next;
}

export interface InspectionPlanStepItem {
  sequence: number;
  step_key?: string;
  inspection_item: string;
  inspection_method?: string;
  acceptance_criteria?: string;
  value_type?: InspectionStepValueType | string;
  value_spec?: InspectionStepValueSpec;
  sampling_type: 'full' | 'sampling';
  quality_standard_id?: number;
  remarks?: string;
}

export type InspectionTemplateStepItem = InspectionPlanStepItem & {
  step_key?: string;
};

export function normalizeValueType(raw?: string | null): InspectionStepValueType {
  const s = (raw || 'boolean').toLowerCase();
  if (INSPECTION_STEP_VALUE_TYPES.includes(s as InspectionStepValueType)) {
    return s as InspectionStepValueType;
  }
  return 'boolean';
}

export function defaultValueSpec(
  valueType: InspectionStepValueType,
  t?: TFunction,
): InspectionStepValueSpec {
  const passLabel = t
    ? t('app.kuaizhizao.quality.common.result.qualified')
    : '合格';
  const failLabel = t
    ? t('app.kuaizhizao.quality.common.result.unqualified')
    : '不合格';

  const base = { required: true, allow_na: false, critical: false, require_photo: false };

  switch (valueType) {
    case 'boolean':
      return { ...base, pass_when: true };
    case 'single_select':
      return {
        ...base,
        options: [
          { value: 'pass', label: passLabel, result: 'pass' },
          { value: 'fail', label: failLabel, result: 'fail' },
        ],
      };
    case 'multi_select':
      return { ...base, options: [], pass_rule: 'no_defect_selected' };
    case 'text':
      return { ...base, multiline: false, max_length: 500, judgment: 'manual' };
    case 'numeric':
      return { ...base, decimal_places: 4, derived: false, formula: '' };
    default:
      return { ...base, pass_when: true };
  }
}

export type StepConductEntry = {
  value?: unknown;
  judgment?: string;
  judgment_source?: string;
  photos?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
};

export function stepSpecAllowsNa(valueSpec?: InspectionStepValueSpec): boolean {
  return valueSpec?.allow_na === true;
}

export function stepSpecIsCritical(valueSpec?: InspectionStepValueSpec): boolean {
  return valueSpec?.critical === true;
}

export function stepSpecRequiresPhoto(valueSpec?: InspectionStepValueSpec): boolean {
  return valueSpec?.require_photo === true;
}

export function stepSpecIsDerived(valueSpec?: InspectionStepValueSpec): boolean {
  return valueSpec?.derived === true;
}

const FORMULA_REF_PATTERN = /\{([^}]+)\}/g;

export function extractFormulaRefs(formula?: string): string[] {
  if (!formula) return [];
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(FORMULA_REF_PATTERN.source, 'g');
  while ((m = re.exec(formula)) !== null) {
    const ref = m[1]?.trim();
    if (ref) refs.push(ref);
  }
  return refs;
}

function safeEvalNumeric(expr: string): number | null {
  const sanitized = expr.replace(/\s+/g, '');
  if (!/^[\d.+\-*/()]+$/.test(sanitized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized})`)();
    const num = Number(result);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

export function evaluateDerivedFormula(
  formula: string | undefined,
  stepResults: Record<string, StepConductEntry> | undefined,
  decimalPlaces = 4,
): number | null {
  if (!formula || !stepResults) return null;
  let expr = formula;
  const refs = extractFormulaRefs(formula);
  for (const ref of refs) {
    const entry = stepResults[ref];
    if (!entry || entry.judgment === 'na') return null;
    const num = Number(entry.value);
    if (Number.isNaN(num)) return null;
    expr = expr.split(`{${ref}}`).join(String(num));
  }
  if (/\{[^}]+\}/.test(expr)) return null;
  const raw = safeEvalNumeric(expr);
  if (raw == null) return null;
  return Number(raw.toFixed(decimalPlaces));
}

export function bumpPlanVersion(version?: string): string {
  const v = (version || '1.0').trim();
  const m = v.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return `${v}.1`;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? 0) + 1;
  return `${major}.${minor}`;
}

export function stepsFingerprint(steps: InspectionPlanStepItem[]): string {
  return JSON.stringify(
    steps.map((s, i) => ({
      sequence: i,
      step_key: s.step_key,
      inspection_item: s.inspection_item,
      value_type: s.value_type,
      value_spec: s.value_spec,
      sampling_type: s.sampling_type,
    })),
  );
}

export function resolveStepJudgmentClient(
  step: InspectionTemplateStepItem,
  entry: StepConductEntry,
): 'pass' | 'fail' | 'na' | null {
  const manual = entry.judgment;
  if (manual === 'pass' || manual === 'fail' || manual === 'na') return manual;
  return judgeStepValueClient(step.value_type || 'boolean', step.value_spec, entry.value);
}

export function formatConductStepValue(
  valueType: string,
  valueSpec: InspectionStepValueSpec | undefined,
  entry: StepConductEntry,
  t: TFunction,
): string {
  if (entry.judgment === 'na') {
    return t('app.kuaizhizao.quality.template.judgmentNa');
  }
  const vt = normalizeValueType(valueType);
  const spec = { ...defaultValueSpec(vt, t), ...(valueSpec || {}) };
  const value = entry.value;
  if (value === undefined || value === null || value === '') return '-';

  if (vt === 'boolean') {
    const actual = value === true || value === 'true' || value === 1;
    return actual
      ? t('app.kuaizhizao.quality.plans.stepSpec.passWhenYes')
      : t('app.kuaizhizao.quality.plans.stepSpec.passWhenNo');
  }
  if (vt === 'single_select') {
    const opts = (spec.options as Array<{ value: string; label: string }>) || [];
    const hit = opts.find((o) => String(o.value) === String(value));
    return hit?.label || String(value);
  }
  if (vt === 'multi_select') {
    const opts = (spec.options as Array<{ value: string; label: string }>) || [];
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      selected.map((v) => opts.find((o) => o.value === v)?.label || v).join('、') || '-'
    );
  }
  return String(value);
}

export interface ConductStepsSummary {
  failCount: number;
  criticalFailCount: number;
  failLabels: string[];
  criticalFailLabels: string[];
}

export function summarizeConductSteps(
  steps: InspectionTemplateStepItem[],
  stepResults: Record<string, StepConductEntry> | undefined,
  itemResults: Record<string, unknown> | undefined,
  t: TFunction,
): ConductStepsSummary {
  const summary: ConductStepsSummary = {
    failCount: 0,
    criticalFailCount: 0,
    failLabels: [],
    criticalFailLabels: [],
  };
  if (!stepResults && !itemResults) return summary;

  steps.forEach((step, idx) => {
    const key = getStepConductKey(step, idx);
    const spec = { ...defaultValueSpec(normalizeValueType(step.value_type), t), ...(step.value_spec || {}) };
    const label = step.inspection_item || t('app.kuaizhizao.quality.template.inspectionItemFallback', { index: idx + 1 });

    let judgment: 'pass' | 'fail' | 'na' | null = null;
    if (step.value_type) {
      const entry = stepResults?.[key];
      if (entry) judgment = resolveStepJudgmentClient(step, entry);
    } else {
      const legacy = itemResults?.[key] ?? itemResults?.[String(idx)];
      if (legacy === 'pass' || legacy === 'fail') judgment = legacy;
    }

    if (judgment === 'fail') {
      summary.failCount += 1;
      summary.failLabels.push(label);
      if (stepSpecIsCritical(spec)) {
        summary.criticalFailCount += 1;
        summary.criticalFailLabels.push(label);
      }
    }
  });
  return summary;
}

export function getStepConductKey(step: InspectionTemplateStepItem, index: number): string {
  return step.step_key || String(index);
}

export function judgeStepValueClient(
  valueType: string,
  valueSpec: InspectionStepValueSpec | undefined,
  value: unknown,
): 'pass' | 'fail' | null {
  const vt = normalizeValueType(valueType);
  const spec = { ...defaultValueSpec(vt), ...(valueSpec || {}) };

  if (value === undefined || value === null || value === '') {
    if (vt === 'multi_select' && Array.isArray(value) && value.length === 0) return null;
    if (vt !== 'multi_select') return null;
  }

  if (vt === 'boolean') {
    const actual = value === true || value === 'true' || value === 1;
    const passWhen = spec.pass_when !== false;
    return actual === passWhen ? 'pass' : 'fail';
  }

  if (vt === 'single_select') {
    const opts = (spec.options as Array<{ value: string; result?: string }>) || [];
    const hit = opts.find((o) => String(o.value) === String(value));
    if (!hit) return null;
    return hit.result === 'fail' ? 'fail' : 'pass';
  }

  if (vt === 'multi_select') {
    const selected = new Set((Array.isArray(value) ? value : []).map(String));
    const defectValues = new Set(
      ((spec.options as Array<{ value: string; defect?: boolean }>) || [])
        .filter((o) => o.defect)
        .map((o) => String(o.value)),
    );
    for (const v of selected) {
      if (defectValues.has(v)) return 'fail';
    }
    return 'pass';
  }

  if (vt === 'numeric') {
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    const lo = spec.lower_limit as number | undefined;
    const hi = spec.upper_limit as number | undefined;
    if (lo != null && num < lo) return 'fail';
    if (hi != null && num > hi) return 'fail';
    if (lo == null && hi == null) return null;
    return 'pass';
  }

  return null;
}

export function formatAcceptanceCriteriaPreview(
  valueType: string,
  valueSpec?: InspectionStepValueSpec,
  t?: TFunction,
): string {
  const vt = normalizeValueType(valueType);
  const spec = { ...defaultValueSpec(vt, t), ...(valueSpec || {}) };
  const unit = spec.unit ? ` ${spec.unit}` : '';

  if (vt === 'boolean') {
    if (!t) {
      return spec.pass_when === false ? '合格：否' : '合格：是';
    }
    return spec.pass_when === false
      ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaPassWhenNo')
      : t('app.kuaizhizao.quality.plans.stepSpec.criteriaPassWhenYes');
  }

  if (vt === 'numeric') {
    if (spec.derived && spec.formula) {
      return t
        ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaDerived', { formula: spec.formula })
        : `派生：${spec.formula}`;
    }
    const lo = spec.lower_limit as number | undefined;
    const hi = spec.upper_limit as number | undefined;
    if (lo != null && hi != null) {
      return t
        ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaRange', { lo, hi, unit })
        : `${lo} ~ ${hi}${unit}`;
    }
    if (lo != null) {
      return t
        ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaGte', { lo, unit })
        : `≥ ${lo}${unit}`;
    }
    if (hi != null) {
      return t
        ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaLte', { hi, unit })
        : `≤ ${hi}${unit}`;
    }
    if (spec.target != null) {
      return t
        ? t('app.kuaizhizao.quality.plans.stepSpec.criteriaTarget', { target: spec.target, unit })
        : `目标 ${spec.target}${unit}`;
    }
    return '';
  }

  if (vt === 'text' || vt === 'multi_select') return '';
  return '';
}
