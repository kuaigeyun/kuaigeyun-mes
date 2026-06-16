import type { TFunction } from 'i18next';

import {
  PRESET_ENTITY_CODE_SETS,
  PRESET_OPERATION_UNIQUE_NAME_TO_KEY,
  type PresetEntityKind,
} from './generated/presetEntityRegistry';

function translateOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

export function presetEntityKey(entity: PresetEntityKind, code: string, field: 'name' | 'desc'): string {
  return `preset.${entity}.${code}.${field}`;
}

export function isPresetEntityCode(entity: PresetEntityKind, code: string | undefined | null): boolean {
  if (!code) return false;
  return PRESET_ENTITY_CODE_SETS[entity].has(code);
}

function resolvePresetField(
  entity: PresetEntityKind,
  code: string | undefined,
  field: 'name' | 'desc',
  fallback: string,
  t: TFunction,
): string {
  if (!code || !isPresetEntityCode(entity, code)) return fallback;
  return translateOrFallback(t, presetEntityKey(entity, code, field), fallback);
}

export function resolvePresetDepartmentName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('department', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetPositionName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('position', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetRoleName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('role', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetRoleDescription(
  record: { code?: string; description?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('role', record.code, 'desc', record.description ?? '', t);
}

/** 编辑表单展示：预设实体用 i18n 解析名称（及角色描述） */
export function localizedPresetFormFields(
  entity: PresetEntityKind,
  record: { code?: string; name?: string | null; description?: string | null },
  t: TFunction,
): { name: string; description?: string } {
  const name =
    entity === 'department'
      ? resolvePresetDepartmentName(record, t)
      : entity === 'position'
        ? resolvePresetPositionName(record, t)
        : resolvePresetRoleName(record, t);
  const fields: { name: string; description?: string } = { name };
  if (entity === 'role') {
    fields.description = resolvePresetRoleDescription(record, t);
  }
  return fields;
}

/** 保存预设实体时勿将界面译文写回库（名称/描述仍以 code + 翻译模块为准） */
export function omitPresetLocalizedPayloadFields(
  entity: PresetEntityKind,
  code: string | undefined | null,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPresetEntityCode(entity, code)) return values;
  const next = { ...values };
  delete next.name;
  if (entity === 'role') {
    delete next.description;
  }
  return next;
}

export function resolvePresetApprovalProcessName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('approvalProcess', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetApprovalProcessDescription(
  record: { code?: string; description?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('approvalProcess', record.code, 'desc', record.description ?? '', t);
}

export function resolvePresetMessageTemplateName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('messageTemplate', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetMessageTemplateDescription(
  record: { code?: string; description?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('messageTemplate', record.code, 'desc', record.description ?? '', t);
}

export function resolvePresetPrintTemplateName(
  record: { code?: string; name?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('printTemplate', record.code, 'name', record.name ?? '', t);
}

export function resolvePresetPrintTemplateDescription(
  record: { code?: string; description?: string | null },
  t: TFunction,
): string {
  return resolvePresetField('printTemplate', record.code, 'desc', record.description ?? '', t);
}

export function resolvePresetOperationIndustryName(
  industryId: string | undefined,
  fallback: string,
  t: TFunction,
): string {
  return resolvePresetField('operationIndustry', industryId, 'name', fallback, t);
}

export function resolvePresetOperationIndustryDescription(
  industryId: string | undefined,
  fallback: string,
  t: TFunction,
): string {
  return resolvePresetField('operationIndustry', industryId, 'desc', fallback, t);
}

export function resolvePresetOperationNameByKey(
  presetKey: string | undefined,
  fallback: string,
  t: TFunction,
): string {
  return resolvePresetField('operation', presetKey, 'name', fallback, t);
}

/** 已加载工序（无 preset_key）：仅当名称在预设目录中唯一时可解析 */
export function resolvePresetOperationNameByName(
  name: string | undefined,
  t: TFunction,
): string {
  const raw = name ?? '';
  if (!raw) return raw;
  const presetKey = PRESET_OPERATION_UNIQUE_NAME_TO_KEY[raw];
  if (!presetKey) return raw;
  return resolvePresetOperationNameByKey(presetKey, raw, t);
}

export function resolvePresetOperationDefectName(
  code: string | undefined,
  fallback: string,
  t: TFunction,
): string {
  return resolvePresetField('operationDefect', code, 'name', fallback, t);
}
