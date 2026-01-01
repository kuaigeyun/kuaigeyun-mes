/**
 * Inngest Dashboard 页面
 * 使用 iframe 在内容区显示 Inngest Dashboard
 */

import React from 'react';
import { theme } from 'antd';
import { ListPageTemplate } from '../../../components/layout-templates';

const InngestDashboard: React.FC = () => {
  const { token } = theme.useToken(); // 获取主题 token

  return (
    <ListPageTemplate>
      <div
        style={{
          height: 'calc(100vh - 200px)',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
      <iframe
        src={`http://${import.meta.env.VITE_INNGEST_HOST || '127.0.0.1'}:${import.meta.env.VITE_INNGEST_PORT || '8288'}/`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          flex: 1,
          borderRadius: token.borderRadiusLG || token.borderRadius,
          overflow: 'hidden',
        }}
        title="Inngest Dashboard"
      />
      </div>
    </ListPageTemplate>
  );
};

export default InngestDashboard;

