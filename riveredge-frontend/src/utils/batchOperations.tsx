/**
 * 批量操作工具函数
 * 
 * 提供统一的批量导入、导出和处理功能，支持并发处理、错误重试、进度跟踪等。
 */

import React from 'react';
import { Modal, Progress, message } from 'antd';

/**
 * 批量导入配置
 */
export interface BatchImportConfig<T = any> {
  /**
   * 导入数据列表
   */
  items: T[];
  /**
   * 导入函数（单个数据项的导入逻辑）
   */
  importFn: (item: T, index: number) => Promise<any>;
  /**
   * 并发数（默认5）
   */
  concurrency?: number;
  /**
   * 重试次数（默认3）
   */
  retryCount?: number;
  /**
   * 标题
   */
  title?: string;
  /**
   * 进度回调
   */
  onProgress?: (current: number, total: number, success: number, fail: number) => void;
  /**
   * 完成回调
   */
  onComplete?: (result: BatchImportResult) => void;
}

/**
 * 批量导入结果
 */
export interface BatchImportResult {
  total: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; error: string }>;
  successItems: any[];
  failureItems: any[];
}

/**
 * 批量导入数据（支持并发和重试）
 * 
 * @param config - 导入配置
 * @returns 导入结果
 */
export async function batchImport<T = any>(
  config: BatchImportConfig<T>
): Promise<BatchImportResult> {
  const {
    items,
    importFn,
    concurrency = 5,
    retryCount = 3,
    title = '正在导入数据',
    onProgress,
    onComplete,
  } = config;

  // 显示导入进度 Modal
  const progressModal = Modal.info({
    title,
    width: 600,
    content: (
      <div>
        <Progress percent={0} status="active" />
        <p style={{ marginTop: 16 }}>准备导入 {items.length} 条数据...</p>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
  });

  const result: BatchImportResult = {
    total: items.length,
    successCount: 0,
    failureCount: 0,
    errors: [],
    successItems: [],
    failureItems: [],
  };

  // 批量导入（带并发控制和重试）
  const importWithRetry = async (item: T, index: number): Promise<{ success: boolean; error?: string; data?: any }> => {
    let lastError: string | undefined;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const data = await importFn(item, index);
        return { success: true, data };
      } catch (error: any) {
        lastError = error?.message || error?.detail || '未知错误';
        if (attempt < retryCount - 1) {
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }
    
    return { success: false, error: lastError };
  };

  // 并发执行导入（使用 Promise.allSettled 确保所有任务完成）
  const tasks = items.map((item, index) => importWithRetry(item, index));
  
  // 分批执行，控制并发数
  const batches: Promise<{ success: boolean; error?: string; data?: any }>[][] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    batches.push(tasks.slice(i, i + concurrency));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(batch);
    
    batchResults.forEach((settledResult, batchIndex) => {
      const globalIndex = batches.indexOf(batch) * concurrency + batchIndex;
      
      if (settledResult.status === 'fulfilled') {
        const importResult = settledResult.value;
        if (importResult.success) {
          result.successCount++;
          result.successItems.push(importResult.data);
        } else {
          result.failureCount++;
          result.errors.push({
            row: globalIndex + 1,
            error: importResult.error || '未知错误',
          });
          result.failureItems.push(items[globalIndex]);
        }
      } else {
        result.failureCount++;
        result.errors.push({
          row: globalIndex + 1,
          error: settledResult.reason?.message || '未知错误',
        });
        result.failureItems.push(items[globalIndex]);
      }
      
      // 更新进度
      const percent = Math.round(((globalIndex + 1) / items.length) * 100);
      progressModal.update({
        content: (
          <div>
            <Progress percent={percent} status="active" />
            <p style={{ marginTop: 16 }}>
              正在导入第 {globalIndex + 1} / {items.length} 条数据...
            </p>
            <p style={{ marginTop: 8, color: '#52c41a' }}>
              成功：{result.successCount} 条 | 失败：{result.failureCount} 条
            </p>
          </div>
        ),
      });
      
      if (onProgress) {
        onProgress(globalIndex + 1, items.length, result.successCount, result.failureCount);
      }
    });
  }

  // 关闭进度 Modal
  progressModal.destroy();

  // 显示导入结果
  if (result.failureCount > 0) {
    Modal.warning({
      title: `${title}（部分失败）`,
      width: 700,
      content: (
        <div>
          <p>
            <strong>导入结果：</strong>成功 {result.successCount} 条，失败 {result.failureCount} 条
          </p>
        </div>
      ),
    });
  } else {
    message.success(`成功导入 ${result.successCount} 条数据`);
  }

  if (onComplete) {
    onComplete(result);
  }

  return result;
}

/**
 * 批量导出数据到 CSV
 * 
 * @param data - 数据列表
 * @param headers - CSV 表头
 * @param fieldMapping - 字段映射
 * @param filename - 文件名
 */
export function exportToCSV(
  data: any[],
  headers: string[],
  fieldMapping: Record<string, string>,
  filename: string = `export_${new Date().toISOString().slice(0, 10)}.csv`
): void {
  // 构建 CSV 内容
  const csvRows: string[] = [];
  
  // 添加表头
  csvRows.push(headers.join(','));
  
  // 添加数据行
  for (const item of data) {
    const row: string[] = [];
    for (const header of headers) {
      const fieldName = fieldMapping[header] || header;
      let value = item[fieldName] || '';
      
      // 处理复杂类型
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // 转义 CSV 特殊字符
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      row.push(String(value));
    }
    csvRows.push(row.join(','));
  }
  
  // 创建 Blob 并下载
  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // 添加 BOM 以支持 Excel 中文
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  
  message.success(`导出成功，共 ${data.length} 条数据`);
}

/**
 * 批量处理数据（支持批量删除、批量更新等）
 * 
 * @param items - 待处理的数据项列表
 * @param processFn - 处理函数
 * @param title - 标题
 * @param concurrency - 并发数（默认5）
 * @returns 处理结果
 */
export async function batchProcess<T = any>(
  items: T[],
  processFn: (item: T, index: number) => Promise<any>,
  title: string = '正在处理',
  concurrency: number = 5
): Promise<{ successCount: number; failureCount: number; errors: Array<{ index: number; error: string }> }> {
  const result = {
    successCount: 0,
    failureCount: 0,
    errors: [] as Array<{ index: number; error: string }>,
  };

  // 显示进度 Modal
  const progressModal = Modal.info({
    title,
    width: 600,
    content: (
      <div>
        <Progress percent={0} status="active" />
        <p style={{ marginTop: 16 }}>准备处理 {items.length} 条数据...</p>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
  });

  // 并发处理
  const semaphore = Array(concurrency).fill(null).map(() => Promise.resolve());

  const tasks = items.map(async (item, index) => {
    const semaphoreIndex = index % concurrency;
    await semaphore[semaphoreIndex];
    
    semaphore[semaphoreIndex] = processFn(item, index)
      .then(() => {
        result.successCount++;
        
        // 更新进度
        const percent = Math.round(((index + 1) / items.length) * 100);
        progressModal.update({
          content: (
            <div>
              <Progress percent={percent} status="active" />
              <p style={{ marginTop: 16 }}>
                正在处理第 {index + 1} / {items.length} 条数据...
              </p>
              <p style={{ marginTop: 8, color: '#52c41a' }}>
                成功：{result.successCount} 条 | 失败：{result.failureCount} 条
              </p>
            </div>
          ),
        });
      })
      .catch((error: any) => {
        result.failureCount++;
        result.errors.push({
          index,
          error: error?.message || error?.detail || '未知错误',
        });
        
        // 更新进度
        const percent = Math.round(((index + 1) / items.length) * 100);
        progressModal.update({
          content: (
            <div>
              <Progress percent={percent} status="active" />
              <p style={{ marginTop: 16 }}>
                正在处理第 {index + 1} / {items.length} 条数据...
              </p>
              <p style={{ marginTop: 8, color: '#52c41a' }}>
                成功：{result.successCount} 条 | 失败：{result.failureCount} 条
              </p>
            </div>
          ),
        });
      });
    
    return semaphore[semaphoreIndex];
  });

  await Promise.all(tasks);

  // 关闭进度 Modal
  progressModal.destroy();

  // 显示处理结果
  if (result.failureCount > 0) {
    Modal.warning({
      title: `${title}（部分失败）`,
      content: `成功处理 ${result.successCount} 条，失败 ${result.failureCount} 条`,
    });
  } else {
    message.success(`成功处理 ${result.successCount} 条数据`);
  }

  return result;
}

