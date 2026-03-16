/**
 * 自定义字段表单区块
 *
 * 在 ProForm 内渲染自定义字段，与 useCustomFields hook 配合使用。
 * 支持 text、number、date、select、textarea、associated_object 等类型。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProFormText,
  ProFormTextArea,
  ProFormDigit,
  ProFormDatePicker,
} from '@ant-design/pro-components';
import { Tag } from 'antd';
import SafeProFormSelect from '../safe-pro-form-select';
import { AssociatedObjectSelect } from './AssociatedObjectSelect';
import type { CustomField } from '../../services/customField';

const CUSTOM_PREFIX = 'custom_';

const safeOptions = (options: any): Array<{ label: string; value: any }> => {
  if (!Array.isArray(options)) return [];
  return options.map((opt: any) => ({
    label: opt.label ?? opt.title ?? opt.name ?? String(opt.value ?? ''),
    value: opt.value ?? opt.id ?? opt.code,
  }));
};

export interface CustomFieldsFormSectionProps {
  /** 自定义字段列表（来自 useCustomFields） */
  customFields: CustomField[];
  /** 当前字段值（编辑时回填，key 为 field.code） */
  customFieldValues: Record<string, any>;
}

export const CustomFieldsFormSection: React.FC<CustomFieldsFormSectionProps> = ({
  customFields,
  customFieldValues,
}) => {
  const { t } = useTranslation();

  if (customFields.length === 0) return null;

  const sortedFields = customFields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const renderLabel = (text: string) => (
    <span>
      {text}
      <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>{t('app.master-data.customFields')}</Tag>
    </span>
  );

  return (
    <>
      {sortedFields.map((field) => {
        const fieldName = `${CUSTOM_PREFIX}${field.code}`;
        const label = field.label || field.name;
        const labelNode = renderLabel(label);
        const placeholder = field.placeholder || `请输入${label}`;
        const initialVal = customFieldValues[field.code] ?? field.config?.default;
        const rules = field.is_required ? [{ required: true, message: `请输入${label}` }] : [];

        switch (field.field_type) {
          case 'text':
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={rules}
                fieldProps={{ maxLength: field.config?.maxLength }}
                initialValue={initialVal}
              />
            );
          case 'number':
            return (
              <ProFormDigit
                key={field.uuid}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={rules}
                fieldProps={{ min: field.config?.min, max: field.config?.max }}
                initialValue={initialVal}
              />
            );
          case 'date':
            return (
              <ProFormDatePicker
                key={field.uuid}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                fieldProps={{ format: field.config?.format || 'YYYY-MM-DD' }}
                initialValue={initialVal}
              />
            );
          case 'select':
            return (
              <SafeProFormSelect
                key={`${field.uuid}-${JSON.stringify(safeOptions(field.config?.options))}`}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={rules}
                options={safeOptions(field.config?.options)}
                initialValue={initialVal}
              />
            );
          case 'textarea':
            return (
              <ProFormTextArea
                key={field.uuid}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 24 }}
                rules={rules}
                fieldProps={{ rows: field.config?.rows || 4 }}
                initialValue={initialVal}
              />
            );
          case 'associated_object':
            return (
              <AssociatedObjectSelect
                key={field.uuid}
                field={field}
                name={fieldName}
                label={labelNode}
                labelText={label}
                placeholder={placeholder}
                required={field.is_required}
                colProps={{ span: 12 }}
                initialValue={initialVal}
              />
            );
          default:
            return (
              <ProFormText
                key={field.uuid}
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                colProps={{ span: 12 }}
                rules={rules}
                initialValue={initialVal}
              />
            );
        }
      })}
    </>
  );
};
