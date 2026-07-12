import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { KUAIZHIZAO_MOBILE_EQUIPMENT_BASE } from './paths';

interface MobileEquipmentLayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export const MobileEquipmentLayout: React.FC<MobileEquipmentLayoutProps> = ({
  title,
  children,
  showBack = true,
  onBack,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(KUAIZHIZAO_MOBILE_EQUIPMENT_BASE);
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: '#0f4c81',
          color: '#fff',
        }}
      >
        {showBack ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ color: '#fff' }}
            aria-label={t('common.back')}
          />
        ) : null}
        <Typography.Title level={5} style={{ margin: 0, color: '#fff', flex: 1 }}>
          {title}
        </Typography.Title>
      </header>
      <main style={{ flex: 1, padding: 16 }}>{children}</main>
    </div>
  );
};
