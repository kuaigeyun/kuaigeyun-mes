/**
 * PRO 应用升级提示组件
 *
 * 当租户无 PRO 权限访问 PRO 应用时展示，引导客户升级套餐。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

export interface ProUpgradePromptProps {
  appName?: string;
  appCode?: string;
}

const ProUpgradePrompt: React.FC<ProUpgradePromptProps> = ({ appName = '', appCode = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    // 跳转到套餐管理或组织设置
    navigate('/infra/tenants');
  };

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
      <Card
        style={{ maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        bordered={false}
      >
        <div style={{ marginBottom: 24, fontSize: 64, color: '#d9d9d9' }}>
          <LockOutlined />
        </div>
        <Title level={4} style={{ marginBottom: 12 }}>
          {t('components.proUpgradePrompt.title', { name: appName || appCode })}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          {t('components.proUpgradePrompt.description')}
        </Paragraph>
        <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={handleUpgrade}>
          {t('components.proUpgradePrompt.upgradeButton')}
        </Button>
      </Card>
    </div>
  );
};

export default ProUpgradePrompt;
