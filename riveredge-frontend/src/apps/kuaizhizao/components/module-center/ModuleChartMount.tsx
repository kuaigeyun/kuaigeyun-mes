import React, { useEffect, useRef, useState } from 'react';

export type ModuleChartMountDims = {
  width: number;
  height: number;
};

export type ModuleChartMountProps = {
  height: number;
  /** 宽度变化超过该像素才触发 remount，避免侧栏动画时频繁重建 */
  remountThreshold?: number;
  children: (dims: ModuleChartMountDims) => React.ReactNode;
};

/**
 * 模块中心图表挂载器：等容器有稳定宽度后再渲染。
 * 瀑布流（CSS columns）下 Pie/Column 易在首帧量到错误宽度导致圆心错位。
 */
export function ModuleChartMount({
  height,
  remountThreshold = 24,
  children,
}: ModuleChartMountProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastWidthRef = useRef(0);
  const [dims, setDims] = useState<ModuleChartMountDims | null>(null);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const width = Math.floor(host.getBoundingClientRect().width);
        if (width <= 0) return;

        const prevWidth = lastWidthRef.current;
        const shouldRemount = prevWidth === 0 || Math.abs(prevWidth - width) >= remountThreshold;
        lastWidthRef.current = width;
        setDims((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height },
        );
        if (shouldRemount) {
          setMountKey((prev) => (prev === width ? prev : width));
        }
      });
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [height, remountThreshold]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {dims ? (
        <React.Fragment key={mountKey}>{children(dims)}</React.Fragment>
      ) : null}
    </div>
  );
}

export default ModuleChartMount;
