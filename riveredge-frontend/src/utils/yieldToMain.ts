/**
 * 将控制权交还给浏览器，避免长任务阻塞点击/滚动等交互。
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (scheduler?.yield) {
      void scheduler.yield().then(resolve);
      return;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}
