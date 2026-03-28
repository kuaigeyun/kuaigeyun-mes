/**
 * 全局 Ctrl+Enter 提交快捷键
 * 在有「提交」能力的 Modal 打开时按下 Ctrl+Enter 触发当前弹窗的提交逻辑（与点击确定/提交按钮一致）。
 */

/** 提交按钮上的快捷键提示文案，可拼在按钮文字后 */
export const SUBMIT_SHORTCUT_HINT = ' (Ctrl+S)';

let currentHandler: (() => void) | null = null;

export function registerSubmitHandler(fn: () => void): () => void {
  currentHandler = fn;
  return () => {
    if (currentHandler === fn) currentHandler = null;
  };
}

export function triggerSubmit(): void {
  if (currentHandler) {
    try {
      currentHandler();
    } catch (e) {
      console.warn('[Ctrl+Enter] triggerSubmit error:', e);
    }
  }
}

export function hasSubmitHandler(): boolean {
  return currentHandler != null;
}
