/**
 * 格式化工具函数
 * 
 * 提供日期、数字、字符串等格式化函数
 * 日期格式优先使用站点设置中的 date_format 配置
 */

import type { Dayjs } from 'dayjs';
import dayjs from '../config/dayjs';
import { getCachedNumericPrecisionPlaces } from '../hooks/useNumericPrecision';
import { useConfigStore } from '../stores/configStore';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_NO_TZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
const TZ_SUFFIX_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

/** 从 configStore 获取日期格式 */
function getDateFormatFromSiteSetting(): string {
  return useConfigStore.getState().getConfig('date_format', 'YYYY-MM-DD');
}

/** 从站点设置获取时区（唯一真源：configs.timezone；禁止业务侧再写死或缺省假定） */
export function getTimezoneFromSiteSetting(): string {
  const tz = useConfigStore.getState().configs?.timezone;
  const name = tz != null ? String(tz).trim() : '';
  if (!name) {
    throw new Error('站点时区未下发：configs.timezone 缺失，拒绝静默假定时区');
  }
  return name;
}

/** 站点日历日 YYYY-MM-DD（导出文件名等；禁止 toISOString().slice 当业务日） */
export function todaySiteDateString(): string {
  const tz = getTimezoneFromSiteSetting();
  return dayjs().tz(tz).format('YYYY-MM-DD');
}

/** 从站点设置获取日期时间格式 */
function getDatetimeFormatFromSiteSetting(): string {
  return `${getDateFormatFromSiteSetting()} HH:mm:ss`;
}

/**
 * 统一按站点时区解析：
 * - 对不带时区的日期/时间字符串，按站点时区解释（避免被浏览器本机时区二次偏移）
 * - 对带时区/UTC 的值，转换到站点时区展示
 */
function parseBySiteTimezone(
  value: string | Date | number | Dayjs,
  timezone: string
): Dayjs {
  if (dayjs.isDayjs(value)) {
    return value.tz(timezone);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (DATE_ONLY_PATTERN.test(text)) {
      return dayjs.tz(`${text} 00:00:00`, timezone);
    }
    if (DATETIME_NO_TZ_PATTERN.test(text) && !TZ_SUFFIX_PATTERN.test(text)) {
      return dayjs.tz(text.replace(' ', 'T'), timezone);
    }
  }

  return dayjs(value).tz(timezone);
}

/**
 * 纯业务日期（DateField / YYYY-MM-DD）：不做 UTC→本地二次偏移。
 * 带 Z/偏移的 ISO 须按站点时区取日历日，禁止对 ISO 直接 slice(0,10)
 * （东八区选 12 号常序列化为 `…T16:00:00.000Z`，切前 10 位会显示成 11 号）。
 */
export function formatBusinessDateOnly(
  date: string | Date | number | Dayjs | null | undefined,
  fallback: string = '-'
): string {
  if (date == null || date === '') return fallback;
  if (dayjs.isDayjs(date)) {
    return date.isValid() ? date.format(getDateFormatFromSiteSetting()) : fallback;
  }
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return fallback;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return dayjs(`${y}-${m}-${d}`).format(getDateFormatFromSiteSetting());
  }
  const text = String(date).trim();
  if (DATE_ONLY_PATTERN.test(text)) {
    return dayjs(text).format(getDateFormatFromSiteSetting());
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) || /Z|[+-]\d{2}:?\d{2}$/i.test(text)) {
    const tz = getTimezoneFromSiteSetting();
    const d = dayjs(text).tz(tz);
    return d.isValid() ? d.format(getDateFormatFromSiteSetting()) : fallback;
  }
  // 无时区的墙钟日期时间：取日期段
  const datePart = text.length >= 10 ? text.slice(0, 10) : text;
  if (DATE_ONLY_PATTERN.test(datePart)) {
    return dayjs(datePart).format(getDateFormatFromSiteSetting());
  }
  return formatDateBySiteSetting(date, fallback);
}

/**
 * 格式化日期（使用站点设置中的日期格式和时区）
 * 用于单据、表格等业务展示场景
 *
 * @param date - 日期（字符串、Date 对象、Dayjs 或时间戳）
 * @param fallback - 空值时的占位（默认 '-'）
 * @returns 格式化后的日期字符串
 */
export function formatDateBySiteSetting(
  date: string | Date | number | Dayjs | null | undefined,
  fallback: string = '-'
): string {
  if (date == null || date === '') return fallback;
  const tz = getTimezoneFromSiteSetting();
  const d = parseBySiteTimezone(date, tz);
  if (!d.isValid()) return fallback;
  return d.format(getDateFormatFromSiteSetting());
}

/**
 * 格式化日期时间（使用站点设置中的日期格式 + 时间 + 时区）
 *
 * @param date - 日期时间
 * @param fallback - 空值时的占位（默认 '-'）
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTimeBySiteSetting(
  date: string | Date | number | Dayjs | null | undefined,
  fallback: string = '-'
): string {
  if (date == null || date === '') return fallback;
  const tz = getTimezoneFromSiteSetting();
  const d = parseBySiteTimezone(date, tz);
  if (!d.isValid()) return fallback;
  return d.format(getDatetimeFormatFromSiteSetting());
}

/** 获取站点日期格式字符串（用于 DatePicker 等组件的 format 属性） */
export function getDateFormatString(): string {
  return getDateFormatFromSiteSetting();
}

/** 获取站点日期时间格式字符串 */
export function getDatetimeFormatString(): string {
  return getDatetimeFormatFromSiteSetting();
}

/**
 * 格式化日期时间
 * 
 * @param date - 日期（字符串、Date 对象或时间戳）
 * @param format - 格式化模板（默认使用站点设置）
 * @returns 格式化后的日期字符串
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  format?: string
): string {
  if (!date) return '-';
  const tz = getTimezoneFromSiteSetting();
  return parseBySiteTimezone(date, tz).format(format ?? getDatetimeFormatFromSiteSetting());
}

/**
 * 格式化日期
 * 
 * @param date - 日期
 * @param format - 格式化模板（默认使用站点设置）
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  format?: string
): string {
  if (!date) return '-';
  const tz = getTimezoneFromSiteSetting();
  return parseBySiteTimezone(date, tz).format(format ?? getDateFormatFromSiteSetting());
}

/**
 * 格式化数字
 *
 * @param num - 数字（可为字符串等，会先转为 number）
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的数字字符串
 */
export function formatNumber(
  num: number | string | null | undefined,
  decimals: number = 2
): string {
  if (num === null || num === undefined || num === '') {
    return '-';
  }
  const n = Number(num);
  if (!Number.isFinite(n)) {
    return '-';
  }
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 单价字段名 → 使用 price 精度，其余金额字段 → amount 精度 */
export function resolveAmountFieldPrecisionKind(fieldName?: string): 'price' | 'amount' {
  if (!fieldName) return 'amount';
  const normalized = fieldName.toLowerCase();
  if (normalized === 'unit_price' || normalized.endsWith('_unit_price')) {
    return 'price';
  }
  return 'amount';
}

/** AmountDisplay / 列 render：按字段名解析展示小数位（可被 explicitDecimals 覆盖） */
export function resolveAmountDisplayDecimals(fieldName?: string, explicitDecimals?: number): number {
  if (explicitDecimals != null) return explicitDecimals;
  return getCachedNumericPrecisionPlaces(resolveAmountFieldPrecisionKind(fieldName));
}

/** 格式化单价（固定位小数，跟随 common.price_decimal_places） */
export function formatPrice(num: unknown, fallback = '-'): string {
  if (num === null || num === undefined || num === '') return fallback;
  const n = Number(num);
  if (!Number.isFinite(n)) return fallback;
  return formatNumber(n, getCachedNumericPrecisionPlaces('price'));
}

/** 格式化金额（固定位小数，跟随 common.amount_decimal_places） */
export function formatAmount(num: unknown, fallback = '-'): string {
  if (num === null || num === undefined || num === '') return fallback;
  const n = Number(num);
  if (!Number.isFinite(n)) return fallback;
  return formatNumber(n, getCachedNumericPrecisionPlaces('amount'));
}

/** ¥ + formatAmount */
export function formatCurrencyAmount(num: unknown, fallback = '—'): string {
  const body = formatAmount(num, '-');
  if (body === '-') return fallback;
  return `¥${body}`;
}

/** ¥ + formatPrice */
export function formatCurrencyPrice(num: unknown, fallback = '—'): string {
  const body = formatPrice(num, '-');
  if (body === '-') return fallback;
  return `¥${body}`;
}

export function renderPrice(value: unknown): string {
  return formatPrice(value);
}

export function renderAmount(value: unknown): string {
  return formatAmount(value);
}

/**
 * 格式化数量（唯一展示入口）
 *
 * 小数位跟随业务配置 common.quantity_decimal_places（默认 2，范围 0–4），去掉无意义尾零。
 * 空值 / 非法值统一为「—」。单价用 formatPrice，金额用 formatAmount / AmountDisplay，数量用 formatQuantity。
 */
export function formatQuantity(num: unknown): string {
  if (num === null || num === undefined || num === '') {
    return '—';
  }
  const n = Number(num);
  if (!Number.isFinite(n)) {
    return '—';
  }
  const decimals = getCachedNumericPrecisionPlaces('quantity');
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** ProTable / 列 render 薄封装，规则同 formatQuantity */
export function renderQuantity(value: unknown): string {
  return formatQuantity(value);
}

/**
 * 格式化文件大小
 * 
 * @param bytes - 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

