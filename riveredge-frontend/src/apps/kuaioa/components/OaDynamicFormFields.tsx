import React from 'react';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Form } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import dayjs from 'dayjs';
import { UniUserIdSelect } from '../../../components/uni-user-id-select';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../utils/format';
import type { OaFormFieldSchema } from '../utils/oaFormSchema';
import { OaDepartmentSelect } from './OaLookupField';
import OaSingleFileField, { extractOaSingleFileUuid } from './OaSingleFileField';

type Props = {
  schema: OaFormFieldSchema[];
  namePrefix?: string | string[];
  disabled?: boolean;
};

type StoredUser = { id: number; name: string };

function userDisplayName(user?: { label?: string; full_name?: string | null; username?: string }) {
  return user?.label || user?.full_name || user?.username || undefined;
}

function parseStoredUser(raw: unknown): StoredUser | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as { id?: unknown; name?: unknown };
  const id = Number(row.id);
  const name = String(row.name ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return { id, name };
}

function prefixPath(namePrefix: string | string[], fieldName: string): NamePath {
  return Array.isArray(namePrefix) ? [...namePrefix, fieldName] : [namePrefix, fieldName];
}

export function serializeDynamicFormValues(
  schema: OaFormFieldSchema[],
  values: Record<string, unknown>,
  namePrefix: string | string[] = 'form_data',
): Record<string, unknown> {
  const prefix = Array.isArray(namePrefix) ? namePrefix : [namePrefix];
  const bucket = prefix.reduce<Record<string, unknown> | unknown>(
    (acc, key) => (acc as Record<string, unknown>)?.[key],
    values,
  );
  const formData =
    bucket && typeof bucket === 'object' ? (bucket as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};
  for (const field of schema) {
    const raw = formData[field.name];
    if (field.type === 'switch') {
      result[field.name] = Boolean(raw);
      continue;
    }
    if (field.type === 'user') {
      result[field.name] = parseStoredUser(raw) ?? null;
      continue;
    }
    if (field.type === 'file') {
      result[field.name] = extractOaSingleFileUuid(raw) ?? '';
      continue;
    }
    if (raw == null || raw === '') {
      result[field.name] = field.type === 'number' ? null : '';
      continue;
    }
    if (field.type === 'date' || field.type === 'datetime') {
      result[field.name] = dayjs.isDayjs(raw)
        ? raw.format(field.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss')
        : String(raw);
      continue;
    }
    result[field.name] = raw;
  }
  return result;
}

export function dynamicFormValuesFromRecord(
  schema: OaFormFieldSchema[],
  record: Record<string, unknown>,
): Record<string, unknown> {
  const formData =
    record.form_data && typeof record.form_data === 'object'
      ? (record.form_data as Record<string, unknown>)
      : {};
  const nested: Record<string, unknown> = {};
  for (const field of schema) {
    const raw = formData[field.name];
    if (field.type === 'switch') {
      nested[field.name] = Boolean(raw);
    } else if (field.type === 'date' || field.type === 'datetime') {
      nested[field.name] = raw ? dayjs(String(raw)) : undefined;
    } else if (field.type === 'user') {
      nested[field.name] = parseStoredUser(raw);
    } else if (field.type === 'file') {
      nested[field.name] = typeof raw === 'string' && raw.trim() ? raw : undefined;
    } else {
      nested[field.name] = raw ?? undefined;
    }
  }
  return { form_data: nested };
}

export function renderDynamicFieldReadonly(field: OaFormFieldSchema, value: unknown): React.ReactNode {
  if (field.type === 'user') {
    const user = parseStoredUser(value);
    return user?.name || '-';
  }
  if (field.type === 'file') {
    const uuid = extractOaSingleFileUuid(value) ?? (typeof value === 'string' ? value.trim() : '');
    return uuid || '-';
  }
  if (value == null || value === '') return '-';
  if (field.type === 'switch') return value ? '是' : '否';
  if (field.type === 'date') return formatDateBySiteSetting(String(value));
  if (field.type === 'datetime') return formatDateTimeBySiteSetting(String(value));
  if (field.type === 'select') {
    const text = String(value);
    return field.options?.find((o) => o.value === text)?.label ?? text;
  }
  return String(value);
}

const OaDynamicUserField: React.FC<{
  field: OaFormFieldSchema;
  itemName: NamePath;
  colProps: { span: number };
  disabled: boolean;
}> = ({ field, itemName, colProps, disabled }) => {
  const form = Form.useFormInstance();
  const stored = Form.useWatch(itemName, form);
  const parsed = parseStoredUser(stored);
  const idPath = Array.isArray(itemName) ? [...itemName, 'id'] : [itemName, 'id'];

  return (
    <UniUserIdSelect
      name={idPath}
      label={field.label}
      required={field.required}
      disabled={disabled}
      colProps={colProps}
      presetUsers={parsed ? [{ id: parsed.id, label: parsed.name }] : undefined}
      onUserPicked={(user) => {
        const name = userDisplayName(user);
        form.setFieldValue(
          itemName,
          user?.id ? { id: user.id, name: name || String(user.id) } : undefined,
        );
      }}
    />
  );
};

const OaDynamicFormFields: React.FC<Props> = ({
  schema,
  namePrefix = 'form_data',
  disabled = false,
}) => {
  if (!schema.length) return null;

  return (
    <>
      {schema.map((field) => {
        const itemName = prefixPath(namePrefix, field.name);
        const rules = field.required
          ? [{ required: true, message: `${field.label}必填` }]
          : undefined;

        const colProps = { span: field.span ?? (field.type === 'textarea' || field.type === 'file' ? 24 : 12) };
        const fieldWidth = { style: { width: '100%' as const }, disabled };
        if (field.type === 'textarea') {
          return (
            <ProFormTextArea
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
              fieldProps={{ rows: 3, disabled }}
            />
          );
        }
        if (field.type === 'number') {
          return (
            <ProFormDigit
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
              fieldProps={fieldWidth}
            />
          );
        }
        if (field.type === 'switch') {
          return (
            <ProFormSwitch
              key={field.name}
              name={itemName}
              label={field.label}
              colProps={colProps}
              disabled={disabled}
            />
          );
        }
        if (field.type === 'select') {
          return (
            <ProFormSelect
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
              allowClear
              options={(field.options ?? []).map((o) => ({ label: o.label, value: o.value }))}
            />
          );
        }
        if (field.type === 'date') {
          return (
            <ProFormDatePicker
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
              fieldProps={fieldWidth}
            />
          );
        }
        if (field.type === 'datetime') {
          return (
            <ProFormDatePicker
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
              fieldProps={{ ...fieldWidth, showTime: true }}
            />
          );
        }
        if (field.type === 'department') {
          return (
            <OaDepartmentSelect
              key={field.name}
              name={itemName}
              label={field.label}
              rules={rules}
              colProps={colProps}
              disabled={disabled}
            />
          );
        }
        if (field.type === 'user') {
          return (
            <OaDynamicUserField
              key={field.name}
              field={field}
              itemName={itemName}
              colProps={colProps}
              disabled={disabled}
            />
          );
        }
        if (field.type === 'file') {
          return (
            <ProForm.Item
              key={field.name}
              name={itemName}
              label={field.label}
              rules={
                field.required
                  ? [
                      {
                        validator: async (_: unknown, value: unknown) => {
                          if (!extractOaSingleFileUuid(value)) {
                            throw new Error(`${field.label}必填`);
                          }
                        },
                      },
                    ]
                  : undefined
              }
              colProps={colProps}
            >
              <OaSingleFileField disabled={disabled} />
            </ProForm.Item>
          );
        }
        return (
          <ProFormText
            key={field.name}
            name={itemName}
            label={field.label}
            rules={rules}
            colProps={colProps}
            disabled={disabled}
          />
        );
      })}
    </>
  );
};

export default OaDynamicFormFields;
