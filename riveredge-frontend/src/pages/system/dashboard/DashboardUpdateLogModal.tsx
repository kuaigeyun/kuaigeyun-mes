/**

 * 工作台：平台更新日志弹窗

 */



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Empty, Modal, Tabs } from 'antd';

import type { TFunction } from 'i18next';

import { useQuery } from '@tanstack/react-query';

import { layoutShellQueryOptions } from '../../../config/reactQuery';

import { MarkerTag } from '../../../constants/statusBadges';

import { getInstalledApplicationList } from '../../../services/application';

import {

  PLATFORM_UPDATE_LOG,

  type PlatformUpdateDateGroup,

  type PlatformUpdateLogEntry,

  type PlatformUpdateTabKey,

  filterPlatformUpdates,

  filterVisiblePlatformUpdates,

  getAvailableUpdateLogTabs,

  getUpdateTypeMarkerColor,

  groupPlatformUpdatesByDate,

  isDedicatedPlatformUpdateEntry,

  resolveEnabledDedicatedAppCodes,

  resolveUpdateLogText,

} from './platformUpdateLog';



/** 日期导航固定展示的节点数 */
export const UPDATE_LOG_DATE_NAV_NODE_COUNT = 10;

/** 锚点落在窗口首/末且外侧仍有日期时，一次移轴揭示的相邻节点数（须 < nodeCount-1，避免来回抖） */
export const UPDATE_LOG_DATE_NAV_EDGE_SHIFT = 3;

/** 滚动取锚时在窗口外侧额外扫描的节点数，便于滚到相邻日期时发现锚点并触发移轴 */
export const UPDATE_LOG_DATE_NAV_PEEK = 2;

/** 单个日期节点占位高度：item 34 + gap 2 */
export const UPDATE_LOG_DATE_NAV_ITEM_STRIDE = 36;

/** 10 节点视口高度：10*34 + 9*2 */
export const UPDATE_LOG_DATE_NAV_VIEWPORT_HEIGHT = 358;


/**
 * 固定 nodeCount 个日期节点。
 * - 锚点在窗口内部：窗口滞后不跟抖
 * - 锚点完全跑出窗口：按中心重定位
 * - 锚点落在窗口首/末且外侧还有日期：向该侧移轴，加载相邻剩余节点
 */
export function resolveUpdateLogDateNavWindow(
  anchorIndex: number,
  totalGroups: number,
  currentWindowStart: number | null,
  nodeCount: number = UPDATE_LOG_DATE_NAV_NODE_COUNT,
  edgeShift: number = UPDATE_LOG_DATE_NAV_EDGE_SHIFT,
): { indices: number[]; windowStart: number } {
  if (totalGroups <= 0) return { indices: [], windowStart: 0 };

  if (totalGroups <= nodeCount) {
    return {
      indices: Array.from({ length: totalGroups }, (_, index) => index),
      windowStart: 0,
    };
  }

  const lead = Math.floor((nodeCount - 1) / 2);
  const maxStart = totalGroups - nodeCount;
  let windowStart = currentWindowStart ?? Math.max(0, Math.min(anchorIndex - lead, maxStart));

  if (anchorIndex < windowStart) {
    windowStart = Math.max(0, anchorIndex - lead);
  } else if (anchorIndex >= windowStart + nodeCount) {
    windowStart = Math.min(maxStart, anchorIndex - lead);
  } else {
    const lastVisible = windowStart + nodeCount - 1;
    const step = Math.max(1, Math.min(edgeShift, Math.max(1, nodeCount - 2)));

    if (anchorIndex === lastVisible && windowStart < maxStart) {
      windowStart = Math.min(maxStart, windowStart + step);
      if (anchorIndex < windowStart) {
        windowStart = Math.max(0, Math.min(anchorIndex, maxStart));
      }
    } else if (anchorIndex === windowStart && windowStart > 0) {
      windowStart = Math.max(0, windowStart - step);
      if (anchorIndex >= windowStart + nodeCount) {
        windowStart = Math.min(maxStart, Math.max(0, anchorIndex - nodeCount + 1));
      }
    }
  }

  windowStart = Math.max(0, Math.min(windowStart, maxStart));

  return {
    indices: Array.from({ length: nodeCount }, (_, offset) => windowStart + offset),
    windowStart,
  };
}

/** @deprecated 使用 resolveUpdateLogDateNavWindow */
export function getUpdateLogDateNavIndices(
  anchorIndex: number,
  totalGroups: number,
  nodeCount: number = UPDATE_LOG_DATE_NAV_NODE_COUNT,
): number[] {
  return resolveUpdateLogDateNavWindow(anchorIndex, totalGroups, null, nodeCount).indices;
}



export type UpdateLogDateNavTier = 'active' | 'near' | 'far';



export function getUpdateLogDateNavTier(

  groupIndex: number,

  anchorIndex: number,

): UpdateLogDateNavTier {

  const distance = Math.abs(groupIndex - anchorIndex);

  if (distance === 0) return 'active';

  if (distance === 1) return 'near';

  return 'far';

}



function getAlignedScrollTop(
  scrollEl: HTMLDivElement,
  headerEl: HTMLElement,
  navItemEl: HTMLElement,
): number {
  const delta = headerEl.getBoundingClientRect().top - navItemEl.getBoundingClientRect().top;
  const maxTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  return Math.max(0, Math.min(scrollEl.scrollTop + delta, maxTop));
}

function alignHeaderToNavItem(
  scrollEl: HTMLDivElement,
  headerEl: HTMLElement,
  navItemEl: HTMLElement,
) {
  scrollEl.scrollTop = getAlignedScrollTop(scrollEl, headerEl, navItemEl);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function animateScrollTop(
  scrollEl: HTMLDivElement,
  targetTop: number,
  onComplete?: () => void,
): () => void {
  const startTop = scrollEl.scrollTop;
  const distance = targetTop - startTop;

  if (Math.abs(distance) < 1) {
    scrollEl.scrollTop = targetTop;
    onComplete?.();
    return () => {};
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scrollEl.scrollTop = targetTop;
    onComplete?.();
    return () => {};
  }

  const durationMs = Math.min(720, Math.max(360, Math.abs(distance) * 0.55));
  const startAt = performance.now();
  let frameId = 0;
  let cancelled = false;

  const step = (now: number) => {
    if (cancelled) return;
    const progress = Math.min((now - startAt) / durationMs, 1);
    scrollEl.scrollTop = startTop + distance * easeInOutCubic(progress);
    if (progress < 1) {
      frameId = window.requestAnimationFrame(step);
      return;
    }
    scrollEl.scrollTop = targetTop;
    onComplete?.();
  };

  frameId = window.requestAnimationFrame(step);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameId);
  };
}



function useUpdateLogTimelineAnchor(groupCount: number, resetKey: string) {

  const scrollRef = useRef<HTMLDivElement>(null);

  const groupHeaderRefs = useRef<Array<HTMLDivElement | null>>([]);

  const navItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const jumpLockRef = useRef(false);

  const cancelScrollAnimRef = useRef<(() => void) | null>(null);

  const anchorIndexRef = useRef(0);

  const navWindowStartRef = useRef(0);

  const [anchorIndex, setAnchorIndex] = useState(0);

  const [navWindowStart, setNavWindowStart] = useState(0);



  anchorIndexRef.current = anchorIndex;



  useEffect(() => {

    groupHeaderRefs.current.length = groupCount;

    navItemRefs.current.length = groupCount;

  }, [groupCount]);



  useEffect(() => {

    setAnchorIndex(0);

    anchorIndexRef.current = 0;

    navWindowStartRef.current = 0;

    setNavWindowStart(0);

  }, [resetKey]);



  useEffect(() => {

    const root = scrollRef.current;

    if (!root || groupCount === 0) return undefined;



    const pickAnchor = () => {

      if (jumpLockRef.current) return;



      const renderedWindowStart = navWindowStartRef.current;
      const renderedCount = Math.min(UPDATE_LOG_DATE_NAV_NODE_COUNT, groupCount);
      const scanFrom = Math.max(0, renderedWindowStart - UPDATE_LOG_DATE_NAV_PEEK);
      const scanTo = Math.min(
        groupCount - 1,
        renderedWindowStart + renderedCount - 1 + UPDATE_LOG_DATE_NAV_PEEK,
      );

      let nextAnchor = anchorIndexRef.current;

      let bestDistance = Infinity;



      for (let index = scanFrom; index <= scanTo; index += 1) {

        const header = groupHeaderRefs.current[index];

        const navItem = navItemRefs.current[index];

        if (!header || !navItem) continue;



        const distance = Math.abs(

          header.getBoundingClientRect().top - navItem.getBoundingClientRect().top,

        );

        if (distance < bestDistance) {

          bestDistance = distance;

          nextAnchor = index;

        }

      }



      const { windowStart } = resolveUpdateLogDateNavWindow(
        nextAnchor,
        groupCount,
        navWindowStartRef.current,
      );

      if (windowStart !== navWindowStartRef.current) {

        navWindowStartRef.current = windowStart;

        setNavWindowStart(windowStart);

      }

      anchorIndexRef.current = nextAnchor;

      setAnchorIndex(nextAnchor);

    };



    pickAnchor();

    root.addEventListener('scroll', pickAnchor, { passive: true });

    const resizeObserver = new ResizeObserver(pickAnchor);

    resizeObserver.observe(root);



    return () => {

      root.removeEventListener('scroll', pickAnchor);

      resizeObserver.disconnect();

    };

  }, [groupCount, resetKey]);



  useEffect(() => () => {
    cancelScrollAnimRef.current?.();
  }, []);



  const jumpToGroup = useCallback((index: number) => {

    const scrollEl = scrollRef.current;

    if (!scrollEl) return;



    cancelScrollAnimRef.current?.();

    jumpLockRef.current = true;



    const { windowStart } = resolveUpdateLogDateNavWindow(

      index,

      groupCount,

      navWindowStartRef.current,

    );

    navWindowStartRef.current = windowStart;

    setNavWindowStart(windowStart);

    anchorIndexRef.current = index;

    setAnchorIndex(index);



    const runScroll = () => {

      const headerEl = groupHeaderRefs.current[index];

      const navItemEl = navItemRefs.current[index];

      if (!headerEl || !navItemEl) {

        jumpLockRef.current = false;

        return;

      }



      const targetTop = getAlignedScrollTop(scrollEl, headerEl, navItemEl);



      cancelScrollAnimRef.current = animateScrollTop(scrollEl, targetTop, () => {

        alignHeaderToNavItem(scrollEl, headerEl, navItemEl);

        jumpLockRef.current = false;

        cancelScrollAnimRef.current = null;

      });

    };



    window.requestAnimationFrame(() => {

      window.requestAnimationFrame(runScroll);

    });

  }, [groupCount]);



  return {

    scrollRef,

    groupHeaderRefs,

    navItemRefs,

    anchorIndex,

    navWindowStart,

    navIndices: resolveUpdateLogDateNavWindow(anchorIndex, groupCount, navWindowStart).indices,

    jumpToGroup,

  };

}



export interface DashboardUpdateLogModalProps {

  open: boolean;

  onClose: () => void;

  t: TFunction;

}



function UpdateLogTimelineRow({ entry, t }: { entry: PlatformUpdateLogEntry; t: TFunction }) {

  const title = resolveUpdateLogText(t, entry.titleKey);

  const description = resolveUpdateLogText(t, entry.descriptionKey);

  if (!title) return null;



  return (

    <div className="dashboard-update-log-item dashboard-update-log-item--compact">

      <div className="dashboard-update-log-item__main">

        <MarkerTag color={getUpdateTypeMarkerColor(entry.type)} className="dashboard-update-log-item__type">

          {t(`pages.dashboard.updateLogType.${entry.type}`)}

        </MarkerTag>

        {isDedicatedPlatformUpdateEntry(entry) ? (
          <MarkerTag
            color="purple"
            className="dashboard-update-log-item__type dashboard-update-log-item__scope-dedicated"
          >
            {t('pages.dashboard.updateLog.badge.dedicated')}
          </MarkerTag>
        ) : null}

        <span className="dashboard-update-log-item__title">{title}</span>

      </div>

      {description ? (

        <div className="dashboard-update-log-item__description">{description}</div>

      ) : null}

    </div>

  );

}



function UpdateLogDateNavigator({

  dateGroups,

  navWindowStart,

  anchorIndex,

  onSelect,

  setNavItemRef,

  t,

}: {

  dateGroups: PlatformUpdateDateGroup[];

  navWindowStart: number;

  anchorIndex: number;

  onSelect: (index: number) => void;

  setNavItemRef: (index: number, element: HTMLButtonElement | null) => void;

  t: TFunction;

}) {

  const visibleCount = Math.min(UPDATE_LOG_DATE_NAV_NODE_COUNT, dateGroups.length);

  const trackOffset = -navWindowStart * UPDATE_LOG_DATE_NAV_ITEM_STRIDE;

  const viewportHeight =
    visibleCount <= 0
      ? 0
      : visibleCount * 34 + Math.max(0, visibleCount - 1) * 2;

  return (

    <nav className="dashboard-update-log-date-nav" aria-label={t('pages.dashboard.updateLogDateNavAria')}>

      <div

        className="dashboard-update-log-date-nav__viewport"

        style={{ height: viewportHeight || UPDATE_LOG_DATE_NAV_VIEWPORT_HEIGHT }}

      >

        <div className="dashboard-update-log-date-nav__rail" aria-hidden />

        <div

          className="dashboard-update-log-date-nav__track"

          style={{ transform: `translate3d(0, ${trackOffset}px, 0)` }}

        >

          {dateGroups.map((group, index) => {

            const tier = getUpdateLogDateNavTier(index, anchorIndex);

            return (

              <button

                key={`${group.date}-${index}`}

                ref={(element) => setNavItemRef(index, element)}

                type="button"

                className={[

                  'dashboard-update-log-date-nav__item',

                  `dashboard-update-log-date-nav__item--${tier}`,

                ].join(' ')}

                aria-current={tier === 'active' ? 'date' : undefined}

                onClick={() => onSelect(index)}

              >

                <span className="dashboard-update-log-date-nav__label">

                  {group.date}

                </span>

                <span className="dashboard-update-log-date-nav__dot" aria-hidden />

              </button>

            );

          })}

        </div>

      </div>

    </nav>

  );

}



function UpdateLogTimelineGroup({

  group,

  isLast,

  isAnchor,

  setHeaderRef,

  t,

}: {

  group: PlatformUpdateDateGroup;

  isLast: boolean;

  isAnchor: boolean;

  setHeaderRef: (element: HTMLDivElement | null) => void;

  t: TFunction;

}) {

  return (

    <section

      className={[

        'dashboard-update-log-timeline__group',

        isLast ? 'dashboard-update-log-timeline__group--last' : '',

        isAnchor ? 'dashboard-update-log-timeline__group--anchor' : '',

      ].filter(Boolean).join(' ')}

    >

      <div

        ref={setHeaderRef}

        className="dashboard-update-log-timeline__date-heading"

      >

        {group.date}

      </div>

      <div className="dashboard-update-log-timeline__entries">

        {group.entries.map((entry) => (

          <UpdateLogTimelineRow key={entry.id} entry={entry} t={t} />

        ))}

      </div>

    </section>

  );

}



function UpdateLogTimeline({

  entries,

  resetKey,

  t,

}: {

  entries: PlatformUpdateLogEntry[];

  resetKey: string;

  t: TFunction;

}) {

  const dateGroups = useMemo(() => groupPlatformUpdatesByDate(entries), [entries]);

  const {

    scrollRef,

    groupHeaderRefs,

    navItemRefs,

    anchorIndex,

    navWindowStart,

    jumpToGroup,

  } = useUpdateLogTimelineAnchor(dateGroups.length, resetKey);



  const setNavItemRef = useCallback((index: number, element: HTMLButtonElement | null) => {

    navItemRefs.current[index] = element;

  }, [navItemRefs]);



  if (dateGroups.length === 0) {

    return <Empty description={t('pages.dashboard.updateLogEmpty')} />;

  }



  return (

    <div className="dashboard-update-log-modal__body">

      <UpdateLogDateNavigator

        dateGroups={dateGroups}

        navWindowStart={navWindowStart}

        anchorIndex={anchorIndex}

        onSelect={jumpToGroup}

        setNavItemRef={setNavItemRef}

        t={t}

      />

      <div ref={scrollRef} className="dashboard-update-log-modal__scroll">

        <div className="dashboard-update-log-timeline">

          {dateGroups.map((group, index) => (

            <UpdateLogTimelineGroup

              key={`${group.date}-${index}`}

              group={group}

              isLast={index === dateGroups.length - 1}

              isAnchor={index === anchorIndex}

              setHeaderRef={(element) => {

                groupHeaderRefs.current[index] = element;

              }}

              t={t}

            />

          ))}

        </div>

      </div>

    </div>

  );

}



export function DashboardUpdateLogModal({ open, onClose, t }: DashboardUpdateLogModalProps) {

  const [activeTab, setActiveTab] = useState<PlatformUpdateTabKey>('all');

  const { data: installedApps } = useQuery({

    queryKey: ['installedApplications', { is_active: true }],

    queryFn: () => getInstalledApplicationList({ is_active: true }),

    ...layoutShellQueryOptions,

  });

  const enabledDedicatedAppCodes = useMemo(

    () => resolveEnabledDedicatedAppCodes(installedApps ?? []),

    [installedApps],

  );

  const visibleEntries = useMemo(

    () => filterVisiblePlatformUpdates(PLATFORM_UPDATE_LOG, enabledDedicatedAppCodes),

    [enabledDedicatedAppCodes],

  );

  useEffect(() => {

    if (open) setActiveTab('all');

  }, [open]);



  const availableTabs = useMemo(() => getAvailableUpdateLogTabs(visibleEntries), [visibleEntries]);



  const tabItems = useMemo(

    () =>

      availableTabs.map((tabKey) => ({

        key: tabKey,

        label:

          tabKey === 'all'

            ? t('pages.dashboard.updateLogTab.all')

            : tabKey === 'dedicated'

              ? t('pages.dashboard.updateLogTab.dedicated')

              : t(`pages.dashboard.updateLogType.${tabKey}`),

        children: (

          <UpdateLogTimeline

            entries={filterPlatformUpdates(tabKey, visibleEntries)}

            resetKey={`${open}-${tabKey}`}

            t={t}

          />

        ),

      })),

    [availableTabs, open, t, visibleEntries],

  );



  return (

    <Modal

      title={t('pages.dashboard.updateLogModalTitle')}

      open={open}

      onCancel={onClose}

      footer={null}

      width={760}

      destroyOnHidden

      className="dashboard-update-log-modal"

      styles={{

        body: {

          paddingTop: 8,

          minHeight: 420,

        },

      }}

    >

      {visibleEntries.length === 0 ? (

        <Empty description={t('pages.dashboard.updateLogEmpty')} />

      ) : (

        <Tabs

          activeKey={activeTab}

          onChange={(key) => setActiveTab(key as PlatformUpdateTabKey)}

          items={tabItems}

          className="dashboard-update-log-modal__tabs"

        />

      )}

    </Modal>

  );

}



export default DashboardUpdateLogModal;


