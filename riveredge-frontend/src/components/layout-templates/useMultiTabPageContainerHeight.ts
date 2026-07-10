/**
 * MultiTabListPageTemplate 视口高度容器（唯一真源，与业务配置页一致）。
 * 根据容器距视口顶部的距离计算可用高度，供 Card Tab 内容区内部滚动。
 */

import { useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { MULTI_TAB_PAGE_CONTAINER } from './constants';

/** 参与 UniTabs 视口高度链的祖先（跳过 ant-form 等内容撑高中间层） */
const HEIGHT_CHAIN_ANCESTOR_CLASS = [
  'uni-tabs-content-page-inner',
  'riveredge-route-transition',
  'uni-tabs-route-cache-pane',
  'uni-tabs-content-hmi-inner',
  'uni-tabs-content-board-inner',
] as const;

function resolveMultiTabHeightAnchor(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    if (HEIGHT_CHAIN_ANCESTOR_CLASS.some((cls) => node!.classList.contains(cls))) {
      return node;
    }
    node = node.parentElement;
  }
  return el.parentElement ?? el;
}

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
      const viewportBased = Math.max(
        MULTI_TAB_PAGE_CONTAINER.MIN_HEIGHT_PX,
        Math.floor(window.innerHeight - top - MULTI_TAB_PAGE_CONTAINER.BOTTOM_GAP_PX),
      );

      const anchor = resolveMultiTabHeightAnchor(el);
      const anchorHeight = anchor.clientHeight;
      if (anchorHeight > 0) {
        setContainerHeight(
          Math.max(MULTI_TAB_PAGE_CONTAINER.MIN_HEIGHT_PX, Math.min(anchorHeight, viewportBased)),
        );
        return;
      }

      setContainerHeight(viewportBased);
    };

    updateHeight();

    const anchor = containerRef.current ? resolveMultiTabHeightAnchor(containerRef.current) : null;
    const ro =
      anchor && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateHeight)
        : undefined;
    ro?.observe(anchor);

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 由调用方传入 Tab 切换等需重算高度的依赖
  }, deps);

  return { containerRef, containerHeight };
}
