/**
 * 关联对象 / 关联属性展示方式
 *
 * - 关联对象：XLOOKUP（有源字段）或下拉选记录（无源字段）
 * - 关联属性：数据字典（从他表列取可选值）
 */

export type AssociatedDisplayMode = 'select' | 'multiselect' | 'radio' | 'display' | 'input' | 'number';

export const ASSOCIATED_DISPLAY_MODES: AssociatedDisplayMode[] = [
  'select',
  'multiselect',
  'radio',
  'display',
  'input',
  'number',
];

type AssociatedFieldType = 'associated_object' | 'associated_attribute';

export function resolveAssociatedDisplayMode(
  fieldType: AssociatedFieldType,
  config?: Record<string, unknown>,
): AssociatedDisplayMode {
  const explicit = config?.displayMode;
  if (typeof explicit === 'string' && ASSOCIATED_DISPLAY_MODES.includes(explicit as AssociatedDisplayMode)) {
    return explicit as AssociatedDisplayMode;
  }

  if (fieldType === 'associated_object') {
    return config?.sourceField ? 'input' : 'select';
  }
  return 'select';
}

export function getAssociatedDisplayModeOptions(
  fieldType: AssociatedFieldType,
  hasSourceField: boolean,
): AssociatedDisplayMode[] {
  if (fieldType === 'associated_attribute') {
    return ['select', 'multiselect', 'radio'];
  }
  return hasSourceField ? ['display', 'input', 'number'] : ['select', 'multiselect', 'radio'];
}

export function isAssociatedMultiselectMode(
  fieldType: AssociatedFieldType,
  config?: Record<string, unknown>,
): boolean {
  return resolveAssociatedDisplayMode(fieldType, config) === 'multiselect';
}

export function isAssociatedRadioMode(
  fieldType: AssociatedFieldType,
  config?: Record<string, unknown>,
): boolean {
  return resolveAssociatedDisplayMode(fieldType, config) === 'radio';
}

export function normalizeAssociatedMultiselectValue(value: unknown): Array<string | number> {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && String(item).trim() !== '') as Array<string | number>;
  }
  if (value == null || value === '') {
    return [];
  }
  return [value as string | number];
}

export function formatAssociatedDetailValue(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join('、');
  }
  return String(value);
}

export function getAssociatedDisplayModeDefault(
  fieldType: AssociatedFieldType,
  hasSourceField: boolean,
): AssociatedDisplayMode {
  return getAssociatedDisplayModeOptions(fieldType, hasSourceField)[0];
}
