/**
 * 自定义字段 Hook（列表页场景）
 *
 * 用于列表页：详情 Drawer 展示自定义字段；列表表格不展示自定义列（避免列过多、列宽不可控）。
 */

import { useState, useEffect, useCallback } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { getCustomFieldsByTable, getFieldValues } from '../services/customField';
import type { CustomField } from '../services/customField';

export interface UseCustomFieldsForListOptions {
  /** 关联表名 */
  tableName: string;
  /** 记录的主键字段名（用于 getFieldValues），默认 'id' */
  recordIdField?: string;
}

export interface UseCustomFieldsForListResult<T = any> {
  /** 自定义字段列表 */
  customFields: CustomField[];
  /** 自定义字段定义是否已从服务端加载完成（含「无字段」的空结果） */
  customFieldsLoaded: boolean;
  /** 当前详情记录的字段值 */
  customFieldValues: Record<string, any>;
  /** 生成表格自定义列（列表不展示，恒返回空数组） */
  generateCustomFieldColumns: () => ProColumns<T>[];
  /** 列表数据合并自定义字段值（列表不展示，原样返回） */
  enrichRecordsWithCustomFields: (records: T[]) => Promise<T[]>;
  /** 加载单条记录的字段值（用于详情 Drawer） */
  loadFieldValuesForDetail: (recordId: number) => Promise<void>;
  /** 重置详情字段值 */
  resetDetailFieldValues: () => void;
}

export function useCustomFieldsForList<T extends Record<string, any>>({
  tableName,
  recordIdField = 'id',
}: UseCustomFieldsForListOptions): UseCustomFieldsForListResult<T> {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoaded, setCustomFieldsLoaded] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fields = await getCustomFieldsByTable(tableName, true).catch((err) => {
          if (err?.response?.status === 401) return [];
          throw err;
        });
        if (!cancelled) setCustomFields(fields);
      } catch (e) {
        console.error('加载自定义字段失败:', e);
      } finally {
        if (!cancelled) setCustomFieldsLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tableName]);

  const loadFieldValuesForDetail = useCallback(async (recordId: number) => {
    try {
      const values = await getFieldValues(tableName, recordId);
      setCustomFieldValues(values);
    } catch (e) {
      console.error('加载自定义字段值失败:', e);
      setCustomFieldValues({});
    }
  }, [tableName]);

  const resetDetailFieldValues = useCallback(() => {
    setCustomFieldValues({});
  }, []);

  /** 列表不展示自定义字段列，避免列宽不可控 */
  const generateCustomFieldColumns = useCallback((): ProColumns<T>[] => [], []);

  /** 列表不展示自定义字段，跳过逐行拉取字段值 */
  const enrichRecordsWithCustomFields = useCallback(
    async (records: T[]): Promise<T[]> => records,
    [],
  );

  return {
    customFields,
    customFieldsLoaded,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  };
}
