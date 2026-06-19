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
