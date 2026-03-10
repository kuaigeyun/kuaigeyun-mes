/**
 * 注册当前页的「新建」到全局 Alt+N 快捷键
 * 有新建按钮的页面调用后，用户按 Alt+N 会触发传入的 handler（与点击新建按钮一致）。
 */
import { useEffect } from 'react';
import { registerNewHandler } from '../utils/globalNewShortcut';

export function useNewShortcut(handler: (() => void) | undefined): void {
  useEffect(() => {
    if (typeof handler !== 'function') return;
    const unregister = registerNewHandler(handler);
    return unregister;
  }, [handler]);
}
