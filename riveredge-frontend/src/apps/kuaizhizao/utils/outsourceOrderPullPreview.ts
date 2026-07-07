import type { PushPreviewResponse } from '../services/sales-order';

export type OutsourceOptionLike = {
  work_order_operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  max_quantity?: number | string;
  completed_quantity?: number | string;
  already_outsourced_quantity?: number | string;
  outsourceable_quantity?: number | string;
};

export function mapOutsourceOptionsToPullPreview(
  workOrderCode: string,
  options: OutsourceOptionLike[],
  t: (key: string, options?: Record<string, unknown>) => string,
): PushPreviewResponse {
  const items = options.map((opt) => ({
    item_id: Number(opt.work_order_operation_id ?? 0),
    material_code: String(opt.operation_code ?? ''),
    material_name: String(opt.operation_name ?? ''),
    quantity: Number(opt.max_quantity ?? 0),
    pushed_quantity:
      Number(opt.completed_quantity ?? 0) + Number(opt.already_outsourced_quantity ?? 0),
    max_push_quantity: Number(opt.outsourceable_quantity ?? 0),
  }));
  const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
  let blockingReason: string | null = null;
  if (!items.length || pushableCount === 0) {
    blockingReason = t('app.kuaizhizao.outsourceOrder.pullPreviewNoLines');
  }
  return {
    target_type: 'outsource_order',
    summary: t('app.kuaizhizao.outsourceOrder.pullPreviewSummary', {
      code: workOrderCode,
      pushable: pushableCount,
      total: items.length,
    }),
    items,
    tip: t('app.kuaizhizao.outsourceOrder.pullPreviewTip'),
    has_blocking_issues: !!blockingReason,
    blocking_reason: blockingReason,
  };
}
