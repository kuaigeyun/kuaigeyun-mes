/**
 * 主内容区路由切换过渡（与左侧菜单 / 标签切换联动）
 * 使用项目依赖 framer-motion，动效轻量：淡入 + 极轻微位移
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.25, 0.1, 0.25, 1] as const;

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease }}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
