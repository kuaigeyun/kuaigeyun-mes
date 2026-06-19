import React from 'react'
import { Button, type ButtonProps } from 'antd'
import { normalizeActionTree } from './normalize'
import { rowActionKind, type RowActionPermissionKind } from './actionText'
import { rowActionLabelKeep } from './actionCatalog'

type PrepareRowActionButtonProps = Omit<ButtonProps, 'type' | 'size' | 'danger' | 'icon' | 'className'> & {
  /** 保留自定义文案（须与 manifest 默认不同） */
  labelKeep?: boolean
}

/**
 * 在组件内部渲染行内操作时，主动走 normalizeActionTree，与操作列直出按钮视觉一致。
 * （嵌套在 skip 自管组件内时，外层 cell 不会对子 Button 再做 normalize。）
 */
export function prepareRowActionButton(
  kind: RowActionPermissionKind,
  props?: PrepareRowActionButtonProps,
): React.ReactNode {
  const { labelKeep, children, key, ...rest } = props ?? {}
  const node = (
    <Button
      key={key}
      {...rowActionKind(kind)}
      {...(labelKeep ? rowActionLabelKeep() : {})}
      {...rest}
    >
      {labelKeep ? children : children ?? null}
    </Button>
  )
  return normalizeActionTree(node, { suppressAuditSemanticActions: false })
}
