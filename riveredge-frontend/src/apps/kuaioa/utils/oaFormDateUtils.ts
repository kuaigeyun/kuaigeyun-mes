import dayjs, { type Dayjs } from 'dayjs';
import type { KuaioaFieldConfig } from '../components/KuaioaCrudListPage';
import { extractUploadFileUuids, normalizeCustomFieldFileUuids } from '../../../components/custom-fields/customFieldFileUtils';

export function computeInclusiveCalendarDays(start: unknown, end: unknown): number | null {
  if (start == null || end == null || start === '' || end === '') return null;
  const s = dayjs.isDayjs(start) ? start : dayjs(String(start));
  const e = dayjs.isDayjs(end) ? end : dayjs(String(end));
  if (!s.isValid() || !e.isValid()) return null;
  return e.startOf('day').diff(s.startOf('day'), 'day') + 1;
}

export function mapOaRecordToFormValues(
  fields: KuaioaFieldConfig[],
  record: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const raw = record[field.name];
    if (field.type === 'date' || field.type === 'datetime') {
      values[field.name] = raw ? dayjs(String(raw)) : undefined;
    }
  }
  return values;
}

function serializeFileFieldValue(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    const uuids = normalizeCustomFieldFileUuids(raw);
    return uuids[0] ?? null;
  }
  if (Array.isArray(raw)) {
    const uuids = extractUploadFileUuids(raw);
    return uuids[0] ?? null;
  }
  return null;
}

export function mapOaFormValuesToPayload(
  fields: KuaioaFieldConfig[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...values };
  for (const field of fields) {
    const raw = values[field.name];
    if (field.type === 'date' || field.type === 'datetime') {
      if (raw == null || raw === '') {
        payload[field.name] = null;
      } else if (dayjs.isDayjs(raw)) {
        payload[field.name] = (raw as Dayjs).format(
          field.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss',
        );
      }
      continue;
    }
    if (field.type === 'file') {
      payload[field.name] = serializeFileFieldValue(raw);
    }
  }
  return payload;
}
