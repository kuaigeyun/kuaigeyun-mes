/** 轻办公自定义审批申请字段 schema（存于 form_templates.fields_schema） */

export type OaFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'switch'
  | 'select'
  | 'user'
  | 'department'
  | 'file';

export type OaFormFieldOption = {
  label: string;
  value: string;
};

export type OaFormFieldSchema = {
  name: string;
  label: string;
  type: OaFormFieldType;
  required?: boolean;
  options?: OaFormFieldOption[];
  span?: 12 | 24;
};

const FIELD_TYPES: OaFormFieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'switch',
  'select',
  'user',
  'department',
  'file',
];

function parseSpan(raw: unknown, fieldType: OaFormFieldType): 12 | 24 | undefined {
  if (raw === 24 || raw === '24') return 24;
  if (raw === 12 || raw === '12') return 12;
  if (fieldType === 'textarea' || fieldType === 'file') return 24;
  return undefined;
}

export function normalizeFieldsSchema(raw: unknown): OaFormFieldSchema[] {
  if (!Array.isArray(raw)) return [];
  const result: OaFormFieldSchema[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? '').trim();
    const label = String(row.label ?? '').trim();
    const type = String(row.type ?? 'text') as OaFormFieldType;
    if (!name || !label) continue;
    if (!FIELD_TYPES.includes(type)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    const schema: OaFormFieldSchema = {
      name,
      label,
      type,
      required: Boolean(row.required),
    };
    const span = parseSpan(row.span, type);
    if (span) schema.span = span;
    if (type === 'select' && Array.isArray(row.options)) {
      schema.options = row.options
        .map((opt) => {
          if (!opt || typeof opt !== 'object') return null;
          const o = opt as Record<string, unknown>;
          const value = String(o.value ?? '').trim();
          const optLabel = String(o.label ?? value).trim();
          if (!value) return null;
          return { label: optLabel, value };
        })
        .filter(Boolean) as OaFormFieldOption[];
    }
    result.push(schema);
  }
  return result;
}
