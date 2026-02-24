/**
 * Formily Schema 编辑器组件
 * 
 * 用于配置 eSOP 节点的表单字段（Formily Schema）
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Form, Input, Select, InputNumber, Switch, Space, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ISchema } from '@formily/core';

const { TextArea } = Input;

/**
 * 表单字段配置接口
 */
interface FormFieldConfig {
  /**
   * 字段代码（唯一标识）
   */
  code: string;
  /**
   * 字段标签
   */
  label: string;
  /**
   * 字段类型
   */
  type: 'string' | 'number' | 'boolean' | 'date' | 'select';
  /**
   * 是否必填
   */
  required?: boolean;
  /**
   * 占位符
   */
  placeholder?: string;
  /**
   * 默认值
   */
  default?: any;
  /**
   * 字段描述
   */
  description?: string;
  /**
   * 组件类型（Formily 组件）
   */
  component?: string;
  /**
   * 组件属性
   */
  componentProps?: Record<string, any>;
  /**
   * 选项（用于 select 类型）
   */
  options?: Array<{ label: string; value: any }>;
  /**
   * 最小值（用于 number 类型）
   */
  min?: number;
  /**
   * 最大值（用于 number 类型）
   */
  max?: number;
  /**
   * 单位（用于 number 类型，如：N·m、℃、kg）
   */
  unit?: string;
  /**
   * 小数位数（用于 number 类型）
   */
  precision?: number;
}

/**
 * Formily Schema 编辑器组件属性
 */
interface FormSchemaEditorProps {
  /**
   * 当前 Schema（Formily Schema 格式）
   */
  value?: ISchema;
  /**
   * 变化回调
   */
  onChange?: (schema: ISchema) => void;
}

/**
 * Formily Schema 编辑器组件
 */
const FormSchemaEditor: React.FC<FormSchemaEditorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [editingField, setEditingField] = useState<FormFieldConfig | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [fieldForm] = Form.useForm();

  /**
   * 从 Schema 解析字段配置
   */
  useEffect(() => {
    if (value && value.properties) {
      const parsedFields: FormFieldConfig[] = [];
      Object.entries(value.properties).forEach(([code, fieldSchema]: [string, any]) => {
        // 解析验证规则
        const validators = fieldSchema['x-validator'] || [];
        let min: number | undefined;
        let max: number | undefined;
        
        validators.forEach((validator: any) => {
          if (validator.type === 'range') {
            min = validator.min;
            max = validator.max;
          }
        });
        
        parsedFields.push({
          code,
          label: fieldSchema.title || code,
          type: fieldSchema.type || 'string',
          required: fieldSchema.required || false,
          placeholder: fieldSchema.description || fieldSchema['x-component-props']?.placeholder,
          default: fieldSchema.default,
          description: fieldSchema.description,
          component: fieldSchema['x-component'] || 'Input',
          componentProps: fieldSchema['x-component-props'] || {},
          options: fieldSchema.enum ? fieldSchema.enum.map((val: any, idx: number) => ({
            label: fieldSchema.enumNames?.[idx] || val,
            value: val,
          })) : undefined,
          min,
          max,
          unit: fieldSchema['x-component-props']?.unit,
          precision: fieldSchema['x-component-props']?.precision,
        });
      });
      setFields(parsedFields);
    } else {
      setFields([]);
    }
  }, [value]);

  /**
   * 添加字段
   */
  const handleAddField = () => {
    setEditingField({
      code: '',
      label: '',
      type: 'string',
      required: false,
    });
    setEditingIndex(-1);
    fieldForm.resetFields();
    fieldForm.setFieldsValue({
      code: '',
      label: '',
      type: 'string',
      required: false,
      placeholder: '',
      component: 'Input',
    });
  };

  /**
   * 编辑字段
   */
  const handleEditField = (index: number) => {
    const field = fields[index];
    setEditingField(field);
    setEditingIndex(index);
    fieldForm.setFieldsValue({
      code: field.code,
      label: field.label,
      type: field.type,
      required: field.required || false,
      placeholder: field.placeholder || '',
      description: field.description || '',
      component: field.component || 'Input',
      default: field.default,
      min: field.min,
      max: field.max,
      unit: field.unit || '',
      precision: field.precision,
      options: field.options ? JSON.stringify(field.options, null, 2) : '',
    });
  };

  /**
   * 删除字段
   */
  const handleDeleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    updateSchema(newFields);
  };

  /**
   * 保存字段配置
   */
  const handleSaveField = () => {
    fieldForm.validateFields().then((values) => {
      const newField: FormFieldConfig = {
        code: values.code,
        label: values.label,
        type: values.type,
        required: values.required || false,
        placeholder: values.placeholder,
        description: values.description,
        component: values.component || 'Input',
        default: values.default,
        min: values.min,
        max: values.max,
        unit: values.unit,
        precision: values.precision,
      };

      // 如果是 select 类型，需要配置选项
      if (values.type === 'select' && values.options) {
        try {
          newField.options = JSON.parse(values.options);
        } catch {
          message.error(t('app.master-data.formSchema.optionsFormatErrorMsg'));
          return;
        }
      }

      // 如果是数字类型，设置默认组件
      if (values.type === 'number' && !newField.component) {
        newField.component = 'InputNumber';
      }

      let newFields: FormFieldConfig[];
      if (editingIndex >= 0) {
        // 更新现有字段
        newFields = fields.map((f, i) => (i === editingIndex ? newField : f));
      } else {
        // 添加新字段
        // 检查代码是否已存在
        if (fields.some((f) => f.code === newField.code)) {
          message.error(t('app.master-data.formSchema.fieldCodeExists'));
          return;
        }
        newFields = [...fields, newField];
      }

      setFields(newFields);
      updateSchema(newFields);
      setEditingField(null);
      setEditingIndex(-1);
      message.success(editingIndex >= 0 ? t('app.master-data.formSchema.fieldUpdated') : t('app.master-data.formSchema.fieldAdded'));
    });
  };

  /**
   * 更新 Schema
   */
  const updateSchema = (fieldList: FormFieldConfig[]) => {
    const properties: Record<string, any> = {};

    fieldList.forEach((field) => {
      const fieldSchema: any = {
        type: field.type,
        title: field.label,
        'x-decorator': 'FormItem',
        'x-component': field.component || getDefaultComponent(field.type),
        'x-component-props': {
          placeholder: field.placeholder || t('app.master-data.formSchema.enterPlaceholder', { label: field.label }),
          ...(field.componentProps || {}),
        },
      };

      if (field.required) {
        fieldSchema.required = true;
      }

      if (field.description) {
        fieldSchema.description = field.description;
      }

      if (field.default !== undefined && field.default !== null) {
        fieldSchema.default = field.default;
      }

      // 处理 select 类型的选项
      if (field.type === 'select' && field.options) {
        fieldSchema.enum = field.options.map((opt) => opt.value);
        fieldSchema.enumNames = field.options.map((opt) => opt.label);
      }

      // 根据类型设置组件属性
      switch (field.type) {
        case 'string':
          if (field.component === 'Input.TextArea') {
            fieldSchema['x-component'] = 'Input.TextArea';
            fieldSchema['x-component-props'] = {
              ...fieldSchema['x-component-props'],
              rows: 4,
            };
          }
          break;
        case 'number':
          fieldSchema['x-component'] = 'InputNumber';
          // 配置数字类型的属性
          const numberProps: any = {};
          if (field.unit) {
            numberProps.unit = field.unit;
          }
          if (field.precision !== undefined) {
            numberProps.precision = field.precision;
          }
          if (field.min !== undefined) {
            numberProps.min = field.min;
          }
          if (field.max !== undefined) {
            numberProps.max = field.max;
          }
          fieldSchema['x-component-props'] = {
            ...fieldSchema['x-component-props'],
            ...numberProps,
          };
          // 添加范围验证规则
          if (field.min !== undefined || field.max !== undefined) {
            fieldSchema['x-validator'] = [
              {
                type: 'range',
                min: field.min,
                max: field.max,
              },
            ];
          }
          break;
        case 'date':
          fieldSchema['x-component'] = 'DatePicker';
          fieldSchema['x-component-props'] = {
            ...fieldSchema['x-component-props'],
            format: 'YYYY-MM-DD',
          };
          break;
        case 'boolean':
          fieldSchema['x-component'] = 'Switch';
          break;
      }

      properties[field.code] = fieldSchema;
    });

    const schema: ISchema = {
      type: 'object',
      properties,
    };

    onChange?.(schema);
  };

  /**
   * 获取默认组件
   */
  const getDefaultComponent = (type: string): string => {
    const componentMap: Record<string, string> = {
      string: 'Input',
      number: 'InputNumber',
      boolean: 'Switch',
      date: 'DatePicker',
      select: 'Select',
    };
    return componentMap[type] || 'Input';
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{t('app.master-data.formSchema.fieldConfig')}</strong>
          <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
            {t('app.master-data.formSchema.fieldCount', { count: fields.length })}
          </span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddField}>
          {t('app.master-data.formSchema.addField')}
        </Button>
      </div>

      {fields.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          {fields.map((field, index) => (
            <Card
              key={field.code}
              size="small"
              style={{ marginBottom: 8 }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {field.label} ({field.code})
                    {field.required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
                  </span>
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleEditField(index)}
                    >
                      {t('app.master-data.formSchema.edit')}
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteField(index)}
                    >
                      {t('app.master-data.formSchema.delete')}
                    </Button>
                  </Space>
                </div>
              }
            >
              <div style={{ fontSize: 12, color: '#666' }}>
                <div>{t('app.master-data.formSchema.type')}: {field.type}</div>
                {field.description && <div>{t('app.master-data.formSchema.description')}: {field.description}</div>}
                {field.component && <div>{t('app.master-data.formSchema.component')}: {field.component}</div>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', background: '#f5f5f5', borderRadius: 4, color: '#999' }}>
          {t('app.master-data.formSchema.noFields')}
        </div>
      )}

      {/* 字段编辑 Modal */}
      <Modal
        title={editingIndex >= 0 ? t('app.master-data.formSchema.editField') : t('app.master-data.formSchema.addFieldTitle')}
        open={editingField !== null}
        onCancel={() => {
          setEditingField(null);
          setEditingIndex(-1);
        }}
        onOk={handleSaveField}
        width={600}
      >
        <Form form={fieldForm} layout="vertical">
          <Form.Item
            name="code"
            label={t('app.master-data.formSchema.fieldCode')}
            rules={[
              { required: true, message: t('app.master-data.formSchema.fieldCodeRequired') },
              { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: t('app.master-data.formSchema.fieldCodePattern') },
            ]}
          >
            <Input
              placeholder={t('app.master-data.formSchema.fieldCodePlaceholder')}
              disabled={editingIndex >= 0}
            />
          </Form.Item>
          <Form.Item
            name="label"
            label={t('app.master-data.formSchema.fieldLabel')}
            rules={[{ required: true, message: t('app.master-data.formSchema.fieldLabelRequired') }]}
          >
            <Input placeholder={t('app.master-data.formSchema.fieldLabelPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('app.master-data.formSchema.fieldType')}
            rules={[{ required: true, message: t('app.master-data.formSchema.fieldTypeRequired') }]}
          >
            <Select>
              <Select.Option value="string">{t('app.master-data.formSchema.typeString')}</Select.Option>
              <Select.Option value="number">{t('app.master-data.formSchema.typeNumber')}</Select.Option>
              <Select.Option value="boolean">{t('app.master-data.formSchema.typeBoolean')}</Select.Option>
              <Select.Option value="date">{t('app.master-data.formSchema.typeDate')}</Select.Option>
              <Select.Option value="select">{t('app.master-data.formSchema.typeSelect')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="component"
            label={t('app.master-data.formSchema.componentType')}
            rules={[{ required: true, message: t('app.master-data.formSchema.componentTypeRequired') }]}
          >
            <Select>
              <Select.Option value="Input">{t('app.master-data.formSchema.compInput')}</Select.Option>
              <Select.Option value="Input.TextArea">{t('app.master-data.formSchema.compTextArea')}</Select.Option>
              <Select.Option value="InputNumber">{t('app.master-data.formSchema.compInputNumber')}</Select.Option>
              <Select.Option value="DatePicker">{t('app.master-data.formSchema.compDatePicker')}</Select.Option>
              <Select.Option value="Select">{t('app.master-data.formSchema.compSelect')}</Select.Option>
              <Select.Option value="Switch">{t('app.master-data.formSchema.compSwitch')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="required" label={t('app.master-data.formSchema.required')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="placeholder" label={t('app.master-data.formSchema.placeholder')}>
            <Input placeholder={t('app.master-data.formSchema.placeholderInput')} />
          </Form.Item>
          <Form.Item name="description" label={t('app.master-data.formSchema.fieldDescription')}>
            <TextArea rows={2} placeholder={t('app.master-data.formSchema.fieldDescriptionPlaceholder')} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'select') {
                return (
                  <Form.Item
                    name="options"
                    label={t('app.master-data.formSchema.optionsJson')}
                    rules={[
                      { required: true, message: t('app.master-data.formSchema.optionsRequired') },
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          try {
                            const parsed = JSON.parse(value);
                            if (!Array.isArray(parsed)) {
                              return Promise.reject(new Error(t('app.master-data.formSchema.optionsMustBeArray')));
                            }
                            if (parsed.some((item) => !item.label || item.value === undefined)) {
                              return Promise.reject(new Error(t('app.master-data.formSchema.optionsFormatError')));
                            }
                            return Promise.resolve();
                          } catch {
                            return Promise.reject(new Error(t('app.master-data.formSchema.optionsJsonError')));
                          }
                        },
                      },
                    ]}
                    tooltip={t('app.master-data.formSchema.optionsTooltip')}
                  >
                    <TextArea
                      rows={4}
                      placeholder={t('app.master-data.formSchema.optionsPlaceholder')}
                    />
                  </Form.Item>
                );
              }
              if (type === 'number') {
                return (
                  <>
                    <Form.Item
                      name="min"
                      label={t('app.master-data.formSchema.minValue')}
                    >
                      <InputNumber placeholder={t('app.master-data.formSchema.minPlaceholder')} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="max"
                      label={t('app.master-data.formSchema.maxValue')}
                    >
                      <InputNumber placeholder={t('app.master-data.formSchema.maxPlaceholder')} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="unit"
                      label={t('app.master-data.formSchema.unit')}
                    >
                      <Input placeholder={t('app.master-data.formSchema.unitPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      name="precision"
                      label={t('app.master-data.formSchema.precision')}
                    >
                      <InputNumber min={0} max={10} placeholder={t('app.master-data.formSchema.precisionPlaceholder')} style={{ width: '100%' }} />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FormSchemaEditor;

