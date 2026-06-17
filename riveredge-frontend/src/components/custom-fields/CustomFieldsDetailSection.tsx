/**
 * 自定义字段详情区块
 *
 * 在详情 Drawer 中渲染自定义字段，与 useCustomFieldsForList 配合使用。
 * 分区标题由 DetailDrawerTemplate 的 linesTitle 提供（与「基本信息」同级），此处不再套一层标题。
 */

import React from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { Typography } from 'antd';
import type { CustomField } from '../../services/customField';
import { CustomFieldFileDetail } from './CustomFieldFileDetail';
import { normalizeCustomFieldFileUuids } from './customFieldFileUtils';
import { formatJsonText, isEmptyJsonValue } from './customFieldJsonUtils';
import { formatAssociatedDetailValue } from './customFieldAssociatedDisplayMode';

function formatMultiselectDetailValue(value: unknown, options?: { label: string; value: string }[]): string {
  const arr = Array.isArray(value) ? value : value != null && value !== '' ? [value] : [];
  if (!arr.length) return '';
  const opts = options || [];
  return arr
    .map((v) => opts.find((o) => o.value === v || String(o.value) === String(v))?.label ?? String(v))
    .join('、');
}

export interface CustomFieldsDetailSectionProps {
  customFields: CustomField[];
  customFieldValues: Record<string, any>;
}

/** 是否存在可在详情中展示的自定义字段行（用于决定是否渲染「自定义字段」分区） */
export function hasCustomFieldsDetailContent(
  customFields: CustomField[],
  customFieldValues: Record<string, any>,
): boolean {
  if (customFields.length === 0 || Object.keys(customFieldValues).length === 0) return false;
  return customFields.some((f) => {
    if (!f.is_active || customFieldValues[f.code] === undefined) return false;
    if (f.field_type === 'image' || f.field_type === 'file') {
      return normalizeCustomFieldFileUuids(customFieldValues[f.code]).length > 0;
    }
    if (f.field_type === 'json') {
      return !isEmptyJsonValue(customFieldValues[f.code]);
    }
    if (f.field_type === 'multiselect') {
      const v = customFieldValues[f.code];
      return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
    }
    return true;
  });
}

export const CustomFieldsDetailSection: React.FC<CustomFieldsDetailSectionProps> = ({
  customFields,
  customFieldValues,
}) => {
  if (!hasCustomFieldsDetailContent(customFields, customFieldValues)) return null;

  const columns = customFields
    .filter((f) => {
      if (!f.is_active || customFieldValues[f.code] === undefined) return false;
      if (f.field_type === 'image' || f.field_type === 'file') {
        return normalizeCustomFieldFileUuids(customFieldValues[f.code]).length > 0;
      }
      if (f.field_type === 'json') {
        return !isEmptyJsonValue(customFieldValues[f.code]);
      }
      if (f.field_type === 'multiselect') {
        const v = customFieldValues[f.code];
        return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
      }
      return true;
    })
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => ({
      title: field.label || field.name,
      dataIndex: field.code,
      render: (value: any) => {
        if (field.field_type === 'image') {
          return <CustomFieldFileDetail value={value} image />;
        }
        if (field.field_type === 'file') {
          return <CustomFieldFileDetail value={value} />;
        }
        if (field.field_type === 'json') {
          if (isEmptyJsonValue(value)) {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }
          return (
            <Typography.Paragraph
              copyable
              style={{
                marginBottom: 0,
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {formatJsonText(value)}
            </Typography.Paragraph>
          );
        }
        if (field.field_type === 'multiselect') {
          const text = formatMultiselectDetailValue(value, field.config?.options);
          return text ? text : <Typography.Text type="secondary">-</Typography.Text>;
        }
        if (value === null || value === undefined || value === '') {
          return <Typography.Text type="secondary">-</Typography.Text>;
        }
        if (field.field_type === 'associated_object' || field.field_type === 'associated_attribute') {
          const text = formatAssociatedDetailValue(value);
          return text ? text : <Typography.Text type="secondary">-</Typography.Text>;
        }
        if (typeof value === 'object') {
          const display = value.label ?? value.name ?? value.title ?? value.code ?? (value.id != null ? String(value.id) : null);
          return display != null ? String(display) : <Typography.Text type="secondary">-</Typography.Text>;
        }
        return String(value);
      },
    }));

  return <ProDescriptions column={2} dataSource={customFieldValues} columns={columns} />;
};
