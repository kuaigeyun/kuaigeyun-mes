/**
 * 自定义字段表单区块
 *
 * 在 ProForm 内渲染自定义字段，与 useCustomFields hook 配合使用。
 * 支持 text、number、date、select、textarea、json、image、file、associated_object、associated_attribute、formula 等类型。
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
  ProFormField,
} from '@ant-design/pro-components';
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
import { FORM_LAYOUT } from '../layout-templates/constants';

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

const isFullRowFieldType = (fieldType: CustomField['field_type']) =>
  fieldType === 'textarea' || fieldType === 'image' || fieldType === 'file' || fieldType === 'json';

/** 从表单 schema 推断栏位数（24 栅格：colSpan 12 → 2 栏，6 → 4 栏） */
export function inferFormGridColumns(
  schema: Array<{ type?: string; colSpan?: number }>,
): CustomFieldGridColumns {
  const spans = schema
    .filter((field) => field.type !== 'slot' && (field.colSpan ?? 12) < FULL_ROW_COL_SPAN)
    .map((field) => field.colSpan ?? 12);
  if (spans.length === 0) return 2;

  const counts = new Map<number, number>();
  for (const span of spans) {
    counts.set(span, (counts.get(span) ?? 0) + 1);
  }
  let dominantSpan = 12;
  let dominantCount = 0;
  for (const [span, count] of counts) {
    if (count > dominantCount) {
      dominantSpan = span;
      dominantCount = count;
    }
  }

  const columns = FULL_ROW_COL_SPAN / dominantSpan;
  if (columns === 1 || columns === 2 || columns === 3 || columns === 4) {
    return columns as CustomFieldGridColumns;
  }
  return 2;
}

const resolveFieldColSpan = (
  fieldType: CustomField['field_type'],
  gridColumns: CustomFieldGridColumns,
) => {
  if (isFullRowFieldType(fieldType)) {
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
  /**
   * proform：ProForm grid 子项，字段带 colProps（FormModalTemplate grid=true / SchemaFormRenderer）
   * col：父级 Row 内的 Col 片段，与手动 Col span 布局一致（如销售订单头字段）
   * nested：自带 Row+Col，独立成段（默认，用于 Row 外的区块）
   */
  gridMode?: 'proform' | 'col' | 'nested';
  /**
   * proform 模式下是否自带 Row 包裹。
   * col / nested 模式忽略此属性。
   */
  wrapInRow?: boolean;
}

export const CustomFieldsFormSection: React.FC<CustomFieldsFormSectionProps> = ({
  customFields,
  customFieldValues,
  gridColumns = 2,
  gridMode = 'nested',
  wrapInRow = true,
}) => {
  const { message: messageApi } = App.useApp();
  const useColProps = gridMode === 'proform';

  if (customFields.length === 0) return null;

  const sortedFields = customFields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const renderLabel = (text: string) => <CustomFieldFormLabel text={text} />;

  const renderFieldControl = (field: CustomField, colSpan: number) => {
    const effectiveColSpan = isFullRowFieldType(field.field_type) ? FULL_ROW_COL_SPAN : colSpan;
    const colProps = useColProps ? { span: effectiveColSpan } : undefined;
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
            colProps={colProps}
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
            colProps={colProps}
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
            colProps={colProps}
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
            colProps={colProps}
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
            colProps={colProps}
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
            colProps={colProps}
            options={safeOptions(field.config?.options)}
            initialValue={initialVal}
            fieldProps={{ style: { width: '100%' } }}
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
            colProps={colProps}
            options={safeOptions(field.config?.options)}
            initialValue={
              Array.isArray(initialVal) ? initialVal : initialVal != null && initialVal !== '' ? [initialVal] : undefined
            }
            fieldProps={{ mode: 'multiple', style: { width: '100%' } }}
          />
        );
      case 'textarea':
        return (
          <ProFormTextArea
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={colProps}
            fieldProps={{ rows: field.config?.rows || 4, style: { width: '100%' } }}
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
            colProps={colProps ?? { span: colSpan }}
          />
        );
      case 'associated_attribute':
        return (
          <AssociatedAttributeField
            field={field}
            name={fieldName}
            label={labelNode}
            initialValue={initialVal}
            colProps={colProps ?? { span: colSpan }}
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
        if (useColProps) {
          return (
            <ProFormField
              colProps={{ span: FULL_ROW_COL_SPAN }}
              formItemProps={{ style: { marginBottom: 0 } }}
              renderFormItem={() => <div style={{ width: '100%' }}>{jsonItem}</div>}
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
            colProps={colProps ?? { span: colSpan }}
          />
        );
      default:
        return (
          <ProFormText
            name={fieldName}
            label={labelNode}
            placeholder={placeholder}
            rules={rules}
            colProps={colProps}
            fieldProps={{ style: { width: '100%' } }}
            initialValue={initialVal}
          />
        );
    }
  };

  const renderColFields = () =>
    sortedFields.map((field) => {
      const colSpan = resolveFieldColSpan(field.field_type, gridColumns);
      const effectiveColSpan = isFullRowFieldType(field.field_type) ? FULL_ROW_COL_SPAN : colSpan;
      return (
        <Col key={field.uuid} span={effectiveColSpan}>
          {renderFieldControl(field, effectiveColSpan)}
        </Col>
      );
    });

  if (gridMode === 'col') {
    return <>{renderColFields()}</>;
  }

  if (gridMode === 'proform') {
    const fieldNodes = sortedFields.map((field) => {
      const colSpan = resolveFieldColSpan(field.field_type, gridColumns);
      return (
        <React.Fragment key={field.uuid}>
          {renderFieldControl(field, colSpan)}
        </React.Fragment>
      );
    });

    if (wrapInRow) {
      return (
        <Row gutter={FORM_LAYOUT.GRID_GUTTER} style={{ width: '100%' }}>
          {fieldNodes}
        </Row>
      );
    }

    return <>{fieldNodes}</>;
  }

  return (
    <Row gutter={FORM_LAYOUT.GRID_GUTTER} style={{ width: '100%' }}>
      {renderColFields()}
    </Row>
  );
};
