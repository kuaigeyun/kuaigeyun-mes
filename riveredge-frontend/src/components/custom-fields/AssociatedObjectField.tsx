/**
 * 关联对象字段（XLOOKUP / 下拉 / 多选）
 *
 * 有源字段时按 XLOOKUP 匹配回填；无源字段时下拉选择关联记录。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'antd';
import { ProFormDependency, ProFormDigit, ProFormRadio, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { getAssociatedTableOptions, lookupAssociatedValue } from '../../services/customField';
import type { CustomField } from '../../services/customField';
import { resolveSourceFormFieldName } from './customFieldSourceFieldUtils';
import {
  normalizeAssociatedMultiselectValue,
  resolveAssociatedDisplayMode,
} from './customFieldAssociatedDisplayMode';
import { customFieldControlLayout, customFieldFieldProps } from './customFieldFormLayout';

function LookupValueSync({
  name,
  value,
}: {
  name: string;
  value: string | number | undefined;
}) {
  const form = Form.useFormInstance();
  useEffect(() => {
    form?.setFieldValue(name, value);
  }, [form, name, value]);
  return null;
}

export interface AssociatedObjectFieldProps {
  field: CustomField;
  name: string;
  label: React.ReactNode;
  labelText?: string;
  placeholder?: string;
  required?: boolean;
  colProps?: { span?: number };
  initialValue?: number | string | Array<string | number> | null;
}

function useAssociatedTableOptions(
  tableName: string | undefined,
  displayField: string,
) {
  const [options, setOptions] = useState<Array<{ value: number | string; label: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableName) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssociatedTableOptions(tableName, displayField)
      .then((list) => {
        if (!cancelled) setOptions(list);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayField, tableName]);

  return { options, loading };
}

/** 下拉 / 多选 / 单选按钮：从关联表选记录 */
const AssociatedObjectPicker: React.FC<
  AssociatedObjectFieldProps & { multiple?: boolean; radio?: boolean }
> = ({
  field,
  name,
  label,
  labelText,
  placeholder,
  required = false,
  colProps,
  initialValue,
  multiple = false,
  radio = false,
}) => {
  const tableName = field.config?.associatedTable;
  const displayField = field.config?.associatedField || 'name';
  const { options, loading } = useAssociatedTableOptions(tableName, displayField);
  const textForMessage = labelText ?? (typeof label === 'string' ? label : '');
  const normalizedInitial = multiple
    ? normalizeAssociatedMultiselectValue(initialValue)
    : (initialValue ?? undefined);

  if (radio) {
    return (
      <ProFormRadio.Group
        name={name}
        label={label}
        initialValue={normalizedInitial}
        rules={required ? [{ required: true, message: `请选择${textForMessage}` }] : []}
        options={options.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        fieldProps={{
          optionType: 'button',
          buttonStyle: 'solid',
          disabled: loading,
          style: { display: 'flex', flexWrap: 'wrap', gap: 8 },
        }}
        {...customFieldControlLayout(colProps)}
      />
    );
  }

  return (
    <ProFormSelect
      name={name}
      label={label}
      placeholder={placeholder || `请选择${textForMessage}`}
      options={options}
      initialValue={normalizedInitial}
      rules={required ? [{ required: true, message: `请选择${textForMessage}` }] : []}
      fieldProps={{
        mode: multiple ? 'multiple' : undefined,
        loading,
        showSearch: true,
        allowClear: true,
        filterOption: (input: string, option: any) =>
          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()),
        ...customFieldFieldProps(),
      }}
      {...customFieldControlLayout(colProps)}
    />
  );
};

function AssociatedObjectLookupControl({
  field,
  name,
  label,
  colProps,
  initialValue,
  sourceValue,
  displayMode,
}: AssociatedObjectFieldProps & {
  sourceValue: unknown;
  displayMode: ReturnType<typeof resolveAssociatedDisplayMode>;
}) {
  const [resolvedValue, setResolvedValue] = useState<string | number | undefined>(undefined);
  const isManualOverrideRef = useRef(false);
  const lastSourceSnapshotRef = useRef<string | null>(null);

  const tableName = field.config?.associatedTable || '';
  const matchField = field.config?.matchField || 'code';
  const returnField = field.config?.returnField || 'id';
  const sourceSnapshot = JSON.stringify(sourceValue ?? null);
  const readOnly = displayMode === 'display';
  const useNumberInput = displayMode === 'number' || returnField === 'id' || returnField === 'number';

  useEffect(() => {
    if (!tableName || sourceValue == null || String(sourceValue).trim() === '') {
      setResolvedValue(undefined);
      return;
    }

    const fetchValue = () => {
      let cancelled = false;
      lookupAssociatedValue({
        table: tableName,
        matchField,
        matchValue: sourceValue as string | number,
        returnField,
      }).then((res) => {
        if (!cancelled) setResolvedValue(res.value ?? undefined);
      });
      return () => {
        cancelled = true;
      };
    };

    if (lastSourceSnapshotRef.current === null) {
      lastSourceSnapshotRef.current = sourceSnapshot;
      if (initialValue == null) {
        return fetchValue();
      }
      return;
    }

    if (lastSourceSnapshotRef.current !== sourceSnapshot) {
      lastSourceSnapshotRef.current = sourceSnapshot;
      isManualOverrideRef.current = false;
      return fetchValue();
    }
  }, [initialValue, matchField, returnField, sourceSnapshot, sourceValue, tableName]);

  if (readOnly) {
    const displayControl = useNumberInput ? (
      <ProFormDigit
        name={name}
        label={label}
        initialValue={initialValue ?? undefined}
        fieldProps={{ readOnly: true, ...customFieldFieldProps() }}
        {...customFieldControlLayout(colProps)}
      />
    ) : (
      <ProFormText
        name={name}
        label={label}
        initialValue={initialValue ?? undefined}
        fieldProps={{ readOnly: true, ...customFieldFieldProps() }}
        {...customFieldControlLayout(colProps)}
      />
    );

    return (
      <>
        <LookupValueSync name={name} value={resolvedValue} />
        {displayControl}
      </>
    );
  }

  const control = useNumberInput ? (
    <ProFormDigit
      name={name}
      label={label}
      initialValue={initialValue ?? undefined}
      fieldProps={{
        ...customFieldFieldProps(),
        onChange: () => {
          isManualOverrideRef.current = true;
        },
      }}
      {...customFieldControlLayout(colProps)}
    />
  ) : (
    <ProFormText
      name={name}
      label={label}
      initialValue={initialValue ?? undefined}
      fieldProps={{
        ...customFieldFieldProps(),
        onChange: () => {
          isManualOverrideRef.current = true;
        },
      }}
      {...customFieldControlLayout(colProps)}
    />
  );

  if (isManualOverrideRef.current) {
    return control;
  }

  return (
    <>
      <LookupValueSync name={name} value={resolvedValue} />
      {control}
    </>
  );
}

export const AssociatedObjectField: React.FC<AssociatedObjectFieldProps> = (props) => {
  const sourceField = props.field.config?.sourceField;
  const sourceFieldType = props.field.config?.sourceFieldType;
  const displayMode = resolveAssociatedDisplayMode('associated_object', props.field.config);
  const dependencyName = useMemo(
    () => resolveSourceFormFieldName(sourceField, sourceFieldType),
    [sourceField, sourceFieldType],
  );

  if (!sourceField || !dependencyName) {
    if (displayMode === 'multiselect') {
      return <AssociatedObjectPicker {...props} multiple />;
    }
    if (displayMode === 'radio') {
      return <AssociatedObjectPicker {...props} radio />;
    }
    return <AssociatedObjectPicker {...props} />;
  }

  return (
    <ProFormDependency name={[dependencyName]}>
      {(deps) => (
        <AssociatedObjectLookupControl
          {...props}
          sourceValue={deps[dependencyName]}
          displayMode={displayMode}
        />
      )}
    </ProFormDependency>
  );
};
