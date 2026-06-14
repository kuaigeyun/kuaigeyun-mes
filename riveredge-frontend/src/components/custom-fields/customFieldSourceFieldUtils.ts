/**
 * 自定义字段源字段（系统 / 自定义）解析工具
 */

export type CustomFieldSourceScope = 'custom' | 'system';

const CUSTOM_PREFIX = 'custom_';

export function encodeSourceFieldKey(scope: CustomFieldSourceScope, name: string): string {
  return `${scope}:${name}`;
}

export function parseSourceFieldKey(
  value?: string | null,
): { scope: CustomFieldSourceScope; name: string } | null {
  if (!value) return null;
  const idx = value.indexOf(':');
  if (idx <= 0) {
    return { scope: 'custom', name: value };
  }
  const scope = value.slice(0, idx) as CustomFieldSourceScope;
  const name = value.slice(idx + 1);
  if ((scope !== 'custom' && scope !== 'system') || !name) {
    return { scope: 'custom', name: value };
  }
  return { scope, name };
}

export function resolveSourceFormFieldName(
  sourceField?: string,
  sourceFieldType?: CustomFieldSourceScope,
): string | null {
  if (!sourceField) return null;
  const scope = sourceFieldType || 'custom';
  return scope === 'system' ? sourceField : `${CUSTOM_PREFIX}${sourceField}`;
}

export function buildSourceFieldKeyFromConfig(config?: {
  sourceField?: string;
  sourceFieldType?: CustomFieldSourceScope;
}): string | undefined {
  if (!config?.sourceField) return undefined;
  return encodeSourceFieldKey(config.sourceFieldType || 'custom', config.sourceField);
}

export function buildLinkFieldKeyFromConfig(config?: {
  linkField?: string;
  linkFieldType?: CustomFieldSourceScope;
}): string | undefined {
  if (!config?.linkField) return undefined;
  return encodeSourceFieldKey(config.linkFieldType || 'custom', config.linkField);
}

export function resolveLinkFormFieldName(
  linkField?: string,
  linkFieldType?: CustomFieldSourceScope,
): string | null {
  return resolveSourceFormFieldName(linkField, linkFieldType);
}
