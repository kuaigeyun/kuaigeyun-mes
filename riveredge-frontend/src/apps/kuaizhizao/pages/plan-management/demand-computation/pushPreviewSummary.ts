import type { TFunction } from 'i18next'

import type { PushPreview } from '../../../services/demand-computation'

/** 下推预览：单据汇总 + 明细行数，合并为一条说明（替代原 summary 与底部列表重复展示） */
export function buildDemandPushPreviewSummary(data: PushPreview, t: TFunction): string | null {
  const docParts: string[] = []
  if (data.work_order_count > 0) {
    docParts.push(t('app.kuaizhizao.demandComputation.pushWorkOrders', { count: data.work_order_count }))
  }
  if (data.outsource_work_order_count > 0) {
    let label = t('app.kuaizhizao.demandComputation.pushOutsourceWorkOrders', {
      count: data.outsource_work_order_count,
    })
    if (data.validation_failures?.length) {
      label += t('app.kuaizhizao.demandComputation.pushOutsourceDraftHint')
    }
    docParts.push(label)
  }
  if (data.purchase_requisition_count > 0) {
    docParts.push(
      t('app.kuaizhizao.demandComputation.pushPurchaseRequisitions', {
        count: data.purchase_requisition_count,
      }),
    )
  }
  if (data.purchase_order_count > 0) {
    docParts.push(
      t('app.kuaizhizao.demandComputation.pushPurchaseOrders', { count: data.purchase_order_count }),
    )
  }

  const items = data.items ?? []
  const pushable = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length
  const total = items.length
  const code = data.computation_code || ''

  if (docParts.length > 0) {
    return t('app.kuaizhizao.demandComputation.pushPreviewSummaryMerged', {
      code,
      docs: docParts.join('、'),
      pushable,
      total,
    })
  }

  return data.summary?.trim() || null
}
