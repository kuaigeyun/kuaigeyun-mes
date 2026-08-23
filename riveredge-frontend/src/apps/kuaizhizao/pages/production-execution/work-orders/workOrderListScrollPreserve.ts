import type { ActionType } from '@ant-design/pro-components'
import type { RefObject } from 'react'

/** 与工单列表 UniTable className 一致，用于定位表体滚动容器 */
export const WORK_ORDER_LIST_TABLE_ROOT_CLASS = 'kuaizhizao-work-orders-table'

export type WorkOrderListScrollSnapshot = {
  bodyScrollTop: number
  windowScrollY: number
}

function queryWorkOrderListTableBody(): HTMLElement | null {
  return document.querySelector(
    `.${WORK_ORDER_LIST_TABLE_ROOT_CLASS} .ant-table-body`,
  ) as HTMLElement | null
}

export function captureWorkOrderListScrollSnapshot(): WorkOrderListScrollSnapshot {
  const body = queryWorkOrderListTableBody()
  return {
    bodyScrollTop: body?.scrollTop ?? 0,
    windowScrollY: window.scrollY,
  }
}

export function restoreWorkOrderListScrollSnapshot(snapshot: WorkOrderListScrollSnapshot): void {
  const body = queryWorkOrderListTableBody()
  if (body && snapshot.bodyScrollTop > 0) {
    body.scrollTop = snapshot.bodyScrollTop
  }
  if (snapshot.windowScrollY > 0 && Math.abs(window.scrollY - snapshot.windowScrollY) > 1) {
    window.scrollTo(0, snapshot.windowScrollY)
  }
}

/** 列表 reload 前后保留表体与页面纵向滚动位置（下达 / 状态变更静默刷新） */
export async function reloadWorkOrderListPreservingScroll(
  actionRef: RefObject<ActionType | undefined>,
): Promise<void> {
  const snapshot = captureWorkOrderListScrollSnapshot()
  await actionRef.current?.reload?.()
  restoreWorkOrderListScrollSnapshot(snapshot)
  requestAnimationFrame(() => {
    restoreWorkOrderListScrollSnapshot(snapshot)
  })
}
