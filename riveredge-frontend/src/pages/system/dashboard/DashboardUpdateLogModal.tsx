/**

 * 工作台：平台更新日志弹窗

 */



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Empty, Modal, Tabs } from 'antd';

import type { TFunction } from 'i18next';

import { MarkerTag } from '../../../constants/statusBadges';

import {

  PLATFORM_UPDATE_LOG,

  type PlatformUpdateDateGroup,

  type PlatformUpdateLogEntry,

  type PlatformUpdateTabKey,

  filterPlatformUpdates,

  getAvailableUpdateLogTabs,

  getUpdateTypeMarkerColor,

  groupPlatformUpdatesByDate,

  resolveUpdateLogText,

} from './platformUpdateLog';



/** 日期导航固定展示的节点数 */

export const UPDATE_LOG_DATE_NAV_NODE_COUNT = 10;



/**
 * 固定 nodeCount 个日期节点；窗口仅在锚点移出当前窗口时才滑动，避免切换抖动。
 */
export function resolveUpdateLogDateNavWindow(
  anchorIndex: number,
  totalGroups: number,
  currentWindowStart: number | null,
  nodeCount: number = UPDATE_LOG_DATE_NAV_NODE_COUNT,
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



      const navIndices = resolveUpdateLogDateNavWindow(
        anchorIndexRef.current,
        groupCount,
        navWindowStartRef.current,
      ).indices;

      let nextAnchor = anchorIndexRef.current;

      let bestDistance = Infinity;



      for (const index of navIndices) {

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

  navIndices,

  anchorIndex,

  onSelect,

  setNavItemRef,

  t,

}: {

  dateGroups: PlatformUpdateDateGroup[];

  navIndices: number[];

  anchorIndex: number;

  onSelect: (index: number) => void;

  setNavItemRef: (index: number, element: HTMLButtonElement | null) => void;

  t: TFunction;

}) {

  return (

    <nav className="dashboard-update-log-date-nav" aria-label={t('pages.dashboard.updateLogDateNavAria')}>

      <div className="dashboard-update-log-date-nav__items">

        {navIndices.map((index) => {

          const tier = getUpdateLogDateNavTier(index, anchorIndex);

          return (

            <button

              key={`${dateGroups[index].date}-${index}`}

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
                {dateGroups[index].date}
              </span>
              <span className="dashboard-update-log-date-nav__dot" aria-hidden />
            </button>

          );

        })}

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

    navIndices,

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

        navIndices={navIndices}

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



  useEffect(() => {

    if (open) setActiveTab('all');

  }, [open]);



  const availableTabs = useMemo(() => getAvailableUpdateLogTabs(), []);



  const tabItems = useMemo(

    () =>

      availableTabs.map((tabKey) => ({

        key: tabKey,

        label:

          tabKey === 'all'

            ? t('pages.dashboard.updateLogTab.all')

            : t(`pages.dashboard.updateLogType.${tabKey}`),

        children: (

          <UpdateLogTimeline

            entries={filterPlatformUpdates(tabKey)}

            resetKey={`${open}-${tabKey}`}

            t={t}

          />

        ),

      })),

    [availableTabs, open, t],

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

      {PLATFORM_UPDATE_LOG.length === 0 ? (

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


