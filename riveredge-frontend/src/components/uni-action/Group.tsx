import React from 'react'
import { renderUniTableOperationCell } from './renderCell'
import type { UniActionRenderOptions } from './types'

export type UniActionGroupProps = {
  rowKey: string
  children?: React.ReactNode
} & UniActionRenderOptions

/**
 * 显式包裹操作列子节点，与 UniTable 内注入的 renderUniTableOperationCell 行为一致。
 */
export function UniActionGroup({
  rowKey,
  children,
  directMax,
  suppressAuditSemanticActions,
}: UniActionGroupProps): React.ReactNode {
  const arr = React.Children.toArray(children).filter(Boolean)
  if (arr.length === 0) return null
  const payload: React.ReactNode = arr.length === 1 ? arr[0] : arr
  return renderUniTableOperationCell(payload, rowKey, { directMax, suppressAuditSemanticActions })
}
