/**
 * 源字段下拉选项（系统 / 自定义徽章展示）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';
import type { CustomField } from '../../services/customField';
import type { CustomFieldSystemSourceField } from '../../services/customField';
import { encodeSourceFieldKey, type CustomFieldSourceScope } from './customFieldSourceFieldUtils';

export interface SourceFieldSelectOption {
  value: string;
  label: string;
  scope: CustomFieldSourceScope;
}

export function buildSourceFieldSelectOptions(
  systemFields: CustomFieldSystemSourceField[],
  customFields: CustomField[],
): SourceFieldSelectOption[] {
  const systemOptions = systemFields.map((field) => ({
    label: `${field.label} (${field.name})`,
    value: encodeSourceFieldKey('system', field.name),
    scope: 'system' as const,
  }));
  const customOptions = customFields
    .filter((field) => field.field_type === 'text' || field.field_type === 'number')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => ({
      label: `${field.label || field.name} (${field.code})`,
      value: encodeSourceFieldKey('custom', field.code),
      scope: 'custom' as const,
    }));
  return [...systemOptions, ...customOptions];
}

export function buildLinkFieldSelectOptions(
  systemSourceFields: CustomFieldSystemSourceField[],
  systemLinkFields: CustomFieldSystemSourceField[],
  customFields: CustomField[],
): SourceFieldSelectOption[] {
  const seen = new Set<string>();
  const items: SourceFieldSelectOption[] = [];

  const append = (option: SourceFieldSelectOption) => {
    if (seen.has(option.value)) return;
    seen.add(option.value);
    items.push(option);
  };

  buildSourceFieldSelectOptions(systemSourceFields, customFields).forEach(append);

  systemLinkFields.forEach((field) => {
    append({
      label: `${field.label} (${field.name})`,
      value: encodeSourceFieldKey('system', field.name),
      scope: 'system',
    });
  });

  customFields
    .filter((field) => field.field_type === 'associated_object')
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach((field) => {
      append({
        label: `${field.label || field.name} (${field.code})`,
        value: encodeSourceFieldKey('custom', field.code),
        scope: 'custom',
      });
    });

  return items;
}

export const SourceFieldOptionContent: React.FC<{
  label: string;
  scope: CustomFieldSourceScope;
}> = ({ label, scope }) => {
  const { t } = useTranslation();
  const tagText =
    scope === 'system'
      ? t('field.customField.sourceFieldSystemTag')
      : t('field.customField.sourceFieldCustomTag');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
        minWidth: 0,
      }}
    >
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <Tag
        color={scope === 'system' ? 'geekblue' : 'blue'}
        style={{ margin: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0 }}
      >
        {tagText}
      </Tag>
    </span>
  );
};

export function createSourceFieldSelectRenderers(options: SourceFieldSelectOption[]) {
  const optionMap = new Map(options.map((option) => [option.value, option]));

  return {
    optionRender: (option: { label?: React.ReactNode; value?: string | number }) => {
      const meta = optionMap.get(String(option.value));
      if (!meta) return <span>{option.label}</span>;
      return <SourceFieldOptionContent label={meta.label} scope={meta.scope} />;
    },
    labelRender: (props: { label: React.ReactNode; value: string | number }) => {
      const meta = optionMap.get(String(props.value));
      if (!meta) return <span>{props.label}</span>;
      return <SourceFieldOptionContent label={meta.label} scope={meta.scope} />;
    },
  };
}
