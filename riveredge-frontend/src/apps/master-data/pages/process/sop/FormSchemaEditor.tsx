/**
 * Formily Schema 编辑器组件
 * 
 * 用于配置 eSOP 节点的表单字段（Formily Schema）
 */

import React, { useState, useEffect } from 'react';
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
          message.error('选项格式错误，请输入有效的 JSON 数组');
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
          message.error('字段代码已存在');
          return;
        }
        newFields = [...fields, newField];
      }

      setFields(newFields);
      updateSchema(newFields);
      setEditingField(null);
      setEditingIndex(-1);
      message.success(editingIndex >= 0 ? '字段已更新' : '字段已添加');
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
          placeholder: field.placeholder || `请输入${field.label}`,
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
          <strong>表单字段配置</strong>
          <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
            （共 {fields.length} 个字段）
          </span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddField}>
          添加字段
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
                      编辑
                    </Button>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteField(index)}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              }
            >
              <div style={{ fontSize: 12, color: '#666' }}>
                <div>类型: {field.type}</div>
                {field.description && <div>描述: {field.description}</div>}
                {field.component && <div>组件: {field.component}</div>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', background: '#f5f5f5', borderRadius: 4, color: '#999' }}>
          暂无表单字段，请添加字段
        </div>
      )}

      {/* 字段编辑 Modal */}
      <Modal
        title={editingIndex >= 0 ? '编辑字段' : '添加字段'}
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
            label="字段代码"
            rules={[
              { required: true, message: '请输入字段代码' },
              { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '字段代码只能包含字母、数字和下划线，且不能以数字开头' },
            ]}
          >
            <Input
              placeholder="请输入字段代码（如：step_name）"
              disabled={editingIndex >= 0}
            />
          </Form.Item>
          <Form.Item
            name="label"
            label="字段标签"
            rules={[{ required: true, message: '请输入字段标签' }]}
          >
            <Input placeholder="请输入字段标签（如：步骤名称）" />
          </Form.Item>
          <Form.Item
            name="type"
            label="字段类型"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select>
              <Select.Option value="string">文本 (string)</Select.Option>
              <Select.Option value="number">数字 (number)</Select.Option>
              <Select.Option value="boolean">布尔值 (boolean)</Select.Option>
              <Select.Option value="date">日期 (date)</Select.Option>
              <Select.Option value="select">选择 (select)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="component"
            label="组件类型"
            rules={[{ required: true, message: '请选择组件类型' }]}
          >
            <Select>
              <Select.Option value="Input">输入框 (Input)</Select.Option>
              <Select.Option value="Input.TextArea">文本域 (TextArea)</Select.Option>
              <Select.Option value="InputNumber">数字输入框 (InputNumber)</Select.Option>
              <Select.Option value="DatePicker">日期选择器 (DatePicker)</Select.Option>
              <Select.Option value="Select">下拉选择 (Select)</Select.Option>
              <Select.Option value="Switch">开关 (Switch)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="required" label="是否必填" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="placeholder" label="占位符">
            <Input placeholder="请输入占位符" />
          </Form.Item>
          <Form.Item name="description" label="字段描述">
            <TextArea rows={2} placeholder="请输入字段描述" />
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
                    label="选项（JSON 格式）"
                    rules={[
                      { required: true, message: '请输入选项（JSON 格式）' },
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          try {
                            const parsed = JSON.parse(value);
                            if (!Array.isArray(parsed)) {
                              return Promise.reject(new Error('选项必须是数组格式'));
                            }
                            if (parsed.some((item) => !item.label || item.value === undefined)) {
                              return Promise.reject(new Error('选项格式错误，每个选项必须包含 label 和 value'));
                            }
                            return Promise.resolve();
                          } catch {
                            return Promise.reject(new Error('JSON 格式错误'));
                          }
                        },
                      },
                    ]}
                    tooltip='格式: [{"label": "选项1", "value": "value1"}, {"label": "选项2", "value": "value2"}]'
                  >
                    <TextArea
                      rows={4}
                      placeholder='[{"label": "选项1", "value": "value1"}, {"label": "选项2", "value": "value2"}]'
                    />
                  </Form.Item>
                );
              }
              if (type === 'number') {
                return (
                  <>
                    <Form.Item
                      name="min"
                      label="最小值"
                    >
                      <InputNumber placeholder="最小值（可选）" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="max"
                      label="最大值"
                    >
                      <InputNumber placeholder="最大值（可选）" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="unit"
                      label="单位"
                    >
                      <Input placeholder="单位（如：N·m、℃、kg）" />
                    </Form.Item>
                    <Form.Item
                      name="precision"
                      label="小数位数"
                    >
                      <InputNumber min={0} max={10} placeholder="小数位数（0-10）" style={{ width: '100%' }} />
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

