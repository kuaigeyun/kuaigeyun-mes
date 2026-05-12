import React from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ToolOutlined, AppstoreOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Sider, Content } = Layout;

/**
 * 好力 GO 内层布局：侧栏三模块（设备 / 模具 / 巡查），与 PLAN §5 一致。
 */
const HaoligoAppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const selected = (() => {
    if (location.pathname.includes('/molds')) return ['molds'];
    if (location.pathname.includes('/patrol')) return ['patrol'];
    return ['equipment'];
  })();

  return (
    <Layout style={{ minHeight: 480, background: token.colorBgLayout }}>
      <Sider
        width={220}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            padding: '16px 16px 12px',
            fontWeight: 600,
            fontSize: 15,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          好力 GO
        </div>
        <Menu
          mode="inline"
          selectedKeys={selected}
          style={{ borderInlineEnd: 0 }}
          items={[
            { key: 'equipment', icon: <ToolOutlined />, label: '设备' },
            { key: 'molds', icon: <AppstoreOutlined />, label: '模具' },
            { key: 'patrol', icon: <SafetyCertificateOutlined />, label: '巡查' },
          ]}
          onClick={({ key }) => {
            if (key === 'equipment') navigate('/apps/haoligo/equipment');
            if (key === 'molds') navigate('/apps/haoligo/molds');
            if (key === 'patrol') navigate('/apps/haoligo/patrol');
          }}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default HaoligoAppLayout;
