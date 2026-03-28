/**
 * 主内容区路由容器（与左侧菜单 / 标签切换联动）
 * 不使用位移动画，避免「内容上浮」体感与额外合成层开销。
 */

import React from 'react';

export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}
