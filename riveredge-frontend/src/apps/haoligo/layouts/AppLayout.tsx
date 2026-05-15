import React from 'react';
import { Layout, theme } from 'antd';
import { Outlet } from 'react-router-dom';

const { Content } = Layout;

/**
 * 好力 GO 内层布局：仅主内容区。
 * 模块切换走全局侧栏菜单（core 菜单），此处不再嵌套二级侧栏。
 * 外边距由 UniTabs 内容区统一提供（如左右 16px），此处不设 padding，避免双层留白。
 * 纵向滚动由 UniTabs `.uni-tabs-content` 承担，Content 勿设 overflow:auto，避免与标签页双层滚动条。
 */
const HaoligoAppLayout: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: 480, background: token.colorBgLayout }}>
      <Content style={{ padding: 0, overflow: 'visible', minHeight: 0 }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default HaoligoAppLayout;
