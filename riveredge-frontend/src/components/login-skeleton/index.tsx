/**
 * 登录页专用骨架屏
 *
 * 与登录页布局一致：左侧品牌区 + 右侧表单占位，减少懒加载时的布局抖动
 */

import React from 'react';
import { Skeleton } from 'antd';

const LoginSkeleton: React.FC = () => {
  return (
    <div
      className="login-container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: '#fff',
      }}
    >
      {/* 左侧品牌区占位（桌面端） */}
      <div
        style={{
          flex: 1,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
        }}
        className="login-left-skeleton"
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <Skeleton active avatar={{ shape: 'square', size: 48 }} paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 3 }} style={{ marginTop: 24 }} />
        </div>
      </div>

      {/* 右侧表单区占位 */}
      <div
        style={{
          flex: '0 0 480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          background: 'rgba(255,255,255,0.95)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          <Skeleton.Input active size="large" style={{ width: '100%', marginBottom: 24 }} />
          <Skeleton.Input active size="large" style={{ width: '100%', marginBottom: 24 }} />
          <Skeleton.Button active block size="large" style={{ height: 40, marginTop: 24 }} />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .login-left-skeleton {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginSkeleton;
