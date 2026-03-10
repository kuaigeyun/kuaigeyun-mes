/**
 * 全局 Alt+N 新建快捷键
 * 在有「新建」能力的页面按下 Alt+N 时触发当前页的新建逻辑（与点击新建按钮一致）。
 */

/** 新建按钮上的快捷键提示文案，可拼在按钮文字后 */
export const NEW_SHORTCUT_HINT = ' (Alt+N)';

let currentHandler: (() => void) | null = null;

export function registerNewHandler(fn: () => void): () => void {
  currentHandler = fn;
  return () => {
    if (currentHandler === fn) currentHandler = null;
  };
}

export function triggerNew(): void {
  if (currentHandler) {
    try {
      currentHandler();
    } catch (e) {
      console.warn('[Alt+N] triggerNew error:', e);
    }
  }
}

export function hasNewHandler(): boolean {
  return currentHandler != null;
}
