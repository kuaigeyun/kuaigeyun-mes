/**
 * 占位页面 - 功能开发中
 */
import React from 'react';

interface PlaceholderPageProps {
  title?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title = '功能开发中' }) => {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <h3>{title}</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: 8 }}>该功能正在规划中，敬请期待。</p>
    </div>
  );
};

export default PlaceholderPage;
