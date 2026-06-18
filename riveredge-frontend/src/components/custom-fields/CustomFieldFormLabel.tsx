/**
 * 自定义字段表单标题（名称 + 「自定义字段」标签）
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';

import { CUSTOM_FIELD_FORM_CLASS_NAMES } from './customFieldFormLayout';

export interface CustomFieldFormLabelProps {
  text: string;
}

export const CustomFieldFormLabel: React.FC<CustomFieldFormLabelProps> = ({ text }) => {
  const { t } = useTranslation();

  return (
    <span>
      {text}
      <Tag color="blue" className={CUSTOM_FIELD_FORM_CLASS_NAMES.labelTag}>
        {t('app.master-data.customFields')}
      </Tag>
    </span>
  );
};
