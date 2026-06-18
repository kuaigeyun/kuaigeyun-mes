/**
 * 自定义字段表单区块
 *
 * 在 ProForm 内渲染自定义字段，与 useCustomFields hook 配合使用。
 * 布局与栏宽由 customFieldFormLayout（.ts + .less）唯一控制。
 *
 * ProForm grid={true}：字段带 colProps，直接参与父级 Row（与页面其它字段同一栅格）。
 * embedInParentRow：仅输出 Col，嵌在页面已有 Row 内。
 * 默认（独立一行）：与页面其它 Row 同级，输出单个 Row gutter={16}。
 */

import React, { useContext } from 'react';
import {
  ProFormText,
  ProFormTextArea,
  ProFormDigit,
  ProFormDatePicker,
  ProFormTimePicker,
  ProFormDateTimePicker,
  ProFormUploadButton,
  ProFormField,
} from '@ant-design/pro-components';
import { GridContext } from '@ant-design/pro-form';
import { App, Col, Row, Upload } from 'antd';
import SafeProFormSelect from '../safe-pro-form-select';
import { AssociatedObjectField } from './AssociatedObjectField';
import { AssociatedAttributeField } from './AssociatedAttributeField';
import type { CustomField } from '../../services/customField';
import { uploadMultipleFiles } from '../../services/file';
import {
  buildCustomFieldAccept,
  makeCustomFieldBeforeUpload,
  normalizeUploadFileList,
} from './customFieldFileUtils';
import { CustomFieldJsonFormItem } from './CustomFieldJsonFormItem';
import { CustomFieldFormulaFormItem } from './CustomFieldFormulaFormItem';
import { CustomFieldFormLabel } from './CustomFieldFormLabel';
import {
  CUSTOM_FIELD_FORM_CLASS_NAMES,
  customFieldControlLayout,
  customFieldFieldProps,
  inferCustomFieldGridColumns,
  resolveCustomFieldColSpan,
  type CustomFieldGridColumns,
} from './customFieldFormLayout';
import { FORM_LAYOUT } from '../layout-templates/constants';
import './customFieldFormLayout.less';

const CUSTOM_PREFIX = 'custom_';

export type { CustomFieldGridColumns };
export { inferCustomFieldGridColumns as inferFormGridColumns };

const safeOptions = (options: any): Array<{ label: string; value: any }> => {
  if (!Array.isArray(options)) return [];
  return options.map((opt: any) => ({
    label: opt.label ?? opt.title ?? opt.name ?? String(opt.value ?? ''),
    value: opt.value ?? opt.id ?? opt.code,
  }));
};

export interface CustomFieldsFormSectionProps {
  customFields: CustomField[];
  customFieldValues: Record<string, any>;
  /** 与父表单栏位数对齐（默认 2 栏半宽） */
  gridColumns?: CustomFieldGridColumns;
  /** 嵌在父级 Row 内时设为 true，仅输出 Col 片段 */
  embedInParentRow?: boolean;
}

export const CustomFieldsFormSection: React.FC<CustomFieldsFormSectionProps> = ({
  customFields,
  customFieldValues,
  gridColumns = 2,
  embedInParentRow = false,
}) => {
  const { message: messageApi } = App.useApp();
  const gridContext = useContext(GridContext);
  const useParentProFormGrid = !!gridContext?.grid;

  if (customFields.length === 0) return null;

  const sortedFields = customFields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const renderFieldControl = (field: CustomField, colSpan: number) => {
    const fieldName = `${CUSTOM_PREFIX}${field.code}`;
    const label = field.label || field.name;
    const labelNode = <CustomFieldFormLabel text={label} />;
    const placeholder = field.placeholder || `请输入${label}`;
    const initialVal = customFieldValues[field.code] ?? field.config?.default;
    const uploadInitialVal = normalizeUploadFileList(initialVal);
    const rules = field.is_required ? [{ required: true, message: `请输入${label}` }] : [];
    const layout = customFieldControlLayout(useParentProFormGrid ? { span: colSpan } : undefined);
    const colProps = useParentProFormGrid ? { span: colSpan } : undefined;

    switch (field.field_type) {
      case 'text':
        return (
          <ProFormText
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            {...layout}
            fieldProps={customFieldFieldProps({ maxLength: field.config?.maxLength })}
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
            {...layout}
            fieldProps={customFieldFieldProps({ min: field.config?.min, max: field.config?.max })}
            initialValue={initialVal}
          />
        );
      case 'date':
        return (
          <ProFormDatePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            {...layout}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={customFieldFieldProps({ format: field.config?.format || 'YYYY-MM-DD' })}
            initialValue={initialVal}
          />
        );
      case 'time':
        return (
          <ProFormTimePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            {...layout}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={customFieldFieldProps({ format: field.config?.format || 'HH:mm:ss' })}
            initialValue={initialVal}
          />
        );
      case 'datetime':
        return (
          <ProFormDateTimePicker
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            {...layout}
            rules={field.is_required ? [{ required: true, message: `请选择${label}` }] : []}
            fieldProps={customFieldFieldProps({ format: field.config?.format || 'YYYY-MM-DD HH:mm:ss' })}
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
            {...layout}
            options={safeOptions(field.config?.options)}
            initialValue={initialVal}
            fieldProps={customFieldFieldProps()}
          />
        );
      case 'multiselect':
        return (
          <SafeProFormSelect
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={
              field.is_required
                ? [{ required: true, type: 'array', min: 1, message: `请选择${label}` }]
                : []
            }
            {...layout}
            options={safeOptions(field.config?.options)}
            initialValue={
              Array.isArray(initialVal) ? initialVal : initialVal != null && initialVal !== '' ? [initialVal] : undefined
            }
            fieldProps={customFieldFieldProps({ mode: 'multiple' })}
          />
        );
      case 'textarea':
        return (
          <ProFormTextArea
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            {...layout}
            fieldProps={customFieldFieldProps({ rows: field.config?.rows || 4 })}
            initialValue={initialVal}
          />
        );
      case 'associated_object':
        return (
          <AssociatedObjectField
            field={field}
            name={fieldName}
            label={labelNode}
            labelText={label}
            placeholder={placeholder}
            required={field.is_required}
            initialValue={initialVal}
            colProps={colProps}
          />
        );
      case 'associated_attribute':
        return (
          <AssociatedAttributeField
            field={field}
            name={fieldName}
            label={labelNode}
            initialValue={initialVal}
            colProps={colProps}
          />
        );
      case 'image':
        return (
          <ProFormUploadButton
            name={fieldName}
            label={labelNode}
            max={1}
            colProps={colProps}
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
            colProps={colProps}
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
      case 'json': {
        const jsonItem = (
          <CustomFieldJsonFormItem
            name={fieldName}
            label={labelNode}
            labelText={label}
            placeholder={field.placeholder || `例如：{"key": "value"}`}
            initialValue={initialVal}
            required={field.is_required}
          />
        );
        if (useParentProFormGrid) {
          return (
            <ProFormField
              colProps={{ span: colSpan }}
              formItemProps={{ style: { marginBottom: 0 } }}
              renderFormItem={() => jsonItem}
            />
          );
        }
        return jsonItem;
      }
      case 'formula':
        return (
          <CustomFieldFormulaFormItem
            name={fieldName}
            label={labelNode}
            expression={field.config?.expression}
            initialValue={typeof initialVal === 'number' ? initialVal : Number(initialVal) || undefined}
            colProps={colProps}
          />
        );
      default:
        return (
          <ProFormText
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            {...layout}
            fieldProps={customFieldFieldProps()}
            initialValue={initialVal}
          />
        );
    }
  };

  const fieldCols = sortedFields.map((field) => {
    const colSpan = resolveCustomFieldColSpan(field.field_type, gridColumns);
    return (
      <Col key={field.uuid} span={colSpan} className={CUSTOM_FIELD_FORM_CLASS_NAMES.fieldCol}>
        {renderFieldControl(field, colSpan)}
      </Col>
    );
  });

  if (useParentProFormGrid) {
    return (
      <>
        {sortedFields.map((field) => {
          const colSpan = resolveCustomFieldColSpan(field.field_type, gridColumns);
          return (
            <React.Fragment key={field.uuid}>
              {renderFieldControl(field, colSpan)}
            </React.Fragment>
          );
        })}
      </>
    );
  }

  if (embedInParentRow) {
    return <>{fieldCols}</>;
  }

  return <Row gutter={FORM_LAYOUT.GRID_GUTTER}>{fieldCols}</Row>;
};
