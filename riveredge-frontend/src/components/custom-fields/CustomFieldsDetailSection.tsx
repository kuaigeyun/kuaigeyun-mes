/**
 * 自定义字段详情区块
 *
 * 在详情 Drawer 中渲染自定义字段，与 useCustomFieldsForList 配合使用。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProDescriptions } from '@ant-design/pro-components';
import { Typography } from 'antd';
import type { CustomField } from '../../services/customField';

export interface CustomFieldsDetailSectionProps {
  customFields: CustomField[];
  customFieldValues: Record<string, any>;
}

export const CustomFieldsDetailSection: React.FC<CustomFieldsDetailSectionProps> = ({
  customFields,
  customFieldValues,
}) => {
  const { t } = useTranslation();

  if (customFields.length === 0 || Object.keys(customFieldValues).length === 0) return null;

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

  if (columns.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <Typography.Title level={5}>{t('app.master-data.customFields')}</Typography.Title>
      <ProDescriptions column={2} dataSource={customFieldValues} columns={columns} />
    </div>
  );
};
