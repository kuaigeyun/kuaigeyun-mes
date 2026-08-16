import type { Data } from '@measured/puck';
import type { OaFormFieldOption, OaFormFieldSchema, OaFormFieldType } from '../utils/oaFormSchema';
import {
  EMPTY_OA_FORM_PUCK_DATA,
  OA_FORM_COMPONENT_TO_TYPE,
  OA_FORM_TYPE_TO_COMPONENT,
  ensureOaFormPuckNodeIds,
  isOaFormPuckData,
  type OaFormPuckComponent,
} from './types';

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

function normalizeOptions(raw: unknown): OaFormFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((opt) => {
      if (!opt || typeof opt !== 'object') return null;
      const o = opt as Record<string, unknown>;
      const value = String(o.value ?? '').trim();
      const label = String(o.label ?? value).trim();
      if (!value) return null;
      return { label: label || value, value };
    })
    .filter(Boolean) as OaFormFieldOption[];
  return options.length ? options : undefined;
}

function parseSpan(raw: unknown, fieldType: OaFormFieldType): 12 | 24 {
  if (raw === 24 || raw === '24') return 24;
  if (raw === 12 || raw === '12') return 12;
  return fieldType === 'textarea' || fieldType === 'file' ? 24 : 12;
}

function parseRequired(raw: unknown): boolean {
  return raw === true || raw === 'on' || raw === 'true';
}

function walkPuckNodes(data: Data): Array<{ type: string; props: Record<string, unknown> }> {
  const nodes: Array<{ type: string; props: Record<string, unknown> }> = [];
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const node = item as { type?: string; props?: Record<string, unknown> };
    if (typeof node.type === 'string') {
      nodes.push({ type: node.type, props: node.props && typeof node.props === 'object' ? node.props : {} });
    }
  };
  if (Array.isArray(data.content)) {
    data.content.forEach(visit);
  }
  if (data.zones && typeof data.zones === 'object') {
    Object.values(data.zones).forEach((zone) => {
      if (Array.isArray(zone)) zone.forEach(visit);
    });
  }
  return nodes;
}

export function collectOaFormFieldDrafts(raw: unknown): Array<{ name: string; label: string }> {
  if (isOaFormPuckData(raw)) {
    return walkPuckNodes(raw)
      .filter((node) => node.type in OA_FORM_COMPONENT_TO_TYPE)
      .map((node) => ({
        name: String(node.props.name ?? '').trim(),
        label: String(node.props.label ?? '').trim(),
      }));
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== 'object') return { name: '', label: '' };
    const row = item as Record<string, unknown>;
    return {
      name: String(row.name ?? '').trim(),
      label: String(row.label ?? '').trim(),
    };
  });
}

export function puckDataToFields(data: Data): OaFormFieldSchema[] {
  const result: OaFormFieldSchema[] = [];
  const seen = new Set<string>();
  for (const node of walkPuckNodes(data)) {
    const fieldType = OA_FORM_COMPONENT_TO_TYPE[node.type as OaFormPuckComponent];
    if (!fieldType) continue;
    const name = String(node.props.name ?? '').trim();
    const label = String(node.props.label ?? '').trim();
    if (!name || !label || seen.has(name)) continue;
    seen.add(name);
    const schema: OaFormFieldSchema = {
      name,
      label,
      type: fieldType,
      required: parseRequired(node.props.required),
      span: parseSpan(node.props.span, fieldType),
    };
    if (fieldType === 'select') {
      schema.options = normalizeOptions(node.props.options) ?? [];
    }
    result.push(schema);
  }
  return result;
}

export function fieldsToPuckData(fields: OaFormFieldSchema[]): Data {
  const content = fields.map((field) => {
    const type = OA_FORM_TYPE_TO_COMPONENT[field.type];
    const span = parseSpan(field.span, field.type);
    return {
      type,
      props: {
        name: field.name,
        label: field.label,
        required: field.required ? 'on' : 'off',
        span: String(span),
        ...(field.type === 'select' ? { options: field.options ?? [] } : {}),
      },
    };
  });
  return ensureOaFormPuckNodeIds({
    content,
    root: { props: {} },
  } as Data);
}

export function oaFormPuckDraftHasIncomplete(raw: unknown): boolean {
  const drafts = collectOaFormFieldDrafts(raw);
  if (!drafts.length) return false;
  return drafts.some((field) => !field.name || !field.label);
}

export function oaFormPuckDraftHasDuplicateName(raw: unknown): boolean {
  const names = collectOaFormFieldDrafts(raw)
    .map((field) => field.name)
    .filter(Boolean);
  return new Set(names).size !== names.length;
}

export function fieldsSchemaToPuckData(raw: unknown): Data {
  if (isOaFormPuckData(raw)) {
    return ensureOaFormPuckNodeIds(raw);
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return EMPTY_OA_FORM_PUCK_DATA;
  }
  const fields: OaFormFieldSchema[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type ?? 'text') as OaFormFieldType;
    if (!FIELD_TYPES.includes(type)) continue;
    fields.push({
      name: String(row.name ?? ''),
      label: String(row.label ?? ''),
      type,
      required: Boolean(row.required),
      span: parseSpan(row.span, type),
      options: type === 'select' ? normalizeOptions(row.options) : undefined,
    });
  }
  return fieldsToPuckData(fields);
}
