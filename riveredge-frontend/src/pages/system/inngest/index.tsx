/**
 * Inngest Dashboard 页面
 * 使用 iframe 在内容区显示 Inngest Dashboard
 */

import React from 'react';
import { theme } from 'antd';

const InngestDashboard: React.FC = () => {
  const { token } = theme.useToken(); // 获取主题 token

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: '0 16px 16px 16px',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <iframe
        src={`http://${import.meta.env.VITE_INNGEST_HOST || '127.0.0.1'}:${import.meta.env.VITE_INNGEST_PORT || '8300'}/`}
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
  );
};

export default InngestDashboard;

