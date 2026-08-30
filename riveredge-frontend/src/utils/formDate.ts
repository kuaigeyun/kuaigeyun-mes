import dayjs from '../config/dayjs';
import { getTimezoneFromSiteSetting } from './format';

/** Excel 1900 日期系统起点（含 Lotus 闰年兼容：序列日 0 = 1899-12-30） */
const EXCEL_SERIAL_EPOCH = dayjs('1899-12-30');

function isPlausibleBusinessYear(year: number): boolean {
  return year >= 1900 && year <= 2100;
}

function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}

/**
 * 导入表格日期 → API `YYYY-MM-DD`。
 * xlsx 原始读出常为 Excel 序列日数字符串（如 `45444`）；`dayjs('45444')` 会误成 4544 年。
 */
export function parseSpreadsheetDateToApiString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = dayjs(s.slice(0, 10));
    return d.isValid() && isPlausibleBusinessYear(d.year()) ? d.format('YYYY-MM-DD') : undefined;
  }

  const slash = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
  if (slash) {
    const d = dayjs(`${slash[1]}-${pad2(slash[2])}-${pad2(slash[3])}`);
    return d.isValid() && isPlausibleBusinessYear(d.year()) ? d.format('YYYY-MM-DD') : undefined;
  }

  // 紧凑 YYYYMMDD（须先于 Excel 序列判断，避免 8 位被当成序列）
  if (/^\d{8}$/.test(s)) {
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    const day = Number(s.slice(6, 8));
    if (isPlausibleBusinessYear(y) && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = dayjs(`${y}-${pad2(m)}-${pad2(day)}`);
      if (d.isValid()) return d.format('YYYY-MM-DD');
    }
    return undefined;
  }

  // Excel 序列日（含小数时间）；常见约 1～60000（1900–2064）
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n >= 1 && n < 100000) {
      const d = EXCEL_SERIAL_EPOCH.add(Math.floor(n), 'day');
      return d.isValid() && isPlausibleBusinessYear(d.year()) ? d.format('YYYY-MM-DD') : undefined;
    }
  }

  const d = dayjs(s);
  if (!d.isValid() || !isPlausibleBusinessYear(d.year())) return undefined;
  return d.format('YYYY-MM-DD');
}

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

/**
 * 从 Date 本地日历分量拼 YYYY-MM-DD（浏览器墙钟；禁止 toISOString）。
 * 东八区选 12 号零点 → toJSON 为 `2026-05-11T16:00:00.000Z`，切前 10 位会错成 11 号。
 */
function localDatePartsString(value: Date): string | undefined {
  if (Number.isNaN(value.getTime())) return undefined;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 从 dayjs / dayjs-like 取底层 Date（跨 bundle 时 isDayjs 可能为 false） */
function extractUnderlyingDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null || typeof value !== 'object') return null;
  const obj = value as { $d?: unknown; toDate?: () => Date };
  if (obj.$d instanceof Date && !Number.isNaN(obj.$d.getTime())) return obj.$d;
  if (typeof obj.toDate === 'function') {
    try {
      const d = obj.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * 站点墙钟日历日。优先用底层 Date 的本地 getFullYear/getMonth/getDate
 * （与 DatePicker 用户所见一致）；否则再经站点时区格式化。
 */
function wallCalendarDateString(value: dayjs.Dayjs | Date): string | undefined {
  if (value instanceof Date) {
    return localDatePartsString(value);
  }
  const underlying = extractUnderlyingDate(value);
  if (underlying) {
    return localDatePartsString(underlying);
  }
  if (!value.isValid()) return undefined;
  const wall = value.tz(getTimezoneFromSiteSetting());
  const y = wall.year();
  const m = String(wall.month() + 1).padStart(2, '0');
  const d = String(wall.date()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 提交 API：YYYY-MM-DD（表单墙钟 / 站点日历日；禁止 toISOString） */
export function toApiDateString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    // 误传入带 Z 的 ISO：按站点时区还原业务日，禁止 slice(0,10)
    if (/^\d{4}-\d{2}-\d{2}T/.test(text) || /Z|[+-]\d{2}:?\d{2}$/i.test(text)) {
      const d = dayjs(text).tz(getTimezoneFromSiteSetting());
      return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
    }
  }
  const underlying = extractUnderlyingDate(value);
  if (underlying) {
    return localDatePartsString(underlying);
  }
  if (dayjs.isDayjs(value)) {
    return wallCalendarDateString(value);
  }
  // 禁止对未知 dayjs-like 直接 .format：utc 模式下会偏一天
  const d = coerceFormDate(value);
  if (!d) return undefined;
  return wallCalendarDateString(d);
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
