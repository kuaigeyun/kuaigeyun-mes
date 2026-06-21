/**
 * UniTabs 表单标签（/new、/create、/:id/edit）的 keep-alive 由 TabRouteCache 负责。
 * 本模块为仓库 pull-entry 等非 `/new` 路由提供进程内表单快照（与 useRecordFormDraft 配合）。
 */
import dayjs from 'dayjs';
import { coerceFormDate } from './formDate';
import { normalizeFormListItems } from './formListItems';

type DraftValue = Record<string, unknown>;

const inMemoryDraftStore = new Map<string, DraftValue>();

/** 草稿内 dayjs 的序列化标记（避免 structuredClone 破坏原型导致 DatePicker isValid 报错） */
const DRAFT_DAYJS = '__draftDayjs';

function isBrokenDayjsLike(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || dayjs.isDayjs(value)) return false;
  const obj = value as Record<string, unknown>;
  return '$d' in obj || (typeof obj.$y === 'number' && typeof obj.$M === 'number');
}

function looksLikeDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

function serializeDraftValue(value: unknown): unknown {
  if (dayjs.isDayjs(value)) {
    const iso = value.toISOString();
    return { [DRAFT_DAYJS]: iso };
  }
  if (isBrokenDayjsLike(value)) {
    const healed = coerceFormDate((value as Record<string, unknown>).$d);
    if (healed) return { [DRAFT_DAYJS]: healed.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(serializeDraftValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDraftValue(v);
    }
    return out;
  }
  return value;
}

function deserializeDraftValue(value: unknown): unknown {
  if (looksLikeDateString(value)) {
    return coerceFormDate(value);
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj[DRAFT_DAYJS] === 'string') {
      return coerceFormDate(obj[DRAFT_DAYJS]);
    }
    if (isBrokenDayjsLike(obj)) {
      return coerceFormDate(obj.$d);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserializeDraftValue(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(deserializeDraftValue);
  }
  return value;
}

export function buildDocumentCreateDraftKey(
  resourceKey: string,
  pathname: string,
  search?: string,
): string {
  const params = new URLSearchParams(search || '');
  params.delete('_refresh');
  const cleanSearch = params.toString();
  const routeKey = cleanSearch ? `${pathname}?${cleanSearch}` : pathname;
  return `doc-create-draft:${resourceKey}:${routeKey}`;
}

export function setDocumentFormDraft(key: string, value: DraftValue): void {
  if (!key) return;
  inMemoryDraftStore.set(key, serializeDraftValue(value) as DraftValue);
}

/** Form.List 明细在草稿中可能是 {0:row,1:row}，恢复为数组以便 setFieldsValue 正确重建行。 */
function hydrateFormListFields(value: DraftValue): DraftValue {
  const out: DraftValue = { ...value };
  for (const [field, raw] of Object.entries(out)) {
    if (field === 'items' || field.endsWith('_items') || field.endsWith('Items')) {
      out[field] = normalizeFormListItems(deserializeDraftValue(raw));
    }
  }
  return out;
}

export function getDocumentFormDraft<T extends DraftValue>(key: string): T | null {
  if (!key) return null;
  const value = inMemoryDraftStore.get(key);
  if (!value) return null;
  const deserialized = deserializeDraftValue(value) as DraftValue;
  return hydrateFormListFields(deserialized) as T;
}

export function clearDocumentFormDraft(key: string): void {
  if (!key) return;
  inMemoryDraftStore.delete(key);
}
