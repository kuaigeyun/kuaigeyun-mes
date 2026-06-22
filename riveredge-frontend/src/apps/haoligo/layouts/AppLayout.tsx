import React from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';

const { Content } = Layout;

/**
 * 好力 GO 内层布局：仅主内容区。
 * 模块切换走全局侧栏菜单（core 菜单），此处不再嵌套二级侧栏。
 * 外边距由 UniTabs 内容区统一提供（如左右 16px），此处不设 padding，避免双层留白。
 * 工作台（UniDashboard）由 `.dashboard-main-scroll-col` 承担纵向滚动；
 * 看板 / 报表等自然增高页面由下方 `haoligo-app-scroll` 承担，避免 Content overflow:hidden 裁切。
 */
const HaoligoAppLayout: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <Layout
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgLayout,
      }}
    >
      <Content
        style={{
          padding: 0,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="haoligo-app-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
};

export default HaoligoAppLayout;
