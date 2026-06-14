/**
 * 自定义字段表单区块
 *
 * 在 ProForm 内渲染自定义字段，与 useCustomFields hook 配合使用。
 * 支持 text、number、date、select、textarea、json、image、file、associated_object 等类型。
 */

import React from 'react';
import {
  ProFormText,
  ProFormTextArea,
  ProFormDigit,
  ProFormDatePicker,
  ProFormTimePicker,
  ProFormDateTimePicker,
  ProFormUploadButton,
} from '@ant-design/pro-components';
import { App, Col, Upload } from 'antd';
import SafeProFormSelect from '../safe-pro-form-select';
import { AssociatedObjectSelect } from './AssociatedObjectSelect';
import type { CustomField } from '../../services/customField';
import { uploadMultipleFiles } from '../../services/file';
import {
  buildCustomFieldAccept,
  makeCustomFieldBeforeUpload,
  normalizeUploadFileList,
} from './customFieldFileUtils';
import { CustomFieldJsonFormItem } from './CustomFieldJsonFormItem';
import { CustomFieldFormLabel } from './CustomFieldFormLabel';

const CUSTOM_PREFIX = 'custom_';

/** 与 Ant Design 24 栅格对齐：4 栏 → span 6，2 栏 → span 12 */
export type CustomFieldGridColumns = 1 | 2 | 3 | 4;

const GRID_COL_SPAN: Record<CustomFieldGridColumns, number> = {
  1: 24,
  2: 12,
  3: 8,
  4: 6,
};

const FULL_ROW_COL_SPAN = 24;

const resolveFieldColSpan = (
  fieldType: CustomField['field_type'],
  gridColumns: CustomFieldGridColumns,
) => {
  if (fieldType === 'textarea' || fieldType === 'image' || fieldType === 'file' || fieldType === 'json') {
    return FULL_ROW_COL_SPAN;
  }
  return GRID_COL_SPAN[gridColumns];
};

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
  /**
   * 与父表单栏位数对齐（默认 2 栏半宽）。
   * 例如父表单 Row 使用 Col span={6} 时为 4 栏，传 gridColumns={4}。
   */
  gridColumns?: CustomFieldGridColumns;
}

export const CustomFieldsFormSection: React.FC<CustomFieldsFormSectionProps> = ({
  customFields,
  customFieldValues,
  gridColumns = 2,
}) => {
  const { message: messageApi } = App.useApp();

  if (customFields.length === 0) return null;

  const sortedFields = customFields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const renderLabel = (text: string) => <CustomFieldFormLabel text={text} />;

  const renderFieldControl = (field: CustomField, colSpan: number) => {
    const fieldName = `${CUSTOM_PREFIX}${field.code}`;
    const label = field.label || field.name;
    const labelNode = renderLabel(label);
    const placeholder = field.placeholder || `请输入${label}`;
    const initialVal = customFieldValues[field.code] ?? field.config?.default;
    const uploadInitialVal = normalizeUploadFileList(initialVal);
    const rules = field.is_required ? [{ required: true, message: `请输入${label}` }] : [];

    switch (field.field_type) {
      case 'text':
        return (
          <ProFormText
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={{ span: colSpan }}
            fieldProps={{ maxLength: field.config?.maxLength, style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'number':
        return (
          <ProFormDigit
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={{ span: colSpan }}
            fieldProps={{ min: field.config?.min, max: field.config?.max, style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'date':
        return (
          <ProFormDatePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            colProps={{ span: colSpan }}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={{ format: field.config?.format || 'YYYY-MM-DD', style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'time':
        return (
          <ProFormTimePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            colProps={{ span: colSpan }}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={{ format: field.config?.format || 'HH:mm:ss', style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'datetime':
        return (
          <ProFormDateTimePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            colProps={{ span: colSpan }}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={{ format: field.config?.format || 'YYYY-MM-DD HH:mm:ss', style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'select':
        return (
          <SafeProFormSelect
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={{ span: colSpan }}
            options={safeOptions(field.config?.options)}
            initialValue={initialVal}
            fieldProps={{ style: { width: '100%' } }}
          />
        );
      case 'textarea':
        return (
          <ProFormTextArea
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={{ span: colSpan }}
            fieldProps={{ rows: field.config?.rows || 4, style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
      case 'associated_object':
        return (
          <AssociatedObjectSelect
            field={field}
            name={fieldName}
            label={labelNode}
            labelText={label}
            placeholder={placeholder}
            required={field.is_required}
            initialValue={initialVal}
            colProps={{ span: colSpan }}
          />
        );
      case 'image':
        return (
          <ProFormUploadButton
            name={fieldName}
            label={labelNode}
            max={1}
            colProps={{ span: colSpan }}
            rules={field.is_required ? [{ required: true, message: `请上传${label}` }] : []}
            initialValue={uploadInitialVal}
            fieldProps={{
              listType: 'picture-card',
              accept: buildCustomFieldAccept(field.config?.allowedTypes, '.jpg,.jpeg,.png,.gif,.webp'),
              beforeUpload: (file) => {
                const ok = makeCustomFieldBeforeUpload(
                  field.config?.allowedTypes,
                  field.config?.maxSize,
                  (msg) => messageApi.error(msg),
                )(file as File);
                return ok === false ? Upload.LIST_IGNORE : ok;
              },
              customRequest: async (options) => {
                try {
                  const res = await uploadMultipleFiles([options.file as File], {
                    category: 'custom_field_image',
                  });
                  options.onSuccess?.(res[0], options.file as any);
                } catch (err) {
                  options.onError?.(err as Error);
                }
              },
            }}
          />
        );
      case 'file':
        return (
          <ProFormUploadButton
            name={fieldName}
            label={labelNode}
            max={10}
            colProps={{ span: colSpan }}
            rules={field.is_required ? [{ required: true, message: `请上传${label}` }] : []}
            initialValue={uploadInitialVal}
            fieldProps={{
              multiple: true,
              accept: buildCustomFieldAccept(field.config?.allowedTypes, '.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar'),
              beforeUpload: (file) => {
                const ok = makeCustomFieldBeforeUpload(
                  field.config?.allowedTypes,
                  field.config?.maxSize,
                  (msg) => messageApi.error(msg),
                )(file as File);
                return ok === false ? Upload.LIST_IGNORE : ok;
              },
              customRequest: async (options) => {
                try {
                  const res = await uploadMultipleFiles([options.file as File], {
                    category: 'custom_field_file',
                  });
                  options.onSuccess?.(res[0], options.file as any);
                } catch (err) {
                  options.onError?.(err as Error);
                }
              },
            }}
          />
        );
      case 'json':
        return (
          <CustomFieldJsonFormItem
            name={fieldName}
            label={labelNode}
            labelText={label}
            placeholder={field.placeholder || `例如：{"key": "value"}`}
            initialValue={initialVal}
            required={field.is_required}
          />
        );
      default:
        return (
          <ProFormText
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={{ span: colSpan }}
            fieldProps={{ style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
    }
  };

  return (
    <>
      {sortedFields.map((field) => {
        const colSpan = resolveFieldColSpan(field.field_type, gridColumns);
        const control = renderFieldControl(field, colSpan);
        // ProFormItem（JSON）不参与 ProForm 格栅，需外层 Col 保证全宽与左对齐
        if (field.field_type === 'json') {
          return (
            <Col key={field.uuid} span={FULL_ROW_COL_SPAN}>
              {control}
            </Col>
          );
        }
        return <React.Fragment key={field.uuid}>{control}</React.Fragment>;
      })}
    </>
  );
};
