import { useLayoutEffect, useRef } from 'react';

type LayoutStyleInjectorProps = {
  shellStyles: string;
  themeStyles: string;
};

/**
 * 布局 CSS 注入：直接写 style.textContent，避免 React 对超大字符串做 reconcile。
 */
export function LayoutStyleInjector({ shellStyles, themeStyles }: LayoutStyleInjectorProps) {
  const shellRef = useRef<HTMLStyleElement>(null);
  const themeRef = useRef<HTMLStyleElement>(null);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (el && el.textContent !== shellStyles) {
      el.textContent = shellStyles;
    }
  }, [shellStyles]);

  useLayoutEffect(() => {
    const el = themeRef.current;
    if (el && el.textContent !== themeStyles) {
      el.textContent = themeStyles;
    }
  }, [themeStyles]);

  return (
    <>
      <style ref={shellRef} data-riveredge-layout="shell" />
      <style ref={themeRef} data-riveredge-layout="theme" />
    </>
  );
}
