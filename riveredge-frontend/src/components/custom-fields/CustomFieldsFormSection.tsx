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
import { Tag, Col } from 'antd';
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
        
        // 统一包裹在 Col 中以确保对齐一致
        const colProps = { span: field.field_type === 'textarea' ? 24 : 6, style: { minWidth: 0 } };

        let component;
        switch (field.field_type) {
          case 'text':
            component = (
              <ProFormText
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={rules}
                fieldProps={{ maxLength: field.config?.maxLength }}
                initialValue={initialVal}
              />
            );
            break;
          case 'number':
            component = (
              <ProFormDigit
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={rules}
                fieldProps={{ min: field.config?.min, max: field.config?.max }}
                initialValue={initialVal}
              />
            );
            break;
          case 'date':
            component = (
              <ProFormDatePicker
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
                fieldProps={{ format: field.config?.format || 'YYYY-MM-DD', style: { width: '100%' } }}
                initialValue={initialVal}
              />
            );
            break;
          case 'select':
            component = (
              <SafeProFormSelect
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={rules}
                options={safeOptions(field.config?.options)}
                initialValue={initialVal}
                fieldProps={{ style: { width: '100%' } }}
              />
            );
            break;
          case 'textarea':
            component = (
              <ProFormTextArea
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={rules}
                fieldProps={{ rows: field.config?.rows || 4 }}
                initialValue={initialVal}
              />
            );
            break;
          case 'associated_object':
            component = (
              <AssociatedObjectSelect
                field={field}
                name={fieldName}
                label={labelNode}
                labelText={label}
                placeholder={placeholder}
                required={field.is_required}
                initialValue={initialVal}
              />
            );
            break;
          default:
            component = (
              <ProFormText
                name={fieldName}
                label={labelNode}
                placeholder={placeholder}
                rules={rules}
                initialValue={initialVal}
              />
            );
        }

        return (
          <Col key={field.uuid} {...colProps}>
            {component}
          </Col>
        );
      })}
    </>
  );
};
