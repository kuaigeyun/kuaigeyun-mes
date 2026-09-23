/**
 * 业务数值输入上限（与后端 core.utils.decimal_limits DECIMAL(18,4) 对齐）。
 * InputNumber 使用 JS number，上限取不超过安全整数范围的最大值。
 */
import type { InputNumberProps } from 'antd';
import type { Rule } from 'antd/es/form';
import type { NumericPrecisionKind } from '../services/businessConfig';

/** 与后端 (18,4) 一致的整数位上限在 JS 下不可全量表示；FE 使用 13 位整数 + 4 位小数 */
export const NUMERIC_INPUT_ABS_MAX = 9_999_999_999_999.9999;

export type NumericFieldKind = NumericPrecisionKind;

export function getNumericAbsMax(_kind: NumericFieldKind = 'quantity'): number {
  return NUMERIC_INPUT_ABS_MAX;
}

/** InputNumber 通用 props：min/max/precision */
export function buildNumericInputNumberProps(
  kind: NumericFieldKind,
  precision: number,
  overrides?: Partial<InputNumberProps>,
): InputNumberProps {
  return {
    min: 0,
    max: getNumericAbsMax(kind),
    precision,
    style: { width: '100%' },
    ...overrides,
  };
}

/** Form.Item rules：必填 + 下限 + 上限 */
export function buildNumericFormRules(
  kind: NumericFieldKind,
  t: (key: string, values?: Record<string, unknown>) => string,
  options?: {
    required?: boolean;
    min?: number;
    minMessage?: string;
    requiredMessage?: string;
  },
): Rule[] {
  const max = getNumericAbsMax(kind);
  const rules: Rule[] = [];
  if (options?.required) {
    rules.push({
      required: true,
      message: options.requiredMessage || t('common.required'),
    });
  }
  if (options?.min != null) {
    rules.push({
      type: 'number',
      min: options.min,
      message: options.minMessage || t('common.numericValueTooSmall'),
    });
  }
  rules.push({
    type: 'number',
    max,
    message: t('common.numericValueTooLarge'),
  });
  return rules;
}
