import React from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UnorderedListOutlined,
  VerticalAlignBottomOutlined,
  SendOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  CloudUploadOutlined,
  StopOutlined,
  SyncOutlined,
  CopyOutlined,
  PrinterOutlined,
  ExportOutlined,
  ImportOutlined,
  BellOutlined,
  PlusOutlined,
  LinkOutlined,
  RollbackOutlined,
  FormOutlined,
  FilePdfOutlined,
  SaveOutlined,
  BranchesOutlined,
} from '@ant-design/icons'
import type { NormalizeActionContext } from './types'
import {
  readNodeText,
  normalizeActionLabelText,
  resolveActionKind,
  resolveButtonToneFromNode,
  readExplicitActionKind,
  explicitKindToActionKind,
  type ResolvedRowActionTone,
  type RowActionPermissionKind,
  isAppLocalAuditAction,
} from './actionText'

function isAuditSemanticRowAction(node: React.ReactNode): boolean {
  const explicit = readExplicitActionKind(node)
  return explicit === 'audit' || explicit === 'approve' || explicit === 'reject'
}

function rowActionToneMatchesProps(tone: ResolvedRowActionTone, props: Record<string, unknown>): boolean {
  const danger =
    tone.mode === 'destructive' ? true : !!tone.danger
  return (
    props.type === tone.type &&
    !!props.danger === danger &&
    props.size === 'small' &&
    props.style == null &&
    props.color === undefined &&
    props.variant === undefined
  )
}

function clonePropsForRowTone(
  tone: ResolvedRowActionTone,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const danger = tone.mode === 'destructive' ? true : !!tone.danger
  return {
    ...extra,
    type: tone.type,
    danger,
    size: 'small',
    color: undefined,
    variant: undefined,
    style: undefined,
  }
}

function rowActionClassName(kind: ReturnType<typeof resolveActionKind>): string {
  return ['ant-btn-row-action', kind === 'detail' ? 'ant-btn-row-action-detail' : ''].filter(Boolean).join(' ')
}

function resolveEffectiveActionKind(
  node: React.ReactNode,
  inheritedExplicit?: RowActionPermissionKind | null,
) {
  const explicit = readExplicitActionKind(node) ?? inheritedExplicit ?? null
  if (!explicit) return resolveActionKind(node)
  return explicitKindToActionKind(explicit)
}

function defaultIconForRowActionWithKind(
  node: React.ReactNode,
  inheritedExplicit?: RowActionPermissionKind | null,
): React.ReactNode | undefined {
  const explicit = readExplicitActionKind(node) ?? inheritedExplicit ?? null
  if (explicit === 'read' || explicit === 'display') return <EyeOutlined />
  if (explicit === 'update') return <EditOutlined />
  if (explicit === 'delete' || explicit === 'obsolete') return <DeleteOutlined />
  if (explicit === 'print') return <PrinterOutlined />
  if (explicit === 'submit') return <SendOutlined />
  if (explicit === 'audit' || explicit === 'approve') return <AuditOutlined />
  if (explicit === 'reject') return <CloseCircleOutlined />
  if (explicit === 'revoke') return <RollbackOutlined />
  if (explicit === 'execute') return <PlayCircleOutlined />
  if (explicit === 'create') return <PlusOutlined />
  if (explicit === 'export') return <ExportOutlined />
  if (explicit === 'import') return <ImportOutlined />
  return undefined
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
    const props = (node as React.ReactElement<any>).props || {}
    if (
      ctx.suppressAuditSemanticActions &&
      isAuditSemanticRowAction(node) &&
      !isAppLocalAuditAction(props as Record<string, unknown>)
    ) {
      return null
    }
    const inheritedExplicit = ctx.inheritedExplicitKind ?? null
    const tone = resolveButtonToneFromNode(node, inheritedExplicit)
    const rawChildrenText = readNodeText(props.children)
    const normalizedText = normalizeActionLabelText(rawChildrenText) || props.children
    const kind = resolveEffectiveActionKind(node, inheritedExplicit)
    const currentIcon = props.icon
    const defaultIcon = defaultIconForRowActionWithKind(node, inheritedExplicit)
    const nextIcon = currentIcon ?? defaultIcon
    const targetClass = rowActionClassName(kind)

    const sameTone = rowActionToneMatchesProps(tone, props as Record<string, unknown>)
    const sameClass = String(props.className || '').trim() === targetClass
    const sameChildren =
      typeof normalizedText === 'string'
        ? normalizedText === rawChildrenText
        : normalizedText === props.children
    const sameIcon = nextIcon === props.icon
    if (sameTone && sameClass && sameChildren && sameIcon) {
      return node
    }

    const toneProps = clonePropsForRowTone(tone, {
      className: targetClass,
      icon: nextIcon,
      children: normalizedText,
    }) as Record<string, unknown>
    const merged = { ...(props as Record<string, unknown>), ...toneProps }
    return React.cloneElement(node as React.ReactElement<any>, merged as any)
  }

  if (typeof node.type === 'string' && node.type.toLowerCase() === 'a') {
    const props = (node.props || {}) as Record<string, unknown>
    const text = normalizeActionLabelText(readNodeText(node))
    const inheritedExplicit = ctx.inheritedExplicitKind ?? null
    const tone = resolveButtonToneFromNode(node, inheritedExplicit)
    const kind = resolveEffectiveActionKind(node, inheritedExplicit)
    const defaultIcon = defaultIconForRowActionWithKind(node, inheritedExplicit)
    if (
      ctx.suppressAuditSemanticActions &&
      isAuditSemanticRowAction(node) &&
      !isAppLocalAuditAction(props)
    ) {
      return null
    }
    return (
      <Button
        size="small"
        className={rowActionClassName(kind)}
        type={tone.type}
        danger={tone.mode === 'destructive' ? true : tone.danger}
        icon={(props.icon as React.ReactNode) || defaultIcon}
        onClick={typeof props.onClick === 'function' ? (props.onClick as React.MouseEventHandler) : undefined}
        disabled={!!props.disabled}
      >
        {text != null ? String(text) : (props.children as React.ReactNode)}
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
    const inheritedExplicit =
      elementType === Popconfirm || elementType === Tooltip
        ? readExplicitActionKind(node) ?? ctx.inheritedExplicitKind ?? null
        : ctx.inheritedExplicitKind ?? null
    const childCtx: NormalizeActionContext = {
      suppressAuditSemanticActions: ctx.suppressAuditSemanticActions,
      inheritedExplicitKind: inheritedExplicit,
    }
    const originalArray = React.Children.toArray(node.props.children)
    let anyChildChanged = false
    const normalizedArray: React.ReactNode[] = []
    React.Children.forEach(node.props.children, (child) => {
      const normalizedChild = normalizeActionTree(child, childCtx)
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
