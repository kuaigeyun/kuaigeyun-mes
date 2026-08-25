import React from 'react';
import { Result } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';

export default function IndustryPackHomePage() {
  const { t } = useTranslation();
  return (
    <ListPageTemplate>
      <Result
        icon={<AppstoreOutlined />}
        title={t('app.industry-pack.name')}
        subTitle={t('app.industry-pack.homeHint')}
      />
    </ListPageTemplate>
  );
}
