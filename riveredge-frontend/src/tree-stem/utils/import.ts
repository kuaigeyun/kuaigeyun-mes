/**
 * 通用导入处理工具函数
 * 
 * 提供数据解析、验证、批量导入等通用功能
 */

import { Modal, Progress, List, Typography } from 'antd';
import { App } from 'antd';

/**
 * 导入字段映射配置
 */
export interface ImportFieldMap {
  /**
   * 表头名称到字段名的映射
   * 支持多种表头名称映射到同一个字段
   * 例如：{ '组织名称': 'name', '*组织名称': 'name', '名称': 'name' }
   */
  [headerName: string]: string;
}

/**
 * 字段验证规则
 */
export interface ImportFieldRule {
  /**
   * 是否必填
   */
  required?: boolean;
  /**
   * 自定义验证函数
   * @param value - 字段值
   * @param rowData - 整行数据
   * @returns true 或错误信息字符串
   */
  validator?: (value: any, rowData?: Record<string, any>) => boolean | string;
  /**
   * 字段类型转换函数
   * @param value - 原始值
   * @returns 转换后的值
   */
  transform?: (value: any) => any;
}

/**
 * 导入配置
 */
export interface ImportConfig {
  /**
   * 字段映射配置
   */
  fieldMap: ImportFieldMap;
  /**
   * 字段验证规则
   */
  fieldRules?: Record<string, ImportFieldRule>;
  /**
   * 必需字段列表
   */
  requiredFields?: string[];
  /**
   * 枚举值映射（可选）
   * 例如：{ 'plan': { '体验套餐': 'trial', '基础版': 'basic' } }
   */
  enumMaps?: Record<string, Record<string, any>>;
  /**
   * 数据行起始索引（默认：2，跳过表头和示例数据行）
   */
  dataStartRow?: number;
}

/**
 * 导入数据项
 */
export interface ImportDataItem<T = any> {
  /**
   * 解析后的数据
   */
  data: T;
  /**
   * Excel 行号（从1开始）
   */
  rowIndex: number;
  /**
   * 原始行数据
   */
  rawRow: any[];
}

/**
 * 验证错误
 */
export interface ImportValidationError {
  /**
   * Excel 行号
   */
  rowIndex: number;
  /**
   * 错误信息
   */
  message: string;
}

/**
 * 导入结果
 */
export interface ImportResult<T = any> {
  /**
   * 是否成功
   */
  success: boolean;
  /**
   * Excel 行号
   */
  rowIndex: number;
  /**
   * 结果消息
   */
  message: string;
  /**
   * 导入的数据（成功时）
   */
  data?: T;
  /**
   * 错误信息（失败时）
   */
  error?: any;
}

/**
 * 解析导入数据
 * 
 * @param rawData - 原始导入数据（二维数组）
 * @param config - 导入配置
 * @returns 解析后的数据和验证错误
 */
export function parseImportData<T = Record<string, any>>(
  rawData: any[][],
  config: ImportConfig
): {
  data: ImportDataItem<T>[];
  errors: ImportValidationError[];
} {
  const {
    fieldMap,
    fieldRules = {},
    requiredFields = [],
    enumMaps = {},
    dataStartRow = 2, // 默认从第3行开始（跳过表头和示例数据行）
  } = config;

  if (!rawData || rawData.length === 0) {
    return { data: [], errors: [] };
  }

  // 解析表头和数据
  const headers = rawData[0] || [];
  const rows = rawData.slice(dataStartRow); // 跳过表头和示例数据行

  if (rows.length === 0) {
    return { data: [], errors: [] };
  }

  // 找到表头索引
  const headerIndexMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalizedHeader = String(header || '').trim();
    // 支持带*号的必填项标识
    const headerWithoutStar = normalizedHeader.replace(/^\*/, '');
    if (fieldMap[normalizedHeader]) {
      headerIndexMap[fieldMap[normalizedHeader]] = index;
    } else if (fieldMap[headerWithoutStar]) {
      headerIndexMap[fieldMap[headerWithoutStar]] = index;
    }
  });

  // 验证必需字段
  const missingFields = requiredFields.filter(field => headerIndexMap[field] === undefined);
  if (missingFields.length > 0) {
    return {
      data: [],
      errors: [{
        rowIndex: 1,
        message: `缺少必需字段：${missingFields.join('、')}。请确保表头包含这些列。`,
      }],
    };
  }

  // 过滤空行
  const nonEmptyRows = rows
    .map((row, index) => ({ row, originalIndex: index }))
    .filter(({ row }) => {
      return row.some(cell => {
        const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
        return value !== '';
      });
    });

  // 解析数据行
  const importData: ImportDataItem<T>[] = [];
  const errors: ImportValidationError[] = [];

  nonEmptyRows.forEach(({ row, originalIndex }) => {
    const rowIndex = originalIndex + dataStartRow + 1; // Excel 行号（从1开始）
    const rowData: Record<string, any> = {};

    // 提取字段值
    Object.keys(headerIndexMap).forEach(field => {
      const colIndex = headerIndexMap[field];
      if (colIndex !== undefined && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
        let value = String(row[colIndex]).trim();
        
        // 应用类型转换
        const rule = fieldRules[field];
        if (rule?.transform) {
          value = rule.transform(value);
        }
        
        rowData[field] = value;
      }
    });

    // 验证必需字段
    for (const field of requiredFields) {
      if (!rowData[field]) {
        errors.push({
          rowIndex,
          message: `第 ${rowIndex} 行：缺少必需字段（${field}）`,
        });
        return;
      }
    }

    // 验证字段规则
    for (const [field, rule] of Object.entries(fieldRules)) {
      const value = rowData[field];
      
      // 必填验证
      if (rule.required && (!value || value === '')) {
        errors.push({
          rowIndex,
          message: `第 ${rowIndex} 行：${field} 是必填字段`,
        });
        return;
      }
      
      // 自定义验证
      if (rule.validator && value !== undefined && value !== null && value !== '') {
        const validationResult = rule.validator(value, rowData);
        if (validationResult !== true) {
          errors.push({
            rowIndex,
            message: `第 ${rowIndex} 行：${typeof validationResult === 'string' ? validationResult : `${field} 验证失败`}`,
          });
          return;
        }
      }
    }

    // 应用枚举值映射
    for (const [field, enumMap] of Object.entries(enumMaps)) {
      if (rowData[field] && enumMap[rowData[field]]) {
        rowData[field] = enumMap[rowData[field]];
      }
    }

    importData.push({
      data: rowData as T,
      rowIndex,
      rawRow: row,
    });
  });

  return { data: importData, errors };
}

/**
 * 显示验证错误 Modal
 * 
 * @param errors - 验证错误列表
 */
export function showValidationErrors(errors: ImportValidationError[]): void {
  Modal.error({
    title: '数据验证失败',
    width: 600,
    content: (
      <div>
        <p>以下数据行存在错误，请修正后重新导入：</p>
        <List
          size="small"
          dataSource={errors}
          renderItem={(item) => (
            <List.Item>
              <Typography.Text type="danger">{item.message}</Typography.Text>
            </List.Item>
          )}
        />
      </div>
    ),
  });
}

/**
 * 批量导入数据
 * 
 * @param importData - 解析后的导入数据
 * @param importFn - 导入函数（单个数据项的导入逻辑）
 * @param options - 配置选项
 * @returns 导入结果列表
 */
export async function batchImport<T = any>(
  importData: ImportDataItem<T>[],
  importFn: (data: T, rowIndex: number) => Promise<T>,
  options?: {
    title?: string;
    onProgress?: (current: number, total: number, success: number, fail: number) => void;
    onComplete?: (results: ImportResult<T>[]) => void;
  }
): Promise<ImportResult<T>[]> {
  const { title = '正在导入数据', onProgress, onComplete } = options || {};

  // 显示导入进度 Modal
  const progressModal = Modal.info({
    title,
    width: 600,
    content: (
      <div>
        <Progress percent={0} status="active" />
        <p style={{ marginTop: 16 }}>准备导入 {importData.length} 条数据...</p>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
  });

  const results: ImportResult<T>[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < importData.length; i++) {
    const item = importData[i];
    const percent = Math.round(((i + 1) / importData.length) * 100);

    try {
      const result = await importFn(item.data, item.rowIndex);
      successCount++;
      results.push({
        success: true,
        rowIndex: item.rowIndex,
        message: `第 ${item.rowIndex} 行导入成功`,
        data: result,
      });

      // 更新进度
      const content = (
        <div>
          <Progress percent={percent} status="active" />
          <p style={{ marginTop: 16 }}>
            正在导入第 {i + 1} / {importData.length} 条数据...
          </p>
          <p style={{ marginTop: 8, color: '#52c41a' }}>
            成功：{successCount} 条 | 失败：{failCount} 条
          </p>
        </div>
      );
      
      progressModal.update({ content });
      
      if (onProgress) {
        onProgress(i + 1, importData.length, successCount, failCount);
      }
    } catch (error: any) {
      failCount++;
      const errorMessage = error?.message || error?.detail || '未知错误';
      results.push({
        success: false,
        rowIndex: item.rowIndex,
        message: `第 ${item.rowIndex} 行导入失败：${errorMessage}`,
        error,
      });

      // 更新进度
      const content = (
        <div>
          <Progress percent={percent} status="active" />
          <p style={{ marginTop: 16 }}>
            正在导入第 {i + 1} / {importData.length} 条数据...
          </p>
          <p style={{ marginTop: 8, color: '#52c41a' }}>
            成功：{successCount} 条 | 失败：{failCount} 条
          </p>
        </div>
      );
      
      progressModal.update({ content });
      
      if (onProgress) {
        onProgress(i + 1, importData.length, successCount, failCount);
      }
    }
  }

  // 关闭进度 Modal
  progressModal.destroy();

  if (onComplete) {
    onComplete(results);
  }

  return results;
}

/**
 * 显示导入结果
 * 
 * @param results - 导入结果列表
 * @param options - 配置选项
 */
export function showImportResults<T = any>(
  results: ImportResult<T>[],
  options?: {
    title?: string;
    successMessage?: string;
    onOk?: () => void;
  }
): void {
  const { title = '导入完成', successMessage, onOk } = options || {};
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const failedResults = results.filter(r => !r.success);

  if (failedResults.length > 0) {
    Modal.warning({
      title: `${title}（部分失败）`,
      width: 700,
      content: (
        <div>
          <p>
            <strong>导入结果：</strong>成功 {successCount} 条，失败 {failCount} 条
          </p>
          <p style={{ marginTop: 16 }}>失败的记录：</p>
          <List
            size="small"
            dataSource={failedResults}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text type="danger">{item.message}</Typography.Text>
              </List.Item>
            )}
          />
        </div>
      ),
      onOk,
    });
  } else {
    Modal.success({
      title,
      content: successMessage || `成功导入 ${successCount} 条数据`,
      onOk,
    });
  }
}

/**
 * 通用的导入处理函数
 * 
 * @param rawData - 原始导入数据（二维数组）
 * @param config - 导入配置
 * @param importFn - 导入函数
 * @param options - 配置选项
 * @returns 导入结果列表
 */
export async function handleImport<T = Record<string, any>>(
  rawData: any[][],
  config: ImportConfig,
  importFn: (data: T, rowIndex: number) => Promise<T>,
  options?: {
    title?: string;
    successMessage?: string;
    onComplete?: (results: ImportResult<T>[]) => void;
    onOk?: () => void;
  }
): Promise<ImportResult<T>[]> {
  // 解析和验证数据
  const { data, errors } = parseImportData<T>(rawData, config);

  // 如果有验证错误，显示错误信息
  if (errors.length > 0) {
    showValidationErrors(errors);
    return [];
  }

  if (data.length === 0) {
    return [];
  }

  // 批量导入
  const results = await batchImport(data, importFn, {
    title: options?.title,
  });

  // 显示导入结果
  showImportResults(results, {
    title: options?.title,
    successMessage: options?.successMessage,
    onOk: options?.onOk,
  });

  if (options?.onComplete) {
    options.onComplete(results);
  }

  return results;
}

