/**
 * 关联对象选择组件
 *
 * 用于自定义字段「关联对象」类型，根据 config.associatedTable 和 config.associatedField
 * 从后端加载选项并渲染为下拉选择。
 */

import React, { useEffect, useState } from 'react';
import { ProFormSelect } from '@ant-design/pro-components';
import { getAssociatedTableOptions } from '../../services/customField';
import type { CustomField } from '../../services/customField';
import { customFieldControlLayout, customFieldFieldProps } from './customFieldFormLayout';

export interface AssociatedObjectSelectProps {
  field: CustomField;
  name: string;
  label: React.ReactNode;
  /** 用于 placeholder/校验文案，当 label 为 ReactNode 时必传 */
  labelText?: string;
  placeholder?: string;
  required?: boolean;
  initialValue?: number | string | null;
}

export const AssociatedObjectSelect: React.FC<AssociatedObjectSelectProps> = ({
  field,
  name,
  label,
  labelText,
  placeholder,
  required = false,
  initialValue,
}) => {
  const [options, setOptions] = useState<Array<{ value: number | string; label: string }>>([]);
  const [loading, setLoading] = useState(false);

  const tableName = field.config?.associatedTable;
  const displayField = field.config?.associatedField || 'name';

  useEffect(() => {
    if (!tableName) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssociatedTableOptions(tableName, displayField)
      .then((list) => {
        if (!cancelled) {
          setOptions(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tableName, displayField]);

  const textForMessage = labelText ?? (typeof label === 'string' ? label : '');
  return (
    <ProFormSelect
      name={name}
      label={label}
      placeholder={placeholder || `请选择${textForMessage}`}
      options={options}
      fieldProps={{
        loading,
        showSearch: true,
        filterOption: (input: string, option: any) =>
          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()),
        ...customFieldFieldProps(),
      }}
      rules={required ? [{ required: true, message: `请选择${textForMessage}` }] : []}
      initialValue={initialValue}
      {...customFieldControlLayout()}
    />
  );
};
