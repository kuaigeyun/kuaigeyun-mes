/**
 * 自定义字段转 Formily Schema 工具函数
 * 
 * 将自定义字段配置转换为 Formily 的 JSON Schema 格式
 */

import { ISchema } from '@formily/core';
import { CustomField } from '../services/customField';

/**
 * 将自定义字段转换为 Formily Schema
 * 
 * @param fields - 自定义字段列表
 * @returns Formily Schema 对象
 */
export function customFieldsToFormilySchema(fields: CustomField[]): ISchema {
  const properties: Record<string, ISchema> = {};
  
  fields.forEach((field) => {
    const fieldSchema: ISchema = {
      type: getFormilyType(field.field_type),
      title: field.label || field.name,
      description: field.placeholder,
      'x-decorator': 'FormItem',
      'x-component': getFormilyComponent(field.field_type),
      'x-component-props': getComponentProps(field),
    };
    
    // 添加验证规则
    if (field.is_required) {
      fieldSchema.required = true;
    }
    
    // 添加字段配置
    if (field.config) {
      Object.assign(fieldSchema['x-component-props'] || {}, field.config);
    }
    
    properties[field.code] = fieldSchema;
  });
  
  return {
    type: 'object',
    properties,
  };
}

/**
 * 获取 Formily 类型
 * 
 * @param fieldType - 字段类型
 * @returns Formily 类型
 */
function getFormilyType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    text: 'string',
    textarea: 'string',
    number: 'number',
    date: 'string',
    select: 'string',
    json: 'object',
  };
  
  return typeMap[fieldType] || 'string';
}

/**
 * 获取 Formily 组件
 * 
 * @param fieldType - 字段类型
 * @returns Formily 组件名称
 */
function getFormilyComponent(fieldType: string): string {
  const componentMap: Record<string, string> = {
    text: 'Input',
    textarea: 'Input.TextArea',
    number: 'InputNumber',
    date: 'DatePicker',
    select: 'Select',
    json: 'Input.TextArea',
  };
  
  return componentMap[fieldType] || 'Input';
}

/**
 * 获取组件属性
 * 
 * @param field - 自定义字段
 * @returns 组件属性
 */
function getComponentProps(field: CustomField): Record<string, any> {
  const props: Record<string, any> = {
    placeholder: field.placeholder || `请输入${field.label || field.name}`,
  };
  
  switch (field.field_type) {
    case 'textarea':
      props.rows = field.config?.rows || 4;
      break;
    case 'select':
      if (field.config?.options && Array.isArray(field.config.options)) {
        props.options = field.config.options;
      }
      break;
    case 'date':
      props.format = field.config?.format || 'YYYY-MM-DD';
      break;
    case 'number':
      if (field.config?.min !== undefined) {
        props.min = field.config.min;
      }
      if (field.config?.max !== undefined) {
        props.max = field.config.max;
      }
      break;
    case 'json':
      props.rows = 6;
      break;
  }
  
  return props;
}

/**
 * 将字段值转换为 Formily 表单值
 * 
 * @param fields - 自定义字段列表
 * @param values - 字段值字典（key 为字段代码，value 为字段值）
 * @returns Formily 表单值
 */
export function fieldValuesToFormilyValues(
  fields: CustomField[],
  values: Record<string, any>
): Record<string, any> {
  const formValues: Record<string, any> = {};
  
  fields.forEach((field) => {
    const value = values[field.code];
    if (value !== undefined && value !== null) {
      // 根据字段类型转换值
      if (field.field_type === 'json' && typeof value === 'string') {
        try {
          formValues[field.code] = JSON.parse(value);
        } catch {
          formValues[field.code] = value;
        }
      } else {
        formValues[field.code] = value;
      }
    } else if (field.config?.default !== undefined) {
      // 使用默认值
      formValues[field.code] = field.config.default;
    }
  });
  
  return formValues;
}

/**
 * 将 Formily 表单值转换为字段值
 * 
 * @param fields - 自定义字段列表
 * @param formValues - Formily 表单值
 * @returns 字段值字典（key 为字段代码，value 为字段值）
 */
export function formilyValuesToFieldValues(
  fields: CustomField[],
  formValues: Record<string, any>
): Record<string, any> {
  const fieldValues: Record<string, any> = {};
  
  fields.forEach((field) => {
    const value = formValues[field.code];
    if (value !== undefined && value !== null) {
      // 根据字段类型转换值
      if (field.field_type === 'json') {
        fieldValues[field.code] = typeof value === 'string' ? value : JSON.stringify(value);
      } else {
        fieldValues[field.code] = value;
      }
    }
  });
  
  return fieldValues;
}

