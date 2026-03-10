/**
 * 注册当前弹窗的「提交」到全局 Ctrl+Enter 快捷键
 * Modal 打开且需要提交时调用，传入提交 handler 与是否激活；用户按 Ctrl+Enter 会触发提交（与点击确定按钮一致）。
 */
import { useEffect } from 'react';
import { registerSubmitHandler } from '../utils/globalSubmitShortcut';

export function useSubmitShortcut(handler: (() => void) | undefined, isActive: boolean): void {
  useEffect(() => {
    if (!isActive || typeof handler !== 'function') return;
    const unregister = registerSubmitHandler(handler);
    return unregister;
  }, [handler, isActive]);
}
