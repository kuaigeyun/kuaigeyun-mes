import React from 'react'
import { Button } from 'antd'
import { EyeOutlined, EditOutlined, DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons'
import type { NormalizeActionContext } from './types'
import {
  readNodeText,
  normalizeActionLabelText,
  resolveActionKind,
  resolveButtonTone,
  isAuditSemanticAction,
} from './actionText'

function rowActionClassName(kind: ReturnType<typeof resolveActionKind>): string {
  return `ant-btn-row-action ${kind === 'detail' ? 'ant-btn-row-action-detail' : ''}`.trim()
}

/**
 * 统一操作树：text 幽灵按钮 + 语义图标 + 审核按钮按站点配置隐藏；与溢出路径视觉一致。
 */
export function normalizeActionTree(node: React.ReactNode, ctx: NormalizeActionContext): React.ReactNode {
  if (!node) return node
  if (Array.isArray(node)) {
    let mutated = false
    const next: React.ReactNode[] = []
    for (const child of node) {
      const normalized = normalizeActionTree(child, ctx)
      if (normalized !== child) mutated = true
      next.push(normalized)
    }
    return mutated ? next : node
  }
  if (!React.isValidElement(node)) return node

  const elementType = node.type as any
  const isButtonLike =
    elementType === Button || (typeof elementType === 'string' && elementType === 'button')

  const normalizeMenuLabel = (labelNode: React.ReactNode): React.ReactNode => {
    const text = normalizeActionLabelText(readNodeText(labelNode))
    return text || labelNode
  }

  if (isButtonLike) {
    const actionText = normalizeActionLabelText(readNodeText(node))
    if (ctx.suppressAuditSemanticActions && isAuditSemanticAction(actionText)) {
      return null
    }
    const tone = resolveButtonTone(actionText)
    const props = (node as React.ReactElement<any>).props || {}
    const rawChildrenText = readNodeText(props.children)
    const normalizedText = normalizeActionLabelText(rawChildrenText) || props.children
    const kind = resolveActionKind(node)
    const currentIcon = props.icon
    const defaultIcon =
      kind === 'detail' ? (
        <EyeOutlined />
      ) : kind === 'edit' ? (
        <EditOutlined />
      ) : kind === 'delete' ? (
        <DeleteOutlined />
      ) : kind === 'items' ? (
        <UnorderedListOutlined />
      ) : undefined
    const nextIcon = currentIcon ?? defaultIcon
    const targetClass = rowActionClassName(kind)

    const sameTone =
      props.type === tone.type &&
      (!!props.danger) === (!!tone.danger) &&
      props.size === 'small' &&
      props.style == null
    const sameClass = String(props.className || '').trim() === targetClass
    const sameChildren =
      typeof normalizedText === 'string'
        ? normalizedText === rawChildrenText
        : normalizedText === props.children
    const sameIcon = nextIcon === props.icon
    if (sameTone && sameClass && sameChildren && sameIcon) {
      return node
    }

    return React.cloneElement(node as React.ReactElement<any>, {
      type: tone.type,
      danger: tone.danger,
      size: 'small',
      className: targetClass,
      icon: nextIcon,
      style: undefined,
      children: normalizedText,
    })
  }

  if (typeof node.type === 'string' && node.type.toLowerCase() === 'a') {
    const props = (node.props || {}) as Record<string, unknown>
    const text = normalizeActionLabelText(readNodeText(node))
    const tone = resolveButtonTone(text)
    const kind = resolveActionKind(node)
    const defaultIcon =
      kind === 'detail' ? (
        <EyeOutlined />
      ) : kind === 'edit' ? (
        <EditOutlined />
      ) : kind === 'delete' ? (
        <DeleteOutlined />
      ) : undefined
    if (ctx.suppressAuditSemanticActions && isAuditSemanticAction(text)) {
      return null
    }
    return (
      <Button
        className={rowActionClassName(kind)}
        type={tone.type}
        danger={tone.danger}
        size="small"
        icon={(props.icon as React.ReactNode) || defaultIcon}
        onClick={typeof props.onClick === 'function' ? (props.onClick as React.MouseEventHandler) : undefined}
        disabled={!!props.disabled}
      >
        {text || props.children}
      </Button>
    )
  }

  const hasDropdownMenuItems = Array.isArray(node.props?.menu?.items)
  if (hasDropdownMenuItems) {
    const rawItems = node.props.menu.items as Array<any>
    const nextItems = rawItems
      .map((item: any) => {
        if (!item || item.type === 'divider') return item
        const normalizedLabel = normalizeMenuLabel(item.label)
        if (!normalizedLabel) return null
        return {
          ...item,
          label: normalizedLabel,
        }
      })
      .filter(Boolean)
    const enabledItems = nextItems.filter((item: any) => item && item.type !== 'divider' && !item.disabled)
    const isPushAction = readNodeText(node).includes('下推')
    const disabledByMenu = isPushAction && enabledItems.length === 0

    const childrenArr = React.Children.toArray(node.props.children)
    const triggerChild = childrenArr[0]
    let nextTrigger: React.ReactNode = triggerChild
    if (React.isValidElement(triggerChild)) {
      nextTrigger = normalizeActionTree(triggerChild, ctx)
    }
    if (
      disabledByMenu &&
      React.isValidElement(nextTrigger) &&
      (nextTrigger.type as any) === Button
    ) {
      nextTrigger = React.cloneElement(nextTrigger as React.ReactElement<any>, {
        disabled: true,
      })
    }
    const nextChildren =
      childrenArr.length > 1 ? [nextTrigger, ...childrenArr.slice(1)] : nextTrigger

    return React.cloneElement(node as React.ReactElement<any>, {
      menu: {
        ...node.props.menu,
        items: nextItems,
      },
      children: nextChildren,
    })
  }

  if (node.props?.children) {
    const originalArray = React.Children.toArray(node.props.children)
    let anyChildChanged = false
    const normalizedArray: React.ReactNode[] = []
    React.Children.forEach(node.props.children, (child) => {
      const normalizedChild = normalizeActionTree(child, ctx)
      if (normalizedChild !== child) anyChildChanged = true
      normalizedArray.push(normalizedChild as React.ReactNode)
    })
    const stableArray = React.Children.toArray(normalizedArray)
    if (!anyChildChanged && stableArray.length === originalArray.length) {
      return node
    }
    const childCount = React.Children.count(stableArray)
    const nextChildren = childCount <= 1 ? stableArray[0] ?? stableArray : stableArray
    return React.cloneElement(node as React.ReactElement<any>, {
      children: nextChildren,
    })
  }

  return node
}
