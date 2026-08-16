import type { Data } from '@measured/puck';
import type { OaFormFieldType } from '../utils/oaFormSchema';

export const OA_FORM_PUCK_COMPONENTS = [
  'OaText',
  'OaTextarea',
  'OaNumber',
  'OaDate',
  'OaDatetime',
  'OaSwitch',
  'OaSelect',
  'OaUser',
  'OaDepartment',
  'OaFile',
] as const;

export type OaFormPuckComponent = (typeof OA_FORM_PUCK_COMPONENTS)[number];

export const OA_FORM_COMPONENT_TO_TYPE: Record<OaFormPuckComponent, OaFormFieldType> = {
  OaText: 'text',
  OaTextarea: 'textarea',
  OaNumber: 'number',
  OaDate: 'date',
  OaDatetime: 'datetime',
  OaSwitch: 'switch',
  OaSelect: 'select',
  OaUser: 'user',
  OaDepartment: 'department',
  OaFile: 'file',
};

export const OA_FORM_TYPE_TO_COMPONENT: Record<OaFormFieldType, OaFormPuckComponent> = {
  text: 'OaText',
  textarea: 'OaTextarea',
  number: 'OaNumber',
  date: 'OaDate',
  datetime: 'OaDatetime',
  switch: 'OaSwitch',
  select: 'OaSelect',
  user: 'OaUser',
  department: 'OaDepartment',
  file: 'OaFile',
};

export const EMPTY_OA_FORM_PUCK_DATA: Data = {
  content: [],
  root: { props: {} },
};

type PuckLikeNode = {
  type?: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
};

function newPuckId(type: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${type}-${uuid}`;
}

function ensureNodeIds(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(ensureNodeIds);
  }
  if (!node || typeof node !== 'object') {
    return node;
  }
  const n = node as PuckLikeNode;
  const next: PuckLikeNode = { ...n };
  const props = { ...(n.props || {}) };
  if (typeof n.type === 'string' && n.type && !props.id) {
    props.id = newPuckId(n.type);
  }
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value)) {
      props[key] = value.map(ensureNodeIds);
    }
  }
  next.props = props;
  if ('id' in next && next.type) {
    delete next.id;
  }
  return next;
}

export function ensureOaFormPuckNodeIds(data: Data): Data {
  const content = Array.isArray(data.content) ? data.content.map(ensureNodeIds) : data.content;
  let zones = data.zones;
  if (zones && typeof zones === 'object') {
    const next: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(zones)) {
      next[k] = Array.isArray(v) ? (v.map(ensureNodeIds) as unknown[]) : (v as unknown[]);
    }
    zones = next;
  }
  const root = data.root ? (ensureNodeIds(data.root) as Data['root']) : data.root;
  return { ...data, content, zones, root } as Data;
}

export function isOaFormPuckData(raw: unknown): raw is Data {
  return Boolean(raw && typeof raw === 'object' && Array.isArray((raw as Data).content));
}

export function normalizeOaFormPuckData(raw: unknown): Data {
  if (isOaFormPuckData(raw)) {
    return ensureOaFormPuckNodeIds(raw);
  }
  return EMPTY_OA_FORM_PUCK_DATA;
}
