import { useEffect, useState } from 'react';

/**
 * 返回一个在首帧稳定后才置 true 的布尔值。
 * 用于延迟非关键的 react-query 请求（消息徽标、菜单徽标、语言列表等），
 * 让首屏主链路（菜单/应用数据/用户信息）更快完成。
 *
 * 实现：优先 requestIdleCallback（浏览器空闲时），不支持环境回退到 setTimeout(delayMs)。
 */
export function useDeferredEnabled(delayMs = 800): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setReady(true);
      return;
    }

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    }).requestIdleCallback;
    const cic = (window as unknown as {
      cancelIdleCallback?: (handle: number) => void;
    }).cancelIdleCallback;

    if (typeof ric === 'function') {
      const handle = ric(() => setReady(true), { timeout: delayMs + 500 });
      return () => {
        if (typeof cic === 'function' && typeof handle === 'number') cic(handle);
      };
    }

    const timer = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return ready;
}
