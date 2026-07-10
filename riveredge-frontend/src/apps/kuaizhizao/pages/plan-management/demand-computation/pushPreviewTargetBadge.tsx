import React from 'react'
import { Tag } from 'antd'
import type { TFunction } from 'i18next'

import type { ComputationPushPreviewItem } from '../../../services/demand-computation'

const PUSH_PREVIEW_TARGET_TAG_COLORS: Record<
  NonNullable<ComputationPushPreviewItem['target_document']>,
  string
> = {
  work_order: 'blue',
  outsource_work_order: 'purple',
  purchase_requisition: 'cyan',
  purchase_order: 'green',
}

export function getPushPreviewTargetLabel(
  target: ComputationPushPreviewItem['target_document'],
  t: TFunction,
): string {
  if (target === 'outsource_work_order') {
    return t('app.kuaizhizao.workOrder.computationPullPreviewTargetOutsource')
  }
  if (target === 'purchase_requisition') {
    return t('app.kuaizhizao.demandComputation.pushPreviewTargetPurchaseRequisition')
  }
  if (target === 'purchase_order') {
    return t('app.kuaizhizao.demandComputation.pushPreviewTargetPurchaseOrder')
  }
  return t('app.kuaizhizao.workOrder.computationPullPreviewTargetWorkOrder')
}

export function renderPushPreviewTargetBadge(
  target: ComputationPushPreviewItem['target_document'],
  t: TFunction,
): React.ReactNode {
  const label = getPushPreviewTargetLabel(target, t)
  const color = (target && PUSH_PREVIEW_TARGET_TAG_COLORS[target]) || 'default'
  return (
    <Tag color={color} style={{ margin: 0 }}>
      {label}
    </Tag>
  )
}
