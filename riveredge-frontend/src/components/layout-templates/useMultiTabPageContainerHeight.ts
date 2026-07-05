/**
 * MultiTabListPageTemplate 视口高度容器（唯一真源，与业务配置页一致）。
 * 根据容器距视口顶部的距离计算可用高度，供 Card Tab 内容区内部滚动。
 */

import { useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { MULTI_TAB_PAGE_CONTAINER } from './constants';

export function useMultiTabPageContainerHeight(deps: DependencyList = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number>(
    MULTI_TAB_PAGE_CONTAINER.MIN_HEIGHT_PX,
  );

  useLayoutEffect(() => {
    const updateHeight = () => {
      const el = containerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const next = Math.max(
        MULTI_TAB_PAGE_CONTAINER.MIN_HEIGHT_PX,
        Math.floor(window.innerHeight - top - MULTI_TAB_PAGE_CONTAINER.BOTTOM_GAP_PX),
      );
      setContainerHeight(next);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 由调用方传入 Tab 切换等需重算高度的依赖
  }, deps);

  return { containerRef, containerHeight };
}
