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
    if (
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'month' ||
      field.type === 'year'
    ) {
      if (raw == null || raw === '') {
        values[field.name] = undefined;
      } else if (field.type === 'year') {
        const y = String(raw).trim();
        values[field.name] = dayjs(y.length === 4 ? `${y}-01-01` : y);
      } else {
        values[field.name] = dayjs(String(raw));
      }
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
    if (
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'month' ||
      field.type === 'year'
    ) {
      if (raw == null || raw === '') {
        payload[field.name] = null;
      } else if (dayjs.isDayjs(raw)) {
        const format =
          field.type === 'year'
            ? 'YYYY'
            : field.type === 'month'
              ? 'YYYY-MM'
              : field.type === 'date'
                ? 'YYYY-MM-DD'
                : 'YYYY-MM-DD HH:mm:ss';
        const formatted = (raw as Dayjs).format(format);
        payload[field.name] = field.type === 'year' ? Number(formatted) : formatted;
      }
      continue;
    }
    if (field.type === 'file') {
      payload[field.name] = serializeFileFieldValue(raw);
    }
  }
  return payload;
}

/** 表单单文件字段 ↔ 后端 attachment_uuids 列表 */
export function mapOaAttachmentListToFormField(
  record: Record<string, unknown>,
  formField = 'attachment_file',
  listField = 'attachment_uuids',
): Record<string, unknown> {
  const uuids = record[listField];
  return {
    ...record,
    [formField]: Array.isArray(uuids) && uuids.length ? uuids[0] : undefined,
  };
}

export function mapOaAttachmentFormFieldToList(
  values: Record<string, unknown>,
  formField = 'attachment_file',
  listField = 'attachment_uuids',
): Record<string, unknown> {
  const { [formField]: raw, ...rest } = values;
  const uuid = serializeFileFieldValue(raw);
  return { ...rest, [listField]: uuid ? [uuid] : [] };
}
