/**
 * PRO 应用升级提示组件
 *
 * 当租户无 PRO 权限访问 PRO 应用时展示，引导客户升级套餐或去应用中心激活 License。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
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
    navigate('/infra/tenants');
  };

  const handleActivateInAppCenter = () => {
    navigate('/system/applications');
  };

  return (
    <div style={{ padding: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
      <Card
        style={{ maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        variant="borderless"
      >
        <div style={{ marginBottom: 24, fontSize: 64, color: '#d9d9d9' }}>
          <LockOutlined />
        </div>
        <Title level={4} style={{ marginBottom: 12 }}>
          {t('components.proUpgradePrompt.title', { name: appName || appCode })}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('components.proUpgradePrompt.description')}
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          {t('components.proUpgradePrompt.activateHint', {
            defaultValue:
              '若已购买授权：打开应用中心 → 该应用「更多操作」→「输入 License Key」（已启用也可激活）。',
          })}
        </Paragraph>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={handleActivateInAppCenter} block>
            {t('components.proUpgradePrompt.goAppCenter', { defaultValue: '前往应用中心激活' })}
          </Button>
          <Button size="large" onClick={handleUpgrade} block>
            {t('components.proUpgradePrompt.upgradeButton')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default ProUpgradePrompt;
