/**
 * antd App 实例注册表（非组件代码获取 message / notification / modal 的唯一入口）
 *
 * antd 6 的静态 API（`import { message } from 'antd'` 后直接调用）会渲染到独立的
 * React 根，无法消费应用 ConfigProvider 的主题与 CSS 变量，表现为黑色图标、
 * 无内边距的裸样式提示。因此工具函数必须通过本模块获取由 <AntdAppBridge />
 * 注册的 App.useApp() 实例，禁止回落到静态 API。
 */

import React from 'react';
import { App } from 'antd';
import type { useAppProps } from 'antd/es/app/context';

let apis: useAppProps | null = null;

const getApis = (): useAppProps => {
  if (!apis) {
    throw new Error('antd App 实例未注册：请确认当前 React 根的 <App> 下已挂载 <AntdAppBridge />');
  }
  return apis;
};

export const getAntdMessage = () => getApis().message;
export const getAntdNotification = () => getApis().notification;
export const getAntdModal = () => getApis().modal;

/** 挂载在每个 React 根（主应用 / 登录 MPA）的 antd <App> 之下，向本模块注册实例 */
export const AntdAppBridge: React.FC = () => {
  const instance = App.useApp();
  // useLayoutEffect：在浏览器首次绘制前完成注册，首屏请求的错误提示即可使用正确实例
  React.useLayoutEffect(() => {
    apis = instance;
  }, [instance]);
  return null;
};
