import dayjs from 'dayjs';

/**
 * Form / DatePicker 唯一日期读取规范。
 * rc-picker 要求值为 dayjs；字符串、Date、Moment-like 对象会直接触发 isValid is not a function。
 */
export function coerceFormDate(value: unknown): dayjs.Dayjs | null {
  if (value == null || value === '') return null;
  if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
  const parsed = dayjs(value as string | Date | number);
  return parsed.isValid() ? parsed : null;
}

/** 提交 API 时统一转为 YYYY-MM-DD */
export function toApiDateString(value: unknown): string | undefined {
  const d = coerceFormDate(value);
  return d ? d.format('YYYY-MM-DD') : undefined;
}
