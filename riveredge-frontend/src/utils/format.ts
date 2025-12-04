/**
 * 格式化工具函数
 * 
 * 提供日期、数字、字符串等格式化函数
 */

import dayjs from 'dayjs';

/**
 * 格式化日期时间
 * 
 * @param date - 日期（字符串、Date 对象或时间戳）
 * @param format - 格式化模板（默认 'YYYY-MM-DD HH:mm:ss'）
 * @returns 格式化后的日期字符串
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  if (!date) {
    return '-';
  }
  return dayjs(date).format(format);
}

/**
 * 格式化日期
 * 
 * @param date - 日期
 * @param format - 格式化模板（默认 'YYYY-MM-DD'）
 * @returns 格式化后的日期字符串
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  format: string = 'YYYY-MM-DD'
): string {
  return formatDateTime(date, format);
}

/**
 * 格式化数字
 * 
 * @param num - 数字
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的数字字符串
 */
export function formatNumber(
  num: number | null | undefined,
  decimals: number = 2
): string {
  if (num === null || num === undefined) {
    return '-';
  }
  return num.toFixed(decimals);
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

