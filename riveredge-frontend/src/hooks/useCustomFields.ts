/**
 * 自定义字段 Hook（表单场景）
 *
 * 用于表单 Modal 中加载自定义字段、获取/保存字段值。
 * 配合 CustomFieldsFormSection 组件使用。
 */

import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { getCustomFieldsByTable, getFieldValues, batchSetFieldValues } from '../services/customField';
import type { CustomField } from '../services/customField';
import {
  customFieldFileValueToUploadFiles,
  uploadFileListToCustomFieldValue,
} from '../components/custom-fields/customFieldFileUtils';
import { normalizeJsonFieldValue } from '../components/custom-fields/customFieldJsonUtils';

const CUSTOM_PREFIX = 'custom_';

export interface UseCustomFieldsOptions {
  /** 关联表名（如 master_data_factory_plants） */
  tableName: string;
  /** 是否在 open 时加载，传入 false 则组件挂载时加载 */
  loadWhenOpen?: boolean;
  /** 当前 Modal 是否打开 */
  open?: boolean;
}

export interface UseCustomFieldsResult {
  /** 自定义字段列表 */
  customFields: CustomField[];
  /** 当前记录的字段值（用于编辑时回填） */
  customFieldValues: Record<string, any>;
  /** 加载指定记录的字段值，返回 { custom_xxx: value } 格式，可直接 setFieldsValue */
  loadFieldValues: (recordId: number) => Promise<Record<string, any>>;
  /** 从表单 values 中提取 custom_* 与标准字段，返回分离后的数据 */
  extractFormValues: (formValues: Record<string, any>) => { customData: Record<string, any>; standardValues: Record<string, any> };
  /** 将 customData 保存到后端 */
  saveCustomFieldValues: (recordId: number, customData: Record<string, any>) => Promise<void>;
  /** 重置字段值（关闭 Modal 时调用） */
  resetFieldValues: () => void;
}

export function useCustomFields({
  tableName,
  loadWhenOpen = true,
  open = true,
}: UseCustomFieldsOptions): UseCustomFieldsResult {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (loadWhenOpen && !open) return;
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
  }, [tableName, loadWhenOpen, open]);

  const loadFieldValues = useCallback(
    async (recordId: number) => {
      try {
        const values = await getFieldValues(tableName, recordId);
        let fields = customFields;
        if (fields.length === 0) {
          fields = await getCustomFieldsByTable(tableName, true).catch(() => []);
          if (fields.length > 0) setCustomFields(fields);
        }
        const formValues: Record<string, any> = {};
        const displayValues: Record<string, any> = {};
        for (const field of fields) {
          const val = values[field.code];
          if (val === undefined) continue;
          if (field.field_type === 'image' || field.field_type === 'file') {
            const files = await customFieldFileValueToUploadFiles(val, {
              image: field.field_type === 'image',
            });
            formValues[`${CUSTOM_PREFIX}${field.code}`] = files;
            displayValues[field.code] = files;
          } else {
            formValues[`${CUSTOM_PREFIX}${field.code}`] = val;
            displayValues[field.code] = val;
          }
        }
        setCustomFieldValues(displayValues);
        return formValues;
      } catch (e) {
        console.error('加载自定义字段值失败:', e);
        setCustomFieldValues({});
        return {};
      }
    },
    [tableName, customFields]
  );

  const extractFormValues = useCallback((formValues: Record<string, any>) => {
    const customData: Record<string, any> = {};
    const standardValues: Record<string, any> = {};
    Object.keys(formValues).forEach((key) => {
      if (key.startsWith(CUSTOM_PREFIX)) {
        customData[key.replace(CUSTOM_PREFIX, '')] = formValues[key];
      } else {
        standardValues[key] = formValues[key];
      }
    });
    return { customData, standardValues };
  }, []);

  const saveCustomFieldValues = useCallback(
    async (recordId: number, customData: Record<string, any>) => {
      if (Object.keys(customData).length === 0) return;
      const fieldValues = Object.keys(customData)
        .map((fieldCode) => {
          const field = customFields.find((f) => f.code === fieldCode);
          if (!field) return null;
          let value = customData[fieldCode];
          if (field.field_type === 'image' || field.field_type === 'file') {
            value = uploadFileListToCustomFieldValue(value, field.field_type);
          } else if (field.field_type === 'json') {
            value = normalizeJsonFieldValue(value);
          } else if (field.field_type === 'time' || field.field_type === 'datetime') {
            if (value != null && value !== '') {
              const format = field.config?.format
                || (field.field_type === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss');
              if (dayjs.isDayjs(value)) {
                value = value.format(format);
              }
            }
          } else if (field.field_type === 'formula') {
            if (value == null || value === '') {
              return null;
            }
            const num = Number(value);
            value = Number.isFinite(num) ? num : null;
          }
          return { field_uuid: field.uuid, value };
        })
        .filter(Boolean);
      if (fieldValues.length > 0) {
        await batchSetFieldValues({
          record_id: recordId,
          record_table: tableName,
          values: fieldValues as any[],
        });
      }
    },
    [tableName, customFields]
  );

  const resetFieldValues = useCallback(() => {
    setCustomFieldValues({});
  }, []);

  return {
    customFields,
    customFieldValues,
    loadFieldValues,
    extractFormValues,
    saveCustomFieldValues,
    resetFieldValues,
  };
}
