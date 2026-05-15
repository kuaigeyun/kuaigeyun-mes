import dayjs from 'dayjs';

/** ProFormDateTimePicker 提交值可能是 dayjs / string / Date */
export function formDateTimeToIso(val: unknown): string | undefined {
  if (val == null || val === '') return undefined;
  if (dayjs.isDayjs(val)) {
    return val.isValid() ? val.toISOString() : undefined;
  }
  if (typeof val === 'string' && val.trim()) {
    const d = dayjs(val);
    return d.isValid() ? d.toISOString() : undefined;
  }
  if (val instanceof Date) {
    const d = dayjs(val);
    return d.isValid() ? d.toISOString() : undefined;
  }
  const d = dayjs(val as string | number);
  return d.isValid() ? d.toISOString() : undefined;
}
