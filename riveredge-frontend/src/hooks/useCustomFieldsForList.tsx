/**
 * 自定义字段 Hook（列表页场景）
 *
 * 用于列表页：表格列、详情 Drawer、请求数据合并自定义字段值。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
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
  /** 当前详情记录的字段值 */
  customFieldValues: Record<string, any>;
  /** 生成表格自定义列 */
  generateCustomFieldColumns: () => ProColumns<T>[];
  /** 将记录列表与自定义字段值合并 */
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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const fields = await getCustomFieldsByTable(tableName, true).catch((err) => {
          if (err?.response?.status === 401) return [];
          throw err;
        });
        setCustomFields(fields);
      } catch (e) {
        console.error('加载自定义字段失败:', e);
      }
    };
    load();
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

  const generateCustomFieldColumns = useCallback((): ProColumns<T>[] => {
    return customFields
      .filter((f) => f.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((field) => ({
        title: field.label || field.name,
        dataIndex: `custom_${field.code}`,
        width: 150,
        hideInSearch: !field.is_searchable,
        sorter: field.is_sortable,
        render: (value: any) => {
          if (value === null || value === undefined || value === '') {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }
          if (typeof value === 'object') {
            const display = value.label ?? value.name ?? value.title ?? value.code ?? (value.id != null ? String(value.id) : null);
            return display != null ? String(display) : <Typography.Text type="secondary">-</Typography.Text>;
          }
          if (field.field_type === 'date' && value) {
            return new Date(value).toLocaleDateString('zh-CN');
          }
          if (field.field_type === 'datetime' && value) {
            return new Date(value).toLocaleString('zh-CN');
          }
          if (field.field_type === 'select' && field.config?.options && Array.isArray(field.config.options)) {
            const opt = field.config.options.find((o: any) => (o.value ?? o.id) === value);
            return opt ? (opt.label ?? opt.name ?? String(value)) : String(value);
          }
          return String(value);
        },
      }));
  }, [customFields]);

  const enrichRecordsWithCustomFields = useCallback(
    async (records: T[]): Promise<T[]> => {
      if (customFields.length === 0 || records.length === 0) return records;
      try {
        return await Promise.all(
          records.map(async (record) => {
            const recordId = record[recordIdField];
            if (recordId == null) return record;
            try {
              const values = await getFieldValues(tableName, recordId);
              const enriched = { ...record } as any;
              Object.keys(values).forEach((code) => {
                enriched[`custom_${code}`] = values[code];
              });
              return enriched as T;
            } catch (e) {
              console.error(`加载记录 ${recordId} 的自定义字段值失败:`, e);
              return record;
            }
          })
        );
      } catch (e) {
        console.error('批量加载自定义字段值失败:', e);
        return records;
      }
    },
    [tableName, customFields, recordIdField]
  );

  return {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  };
}
