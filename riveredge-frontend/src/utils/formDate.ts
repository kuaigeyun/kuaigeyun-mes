import dayjs from 'dayjs';
import { getTimezoneFromSiteSetting } from './format';

/**
 * Form / DatePicker 唯一日期读取规范。
 * rc-picker 要求值为 dayjs；字符串、Date、Moment-like 对象会直接触发 isValid is not a function。
 */
export function coerceFormDate(value: unknown): dayjs.Dayjs | null {
  if (value == null || value === '') return null;
  if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
  const text = typeof value === 'string' ? value.trim() : '';
  if (text) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const parsed = dayjs.tz(`${text} 00:00:00`, getTimezoneFromSiteSetting());
      return parsed.isValid() ? parsed : null;
    }
    if (
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/.test(text) &&
      !/(Z|[+-]\d{2}:?\d{2})$/i.test(text)
    ) {
      const parsed = dayjs.tz(text.replace('T', ' '), getTimezoneFromSiteSetting());
      return parsed.isValid() ? parsed : null;
    }
  }
  const parsed = dayjs(value as string | Date | number);
  return parsed.isValid() ? parsed : null;
}

/** 提交 API：YYYY-MM-DD（表单墙钟 / 站点日历日；禁止 toISOString） */
export function toApiDateString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  // DatePicker dayjs：已是墙钟，直接 format
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format('YYYY-MM-DD') : undefined;
  }
  const d = coerceFormDate(value);
  if (!d) return undefined;
  return d.tz(getTimezoneFromSiteSetting()).format('YYYY-MM-DD');
}

/** 提交 API：站点墙钟 YYYY-MM-DD HH:mm:ss（禁止 toISOString） */
export function toApiDateTimeString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format('YYYY-MM-DD HH:mm:ss') : undefined;
  }
  const d = coerceFormDate(value);
  if (!d) return undefined;
  return d.tz(getTimezoneFromSiteSetting()).format('YYYY-MM-DD HH:mm:ss');
}

/** 当前站点墙钟（业务「此刻」提交唯一入口） */
export function nowSiteDateTimeString(): string {
  return dayjs().tz(getTimezoneFromSiteSetting()).format('YYYY-MM-DD HH:mm:ss');
}

/** Form.Item / ProForm 单日期：读值、写入时规范为 dayjs（避免 rc-picker 报 clone is not a function） */
export const formDateFormItemProps = {
  getValueProps: (value: unknown) => ({ value: coerceFormDate(value) ?? undefined }),
  normalize: (value: unknown) => coerceFormDate(value) ?? undefined,
} as const;

/** Form.Item / ProForm 日期区间 */
export const formDateRangeFormItemProps = {
  getValueProps: (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return { value: undefined };
    const start = coerceFormDate(value[0]);
    const end = coerceFormDate(value[1]);
    if (!start) return { value: undefined };
    return { value: end ? [start, end] : [start] };
  },
  normalize: (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const start = coerceFormDate(value[0]);
    const end = coerceFormDate(value[1]);
    if (!start) return undefined;
    return end ? [start, end] : [start];
  },
} as const;
