/**
 * 自定义字段表单标题（名称 + 「自定义字段」标签）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';

export interface CustomFieldFormLabelProps {
  text: string;
}

export const CustomFieldFormLabel: React.FC<CustomFieldFormLabelProps> = ({ text }) => {
  const { t } = useTranslation();

  return (
    <span>
      {text}
      <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
        {t('app.master-data.customFields')}
      </Tag>
    </span>
  );
};
