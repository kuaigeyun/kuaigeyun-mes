/**
 * 自定义字段 Hook（列表页场景）
 *
 * - 生成表格列：默认隐藏（defaultShow: false），可在列设置中打开
 * - 列表数据批量 enrich 自定义字段值
 * - 详情 Drawer 单条加载字段值
 */

import { useState, useEffect, useCallback } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import {
  getCustomFieldsByTable,
  getFieldValues,
  batchGetFieldValues,
} from '../services/customField';
import type { CustomField } from '../services/customField';
import { renderCustomFieldListCell } from '../components/custom-fields/customFieldListDisplay';

export interface UseCustomFieldsForListOptions {
  /** 关联表名 */
  tableName: string;
  /** 宿主 {app}:{module}，无 custom-field:read 时供隐式读取字段定义 */
  hostResource?: string;
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
  /** 生成表格自定义列（默认不展示，列设置可打开） */
  generateCustomFieldColumns: () => ProColumns<T>[];
  /** 列表数据合并自定义字段值 */
  enrichRecordsWithCustomFields: (records: T[]) => Promise<T[]>;
  /** 加载单条记录的字段值（用于详情 Drawer） */
  loadFieldValuesForDetail: (recordId: number) => Promise<void>;
  /** 重置详情字段值 */
  resetDetailFieldValues: () => void;
}

type ListColumn<T> = ProColumns<T> & { defaultShow?: boolean };

export function useCustomFieldsForList<T extends Record<string, any>>({
  tableName,
  hostResource,
  recordIdField = 'id',
}: UseCustomFieldsForListOptions): UseCustomFieldsForListResult<T> {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsLoaded, setCustomFieldsLoaded] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const fields = await getCustomFieldsByTable(tableName, true, hostResource).catch((err) => {
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
  }, [tableName, hostResource]);

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

  const generateCustomFieldColumns = useCallback((): ProColumns<T>[] => {
    return customFields
      .filter((f) => f.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field): ListColumn<T> => ({
        title: field.label || field.name,
        dataIndex: `custom_${field.code}`,
        key: `custom_${field.code}`,
        width: 150,
        ellipsis: true,
        // 列表 API 不支持自定义字段检索/排序；避免误开前端排序造成仅当前页假排序
        hideInSearch: true,
        sorter: false,
        // 默认关闭，用户在列设置中打开后写入账号列偏好
        defaultShow: false,
        render: (_: unknown, record: T) =>
          renderCustomFieldListCell(field, (record as any)[`custom_${field.code}`]),
      }));
  }, [customFields]);

  const enrichRecordsWithCustomFields = useCallback(
    async (records: T[]): Promise<T[]> => {
      if (customFields.length === 0 || records.length === 0) return records;
      const ids = records
        .map((record) => Number(record[recordIdField]))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return records;
      try {
        const byRecordId = await batchGetFieldValues(tableName, ids);
        return records.map((record) => {
          const recordId = Number(record[recordIdField]);
          if (!Number.isFinite(recordId)) return record;
          const values = byRecordId[String(recordId)];
          if (!values || typeof values !== 'object') return record;
          const enriched = { ...record } as any;
          Object.keys(values).forEach((code) => {
            enriched[`custom_${code}`] = values[code];
          });
          return enriched as T;
        });
      } catch (e) {
        console.error('批量加载自定义字段值失败:', e);
        return records;
      }
    },
    [tableName, customFields, recordIdField],
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
