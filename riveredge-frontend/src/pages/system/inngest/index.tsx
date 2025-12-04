/**
 * Inngest Dashboard 页面
 * 使用 iframe 在内容区显示 Inngest Dashboard
 */

import React from 'react';

const InngestDashboard: React.FC = () => {
  return (
    <div
      style={{
        height: 'calc(100vh - 96px)',
        width: '100%',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <iframe
        src="http://localhost:8288/"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          flex: 1,
        }}
        title="Inngest Dashboard"
      />
    </div>
  );
};

export default InngestDashboard;

