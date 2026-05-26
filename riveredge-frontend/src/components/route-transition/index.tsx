/**
 * 主内容区路由容器（与左侧菜单 / 标签切换联动）
 * 仅做极轻 opacity 过渡，不用位移，保持克制与响应速度。
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import './route-transition.css';

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="riveredge-route-transition"
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}
