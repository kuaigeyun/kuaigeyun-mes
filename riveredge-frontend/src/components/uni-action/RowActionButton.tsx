import React from 'react'
import { Button, type ButtonProps } from 'antd'
import {
  rowActionKind,
  rowActionAddFollowUpFromDocument,
  type RowActionPermissionKind,
} from './actionText'
import { rowActionLabelKeep } from './actionCatalog'

type RowActionButtonProps = Omit<ButtonProps, 'type' | 'size' | 'danger' | 'icon'> & {
  kind: RowActionPermissionKind
  /** 保留页面自定义文案（须显式声明，禁止 silent 漂移） */
  labelKeep?: boolean
  /** 与 kind 正交的统一视觉配置 */
  followUpFromDocument?: boolean | 'skip' | 'create'
}

/**
 * 行内操作按钮：仅声明 manifest action + 点击；样式/图标/文案由 normalizeActionTree 注入。
 */
export function RowActionButton({
  kind,
  labelKeep,
  followUpFromDocument,
  children,
  key,
  ...rest
}: RowActionButtonProps) {
  const profileProps =
    followUpFromDocument === true || followUpFromDocument === 'skip'
      ? rowActionAddFollowUpFromDocument('skip')
      : followUpFromDocument === 'create'
        ? rowActionAddFollowUpFromDocument('create')
        : {}
  return (
    <Button
      key={key}
      {...rowActionKind(kind)}
      {...profileProps}
      {...(labelKeep ? rowActionLabelKeep() : {})}
      {...rest}
    >
      {labelKeep ? children : children ?? null}
    </Button>
  )
}
