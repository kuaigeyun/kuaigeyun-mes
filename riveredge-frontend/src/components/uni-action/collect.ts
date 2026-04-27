import React from 'react'
import { Button, Dropdown, Popconfirm } from 'antd'
import { readNodeText } from './actionText'

/**
 * 从 Space 等容器收集多个「类操作」子节点，用于走统一溢出布局。
 */
export function collectOperationActions(node: React.ReactNode): React.ReactNode[] | null {
  if (!React.isValidElement(node)) return null
  const children = React.Children.toArray((node as React.ReactElement<any>).props?.children).filter(Boolean)
  if (children.length < 2) return null

  const readText = (input: React.ReactNode): string => {
    if (input == null || typeof input === 'boolean') return ''
    if (typeof input === 'string' || typeof input === 'number') return String(input)
    if (Array.isArray(input)) return input.map(readText).join('')
    if (!React.isValidElement(input)) return ''
    return readText((input as React.ReactElement<any>).props?.children)
  }

  const isActionLike = (child: React.ReactNode): boolean => {
    if (!React.isValidElement(child)) return false
    const t = child.type as any
    if (t === Button || t === Popconfirm || t === Dropdown) return true
    const text = readText(child).replace(/\s+/g, '')
    return /详情|查看|编辑|修改|删除|提交|审核|确认|启用|停用|同步|下推|添加|新增|子项|更多/.test(text)
  }

  const candidateCount = children.filter(isActionLike).length
  if (candidateCount < 2) return null
  return children
}
