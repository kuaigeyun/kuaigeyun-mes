/**
 * 格式化工具函数
 * 
 * 提供日期、数字、字符串等格式化函数
 * 日期格式优先使用站点设置中的 date_format 配置
 */

import dayjs, { Dayjs } from 'dayjs';
import { useConfigStore } from '../stores/configStore';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_NO_TZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
const TZ_SUFFIX_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

/** 从 configStore 获取日期格式 */
function getDateFormatFromSiteSetting(): string {
  return useConfigStore.getState().getConfig('date_format', 'YYYY-MM-DD');
}

/** 从站点设置获取时区 */
function getTimezoneFromSiteSetting(): string {
  return useConfigStore.getState().configs?.timezone || 'Asia/Shanghai';
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
 * 若误传带时刻的 ISO 字符串，仅取前 10 位日历日再格式化。
 */
export function formatBusinessDateOnly(
  date: string | Date | number | Dayjs | null | undefined,
  fallback: string = '-'
): string {
  if (date == null || date === '') return fallback;
  const text = String(date).trim();
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
  return n.toFixed(decimals);
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

