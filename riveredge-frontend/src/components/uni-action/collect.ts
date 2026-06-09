import React from 'react'
import { Button, Dropdown, Popconfirm } from 'antd'
import { readExplicitActionKind } from './actionText'

/**
 * 从 Space 等容器收集多个「类操作」子节点，用于走统一溢出布局。
 */
export function collectOperationActions(node: React.ReactNode): React.ReactNode[] | null {
  if (!React.isValidElement(node)) return null
  const children = React.Children.toArray((node as React.ReactElement<any>).props?.children).filter(Boolean)
  if (children.length < 2) return null

  const isActionLike = (child: React.ReactNode): boolean => {
    if (!React.isValidElement(child)) return false
    const t = child.type as any
    if (t === Button || t === Popconfirm || t === Dropdown) return true
    if (readExplicitActionKind(child)) return true
    if (typeof t === 'function' && (t.displayName === 'UniWorkflowActions' || t.name === 'UniWorkflowActions')) {
      return true
    }
    return false
  }

  const candidateCount = children.filter(isActionLike).length
  if (candidateCount < 2) return null
  return children
}
