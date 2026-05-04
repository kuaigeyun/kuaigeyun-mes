import React from 'react'
import { Button } from 'antd'
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
  resolveButtonTone,
  type ResolvedRowActionTone,
  isAuditSemanticAction,
} from './actionText'

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
    color: undefined,
    variant: undefined,
    style: undefined,
  }
}

function rowActionClassName(kind: ReturnType<typeof resolveActionKind>): string {
  return ['ant-btn-row-action', kind === 'detail' ? 'ant-btn-row-action-detail' : ''].filter(Boolean).join(' ')
}

/** 主行展示用默认图标（含从「更多」提升的常见操作），与详情/编辑/删除对齐 */
function defaultIconForRowAction(node: React.ReactNode): React.ReactNode | undefined {
  const label = normalizeActionLabelText(readNodeText(node))
  const n = label.replace(/\s+/g, '')
  const kind = resolveActionKind(node)

  if (kind === 'detail') return <EyeOutlined />
  if (kind === 'edit') return <EditOutlined />
  if (kind === 'delete') return <DeleteOutlined />
  if (kind === 'items') return <UnorderedListOutlined />

  if (/下推/.test(n)) return <VerticalAlignBottomOutlined />
  if (/提交/.test(n)) return <SendOutlined />
  if (/审核|审批/.test(n)) return <AuditOutlined />
  if (/确认/.test(n)) return <CheckCircleOutlined />
  if (/驳回/.test(n)) return <CloseCircleOutlined />
  if (/执行/.test(n)) return <PlayCircleOutlined />
  if (/发布/.test(n)) return <CloudUploadOutlined />
  if (/启用/.test(n)) return <CheckCircleOutlined />
  if (/停用/.test(n)) return <StopOutlined />
  if (/同步/.test(n)) return <SyncOutlined />
  if (/复制|拷贝/.test(n)) return <CopyOutlined />
  if (/pdf|PDF/.test(label)) return <FilePdfOutlined />
  if (/另存为新版本|另存为新/.test(n)) return <SaveOutlined />
  if (/修订版|新建修订|创建新版/.test(n)) return <BranchesOutlined />
  if (/打印/.test(n)) return <PrinterOutlined />
  if (/导出/.test(n)) return <ExportOutlined />
  if (/导入/.test(n)) return <ImportOutlined />
  if (/提醒/.test(n)) return <BellOutlined />
  if (/添加|新增|创建/.test(n)) return <PlusOutlined />
  if (/关联/.test(n)) return <LinkOutlined />
  if (/撤回/.test(n)) return <RollbackOutlined />
  if (n) return <FormOutlined />
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
    if (ctx.suppressAuditSemanticActions && isAuditSemanticAction(actionText)) {
      return null
    }
    const tone = resolveButtonTone(actionText)
    const props = (node as React.ReactElement<any>).props || {}
    const rawChildrenText = readNodeText(props.children)
    const normalizedText = normalizeActionLabelText(rawChildrenText) || props.children
    const kind = resolveActionKind(node)
    const currentIcon = props.icon
    const defaultIcon = defaultIconForRowAction(node)
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

    return React.cloneElement(
      node as React.ReactElement<any>,
      clonePropsForRowTone(tone, {
        size: 'small',
        className: targetClass,
        icon: nextIcon,
        children: normalizedText,
      }) as any,
    )
  }

  if (typeof node.type === 'string' && node.type.toLowerCase() === 'a') {
    const props = (node.props || {}) as Record<string, unknown>
    const text = normalizeActionLabelText(readNodeText(node))
    const tone = resolveButtonTone(text)
    const kind = resolveActionKind(node)
    const defaultIcon = defaultIconForRowAction(node)
    if (ctx.suppressAuditSemanticActions && isAuditSemanticAction(text)) {
      return null
    }
    return (
      <Button
        className={rowActionClassName(kind)}
        type={tone.type}
        danger={tone.mode === 'destructive' ? true : tone.danger}
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
