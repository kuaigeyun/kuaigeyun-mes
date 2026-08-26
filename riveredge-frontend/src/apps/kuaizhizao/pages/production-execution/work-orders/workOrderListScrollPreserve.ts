import type { ActionType } from '@ant-design/pro-components'
import type { RefObject } from 'react'

/** 与工单列表 UniTable className 一致，用于定位表体滚动容器 */
export const WORK_ORDER_LIST_TABLE_ROOT_CLASS = 'kuaizhizao-work-orders-table'

export type WorkOrderListScrollSnapshot = {
  bodyScrollTop: number
  /** 业务页主滚动口（uni-tabs-content）；body 禁止滚动时 window.scrollY 恒为 0 */
  pageScrollTop: number
  windowScrollY: number
}

const WORK_ORDER_LIST_PAGE_SCROLL_SELECTOR = '.uni-tabs-content'

function queryWorkOrderListTableBody(): HTMLElement | null {
  return document.querySelector(
    `.${WORK_ORDER_LIST_TABLE_ROOT_CLASS} .ant-table-body`,
  ) as HTMLElement | null
}

function queryWorkOrderListPageScroll(): HTMLElement | null {
  return document.querySelector(WORK_ORDER_LIST_PAGE_SCROLL_SELECTOR) as HTMLElement | null
}

export function captureWorkOrderListScrollSnapshot(): WorkOrderListScrollSnapshot {
  const body = queryWorkOrderListTableBody()
  const pageScroll = queryWorkOrderListPageScroll()
  return {
    bodyScrollTop: body?.scrollTop ?? 0,
    pageScrollTop: pageScroll?.scrollTop ?? 0,
    windowScrollY: window.scrollY,
  }
}

export function restoreWorkOrderListScrollSnapshot(snapshot: WorkOrderListScrollSnapshot): void {
  const body = queryWorkOrderListTableBody()
  if (body) {
    body.scrollTop = snapshot.bodyScrollTop
  }
  const pageScroll = queryWorkOrderListPageScroll()
  if (pageScroll) {
    pageScroll.scrollTop = snapshot.pageScrollTop
  }
  if (Math.abs(window.scrollY - snapshot.windowScrollY) > 1) {
    window.scrollTo(0, snapshot.windowScrollY)
  }
}

/** 列表 reload 前后保留表体与页面纵向滚动位置（下达 / 状态变更 / 关闭齐套弹窗等） */
export async function reloadWorkOrderListPreservingScroll(
  actionRef: RefObject<ActionType | undefined>,
  preCaptured?: WorkOrderListScrollSnapshot,
): Promise<void> {
  const snapshot = preCaptured ?? captureWorkOrderListScrollSnapshot()
  await actionRef.current?.reload?.()
  restoreWorkOrderListScrollSnapshot(snapshot)
  requestAnimationFrame(() => {
    restoreWorkOrderListScrollSnapshot(snapshot)
  })
}
