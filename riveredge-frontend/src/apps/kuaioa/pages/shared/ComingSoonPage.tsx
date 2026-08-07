import React from 'react';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../components/layout-templates';

const ComingSoonPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ListPageTemplate>
      <Empty description={t('app.kuaioa.common.comingSoon')} />
    </ListPageTemplate>
  );
};

export default ComingSoonPage;
