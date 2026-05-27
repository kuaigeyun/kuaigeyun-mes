/**
 * 系统兜底首页（无角色首页、无菜单主页且关闭系统级工作台时使用）
 */

import React from 'react';
import { Button, Card, Typography, Space } from 'antd';
import { HomeOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../../stores/configStore';

const { Title, Paragraph } = Typography;

const DefaultHomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dashboardEnabled = useConfigStore((s) => s.configs.enable_system_dashboard !== false);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Title level={4} style={{ margin: 0 }}>
            <HomeOutlined style={{ marginRight: 8 }} />
            {t('pages.system.defaultHome.title', { defaultValue: '欢迎使用' })}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('pages.system.defaultHome.description', {
              defaultValue:
                '当前未配置角色首页或菜单主页。请从左侧菜单进入业务功能，或由管理员在「角色权限」或「菜单管理」中配置首页。',
            })}
          </Paragraph>
          <Space wrap>
            {dashboardEnabled ? (
              <Button type="primary" onClick={() => navigate('/system/dashboard/workplace')}>
                {t('pages.system.defaultHome.goWorkplace', { defaultValue: '前往工作台' })}
              </Button>
            ) : null}
            <Button icon={<AppstoreOutlined />} onClick={() => navigate('/system/applications')}>
              {t('pages.system.defaultHome.goApplications', { defaultValue: '应用中心' })}
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default DefaultHomePage;
