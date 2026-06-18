/**
 * 关联属性字段
 *
 * 从关联表指定列读取可选值，供单选/多选。
 * 遗留配置含 linkField 时仍兼容旧逻辑。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form } from 'antd';
import { ProFormDependency, ProFormDigit, ProFormRadio, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import {
  getAssociatedAttributeOptions,
  getAssociatedAttributeValue,
  lookupAssociatedValue,
} from '../../services/customField';
import type { CustomField } from '../../services/customField';
import { resolveLinkFormFieldName } from './customFieldSourceFieldUtils';
import {
  normalizeAssociatedMultiselectValue,
  resolveAssociatedDisplayMode,
} from './customFieldAssociatedDisplayMode';
import { customFieldControlLayout, customFieldFieldProps } from './customFieldFormLayout';

function AttributeValueSync({
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

export interface AssociatedAttributeFieldProps {
  field: CustomField;
  name: string;
  label: React.ReactNode;
  colProps?: { span?: number };
  initialValue?: number | string | Array<string | number> | null;
}

function useDictionaryOptions(tableName: string | undefined, dictionaryField: string) {
  const [options, setOptions] = useState<Array<{ value: number | string; label: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableName) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAssociatedAttributeOptions(tableName, dictionaryField)
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
  }, [dictionaryField, tableName]);

  return { options, loading };
}

/** 从关联表列加载选项（单选下拉 / 多选 / 单选按钮） */
const AssociatedAttributeDictionary: React.FC<
  AssociatedAttributeFieldProps & { multiple?: boolean; radio?: boolean }
> = ({ field, name, label, colProps, initialValue, multiple = false, radio = false }) => {
  const tableName = field.config?.associatedTable;
  const dictionaryField = field.config?.attributeField || 'name';
  const { options, loading } = useDictionaryOptions(tableName, dictionaryField);
  const normalizedInitial = multiple
    ? normalizeAssociatedMultiselectValue(initialValue)
    : (initialValue ?? undefined);

  if (radio) {
    return (
      <ProFormRadio.Group
        name={name}
        label={label}
        initialValue={normalizedInitial}
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
      options={options}
      initialValue={normalizedInitial}
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

async function resolveLegacyLinkRecordId(
  tableName: string,
  linkValue: unknown,
  linkMatchField: string,
): Promise<number | string | null> {
  if (linkValue == null || String(linkValue).trim() === '') {
    return null;
  }
  const text = String(linkValue).trim();
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  const lookup = await lookupAssociatedValue({
    table: tableName,
    matchField: linkMatchField || 'code',
    matchValue: linkValue as string | number,
    returnField: 'id',
  });
  return lookup.recordId ?? lookup.value ?? null;
}

/** 遗留：配置了 linkField 的关联属性（管理端已不再推荐） */
function AssociatedAttributeLegacyLink({
  field,
  name,
  label,
  colProps,
  initialValue,
  linkRecordId,
}: AssociatedAttributeFieldProps & { linkRecordId: unknown }) {
  const [resolvedValue, setResolvedValue] = useState<string | number | undefined>(undefined);
  const isManualOverrideRef = useRef(false);
  const lastLinkSnapshotRef = useRef<string | null>(null);
  const displayMode = resolveAssociatedDisplayMode('associated_attribute', field.config);
  const tableName = field.config?.associatedTable || '';
  const attributeField = field.config?.attributeField || 'name';
  const linkMatchField = field.config?.linkMatchField || 'code';
  const linkSnapshot = JSON.stringify(linkRecordId ?? null);
  const readOnly = displayMode === 'display';
  const useNumberInput = displayMode === 'number' || attributeField === 'id';

  useEffect(() => {
    if (!tableName || linkRecordId == null || String(linkRecordId).trim() === '') {
      setResolvedValue(undefined);
      return;
    }

    const fetchValue = async () => {
      const recordId = await resolveLegacyLinkRecordId(tableName, linkRecordId, linkMatchField);
      if (recordId == null) {
        setResolvedValue(undefined);
        return;
      }
      const res = await getAssociatedAttributeValue({
        table: tableName,
        recordId,
        attributeField,
      });
      setResolvedValue(res.value ?? undefined);
    };

    if (lastLinkSnapshotRef.current === null) {
      lastLinkSnapshotRef.current = linkSnapshot;
      if (initialValue == null) {
        void fetchValue();
      }
      return;
    }

    if (lastLinkSnapshotRef.current !== linkSnapshot) {
      lastLinkSnapshotRef.current = linkSnapshot;
      isManualOverrideRef.current = false;
      void fetchValue();
    }
  }, [attributeField, initialValue, linkMatchField, linkRecordId, linkSnapshot, tableName]);

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
        <AttributeValueSync name={name} value={resolvedValue} />
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
      <AttributeValueSync name={name} value={resolvedValue} />
      {control}
    </>
  );
}

export const AssociatedAttributeField: React.FC<AssociatedAttributeFieldProps> = (props) => {
  const linkField = props.field.config?.linkField;
  const linkFieldType = props.field.config?.linkFieldType;
  const displayMode = resolveAssociatedDisplayMode('associated_attribute', props.field.config);
  const dependencyName = useMemo(
    () => resolveLinkFormFieldName(linkField, linkFieldType),
    [linkField, linkFieldType],
  );

  if (!props.field.config?.associatedTable) {
    return (
      <ProFormText
        name={props.name}
        label={props.label}
        initialValue={props.initialValue ?? undefined}
        fieldProps={{ disabled: true, ...customFieldFieldProps(), placeholder: '-' }}
        {...customFieldControlLayout(colProps)}
      />
    );
  }

  if (linkField && dependencyName) {
    return (
      <ProFormDependency name={[dependencyName]}>
        {(deps) => (
          <AssociatedAttributeLegacyLink
            {...props}
            linkRecordId={deps[dependencyName]}
          />
        )}
      </ProFormDependency>
    );
  }

  return (
    <AssociatedAttributeDictionary
      {...props}
      multiple={displayMode === 'multiselect'}
      radio={displayMode === 'radio'}
    />
  );
};
