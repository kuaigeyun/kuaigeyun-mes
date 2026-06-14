/**
 * 全局 Alt+N 新建快捷键
 * 在有「新建」能力的页面按下 Alt+N 时触发当前页的新建逻辑（与点击新建按钮一致）。
 */

/** 新建按钮上的快捷键提示文案，可拼在按钮文字后 */
export const NEW_SHORTCUT_HINT = ' (Alt+N)';

/**
 * 统一新建按钮快捷键文案：
 * - 若未包含提示，则补一个 ` (Alt+N)`
 * - 若重复包含（如 "(Alt+N) (Alt+N)"），收敛为一个
 */
export function withSingleNewShortcutHint(label: string): string {
  const base = label.replace(/\s*\(Alt\+N\)/gi, '').trimEnd();
  return `${base}${NEW_SHORTCUT_HINT}`;
}

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
