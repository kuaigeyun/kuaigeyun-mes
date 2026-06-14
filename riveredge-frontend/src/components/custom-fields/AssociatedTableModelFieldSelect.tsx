/**
 * 关联表模型字段下拉（从后端读取真实列，非硬编码）
 */

import React, { useEffect, useMemo, useState } from 'react';
import SafeProFormSelect from '../safe-pro-form-select';
import { getAssociatedTableModelFields } from '../../services/customField';

function toSelectOptions(fields: Array<{ field: string; label: string }>) {
  return fields.map((item) => ({
    label: `${item.label} (${item.field})`,
    value: item.field,
  }));
}

export interface AssociatedTableModelFieldSelectProps {
  name: string;
  label: React.ReactNode;
  tableName?: string;
  placeholder?: string;
  extra?: React.ReactNode;
  rules?: Array<Record<string, unknown>>;
  initialValue?: string;
}

export const AssociatedTableModelFieldSelect: React.FC<AssociatedTableModelFieldSelectProps> = ({
  name,
  label,
  tableName,
  placeholder,
  extra,
  rules,
  initialValue,
}) => {
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Array<{ field: string; label: string }>>([]);

  useEffect(() => {
    if (!tableName) {
      setFields([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssociatedTableModelFields(tableName)
      .then((items) => {
        if (!cancelled) setFields(items);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tableName]);

  const options = useMemo(() => toSelectOptions(fields), [fields]);

  return (
    <SafeProFormSelect
      name={name}
      label={label}
      rules={rules}
      options={options}
      placeholder={placeholder}
      extra={extra}
      initialValue={initialValue}
      fieldProps={{
        loading,
        showSearch: true,
        filterOption: (input: string, option: any) =>
          `${option?.label ?? ''}`.toLowerCase().includes(input.toLowerCase()),
      }}
    />
  );
};
