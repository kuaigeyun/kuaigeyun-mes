import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { KUAIZHIZAO_MOBILE_EQUIPMENT_APP_TITLE_KEY, KUAIZHIZAO_MOBILE_EQUIPMENT_BASE } from './paths';

interface MobileEquipmentLayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  /** 为 true 时 document.title 使用应用名「设备管理」 */
  useAppTitle?: boolean;
}

export const MobileEquipmentLayout: React.FC<MobileEquipmentLayoutProps> = ({
  title,
  children,
  showBack = true,
  onBack,
  useAppTitle = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = useAppTitle ? t(KUAIZHIZAO_MOBILE_EQUIPMENT_APP_TITLE_KEY) : title;
  }, [title, t, useAppTitle]);

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
        background: '#eef2f6',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
          background: 'linear-gradient(135deg, #0b3d6b 0%, #1565a8 100%)',
          color: '#fff',
          boxShadow: '0 2px 12px rgba(11, 61, 107, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 40 }}>
          {showBack ? (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
              style={{ color: '#fff', flexShrink: 0 }}
              aria-label={t('common.back')}
            />
          ) : (
            <span style={{ width: 32, flexShrink: 0 }} />
          )}
          <Typography.Title level={5} style={{ margin: 0, color: '#fff', flex: 1, fontWeight: 600 }}>
            {title}
          </Typography.Title>
        </div>
      </header>
      <main
        style={{
          flex: 1,
          padding: '16px 16px max(24px, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
    </div>
  );
};
