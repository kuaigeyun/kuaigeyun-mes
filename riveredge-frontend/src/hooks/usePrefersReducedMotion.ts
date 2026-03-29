import { useEffect, useState } from 'react';

/**
 * 系统「减少动态效果」偏好（用于关闭 SMIL 等无法用 CSS media 覆盖的动画）。
 * @see https://m3.material.io/styles/motion/overview
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
