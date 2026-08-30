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
import { coerceFormDate, toApiDateString, toApiDateTimeString } from '../utils/formDate';

const CUSTOM_PREFIX = 'custom_';

/** 从表单实例按字段名读取值（ProForm / antd Form 均具备） */
export type CustomFieldFormReader = {
  getFieldValue: (name: string) => unknown;
};

export interface UseCustomFieldsOptions {
  /** 关联表名（如 master_data_factory_plants） */
  tableName: string;
  /** 宿主 {app}:{module}，无 custom-field:read 时供隐式读取字段定义 */
  hostResource?: string;
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
  /** 从表单 values 中提取 custom_* 与标准字段；有字段定义时须再传入 form 按 name 读取 */
  extractFormValues: (
    formValues: Record<string, any>,
    form?: CustomFieldFormReader,
  ) => { customData: Record<string, any>; standardValues: Record<string, any> };
  /** 将 customData 保存到后端 */
  saveCustomFieldValues: (recordId: number, customData: Record<string, any>) => Promise<void>;
  /** 重置字段值（关闭 Modal 时调用） */
  resetFieldValues: () => void;
}

export function useCustomFields({
  tableName,
  hostResource,
  loadWhenOpen = true,
  open = true,
}: UseCustomFieldsOptions): UseCustomFieldsResult {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (loadWhenOpen && !open) return;
    const load = async () => {
      try {
        const fields = await getCustomFieldsByTable(tableName, true, hostResource).catch((err) => {
          if (err?.response?.status === 401) return [];
          throw err;
        });
        setCustomFields(fields);
      } catch (e) {
        console.error('加载自定义字段失败:', e);
      }
    };
    load();
  }, [tableName, hostResource, loadWhenOpen, open]);

  const loadFieldValues = useCallback(
    async (recordId: number) => {
      try {
        const values = await getFieldValues(tableName, recordId);
        let fields = customFields;
        if (fields.length === 0) {
          fields = await getCustomFieldsByTable(tableName, true, hostResource).catch(() => []);
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
          } else if (field.field_type === 'date' || field.field_type === 'datetime') {
            const coerced = coerceFormDate(val);
            formValues[`${CUSTOM_PREFIX}${field.code}`] = coerced ?? undefined;
            displayValues[field.code] = coerced ?? val;
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
    [tableName, hostResource, customFields]
  );

  const extractFormValues = useCallback(
    (formValues: Record<string, any> = {}, form?: CustomFieldFormReader) => {
      const customData: Record<string, any> = {};
      const standardValues: Record<string, any> = {};
      const knownCodes = new Set(customFields.map((field) => field.code));

      for (const field of customFields) {
        const key = `${CUSTOM_PREFIX}${field.code}`;
        if (form) {
          customData[field.code] = form.getFieldValue(key);
        } else if (Object.prototype.hasOwnProperty.call(formValues, key)) {
          customData[field.code] = formValues[key];
        }
      }

      Object.keys(formValues).forEach((key) => {
        if (key.startsWith(CUSTOM_PREFIX)) {
          const code = key.slice(CUSTOM_PREFIX.length);
          if (!knownCodes.has(code)) {
            customData[code] = formValues[key];
          }
        } else {
          standardValues[key] = formValues[key];
        }
      });
      return { customData, standardValues };
    },
    [customFields],
  );

  const saveCustomFieldValues = useCallback(
    async (recordId: number, customData: Record<string, any>) => {
      const incomingCodes = Object.keys(customData);
      if (incomingCodes.length === 0) return;

      let fields = customFields;
      if (fields.length === 0) {
        fields = await getCustomFieldsByTable(tableName, true, hostResource);
        if (fields.length > 0) {
          setCustomFields(fields);
        }
      }
      if (fields.length === 0) {
        throw new Error('自定义字段定义未加载，无法保存字段值');
      }

      const unmatched = incomingCodes.filter((code) => !fields.some((f) => f.code === code));
      if (unmatched.length > 0) {
        throw new Error(`自定义字段未匹配到定义: ${unmatched.join(', ')}`);
      }

      const fieldValues: Array<{ field_uuid: string; value: unknown }> = [];
      for (const fieldCode of incomingCodes) {
        const field = fields.find((f) => f.code === fieldCode);
        if (!field) {
          throw new Error(`自定义字段未匹配到定义: ${fieldCode}`);
        }
        let value = customData[fieldCode];
        if (field.field_type === 'image' || field.field_type === 'file') {
          value = uploadFileListToCustomFieldValue(value, field.field_type);
        } else if (field.field_type === 'json') {
          value = normalizeJsonFieldValue(value);
        } else if (field.field_type === 'date') {
          if (value != null && value !== '') {
            const apiDate = toApiDateString(value);
            // 必须是纯日历日字符串；禁止把 dayjs 对象交给 JSON（toJSON→ISO Z 会偏一天）
            if (!apiDate || !/^\d{4}-\d{2}-\d{2}$/.test(apiDate)) {
              throw new Error(
                `自定义日期字段「${field.name || field.code}」无法格式化为 YYYY-MM-DD`,
              );
            }
            value = apiDate;
          } else {
            value = null;
          }
        } else if (field.field_type === 'datetime') {
          if (value != null && value !== '') {
            value = toApiDateTimeString(value) ?? null;
            if (value != null && typeof value !== 'string') {
              throw new Error(
                `自定义日期时间字段「${field.name || field.code}」格式无效`,
              );
            }
          } else {
            value = null;
          }
        } else if (field.field_type === 'time') {
          if (value != null && value !== '') {
            const format = field.config?.format || 'HH:mm:ss';
            if (dayjs.isDayjs(value)) {
              value = value.format(format);
            } else if (typeof value !== 'string') {
              const api = toApiDateTimeString(value);
              value = api ? api.slice(11, 19) : null;
            }
          }
        } else if (field.field_type === 'formula') {
          if (value == null || value === '') {
            continue;
          }
          const num = Number(value);
          value = Number.isFinite(num) ? num : null;
        }
        if (value === undefined) {
          value = null;
        }
        fieldValues.push({ field_uuid: field.uuid, value });
      }
      if (fieldValues.length === 0) return;
      await batchSetFieldValues({
        record_id: recordId,
        record_table: tableName,
        values: fieldValues as any[],
      });
    },
    [tableName, hostResource, customFields],
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
