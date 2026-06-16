/**
 * 占位页面 - 功能开发中
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

interface PlaceholderPageProps {
  title?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h3>{title ?? t('app.kuaicaiwu.placeholder.defaultTitle')}</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>{t('app.kuaicaiwu.placeholder.description')}</p>
    </div>
  );
};

export default PlaceholderPage;
