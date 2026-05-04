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
  return customFields.some((f) => f.is_active && customFieldValues[f.code] !== undefined);
}

export const CustomFieldsDetailSection: React.FC<CustomFieldsDetailSectionProps> = ({
  customFields,
  customFieldValues,
}) => {
  if (!hasCustomFieldsDetailContent(customFields, customFieldValues)) return null;

  const columns = customFields
    .filter((f) => f.is_active && customFieldValues[f.code] !== undefined)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => ({
      title: field.label || field.name,
      dataIndex: field.code,
      render: (value: any) => {
        if (value === null || value === undefined || value === '') {
          return <Typography.Text type="secondary">-</Typography.Text>;
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
