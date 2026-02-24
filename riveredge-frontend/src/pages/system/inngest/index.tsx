import React from 'react';
import { useTranslation } from 'react-i18next';
import { IframePageTemplate } from '../../../components/layout-templates';

const InngestDashboard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <IframePageTemplate
      src={`http://${import.meta.env.VITE_INNGEST_HOST || '127.0.0.1'}:${import.meta.env.VITE_INNGEST_PORT || '8300'}/`}
      title={t('pages.system.inngest.title')}
    />
  );
};

export default InngestDashboard;

