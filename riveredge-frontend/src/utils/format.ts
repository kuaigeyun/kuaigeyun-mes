/**
 * 格式化工具函数
 * 
 * 提供日期、数字、字符串等格式化函数
 * 日期格式优先使用站点设置中的 date_format 配置
 */

import dayjs, { Dayjs } from 'dayjs';
import { useConfigStore } from '../stores/configStore';

/** 从 configStore 获取日期格式 */
function getDateFormatFromSiteSetting(): string {
  return useConfigStore.getState().getConfig('date_format', 'YYYY-MM-DD');
}

/** 从站点设置获取日期时间格式 */
function getDatetimeFormatFromSiteSetting(): string {
  return `${getDateFormatFromSiteSetting()} HH:mm:ss`;
}

/**
 * 格式化日期（使用站点设置中的日期格式）
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
  const d = dayjs(date);
  if (!d.isValid()) return fallback;
  return d.format(getDateFormatFromSiteSetting());
}

/**
 * 格式化日期时间（使用站点设置中的日期格式 + 时间）
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
  const d = dayjs(date);
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
  return dayjs(date).format(format ?? getDatetimeFormatFromSiteSetting());
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
  return dayjs(date).format(format ?? getDateFormatFromSiteSetting());
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

