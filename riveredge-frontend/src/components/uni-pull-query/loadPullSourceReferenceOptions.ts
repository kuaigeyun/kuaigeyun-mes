/**
 * 取单来源筛选项 / 仓库下拉：走 reference-display（read|display），禁止直调来源单据 list（需 :read）。
 */

import {
  REFERENCE_DISPLAY_MAX_PAGE_SIZE,
  formatReferenceDisplayLabel,
  searchReferenceDisplay,
  searchReferenceDisplayAll,
} from '../../utils/referenceDisplay';

/** 常见取单来源的 reference-display resource（与 manifest reference_resources / Provider 一致） */
export const PULL_SOURCE_REFERENCE = {
  purchaseOrder: 'kuaizhizao:purchase-order',
  salesOrder: 'kuaizhizao:sales-order',
  receiptNotice: 'kuaizhizao:receipt-notice',
  shipmentNotice: 'kuaizhizao:shipment-notice',
  workOrder: 'kuaizhizao:work-order',
  /** 委外取单筛选项用委外工单（与 outsource_work_order_id 一致） */
  outsourceWorkOrder: 'kuaizhizao:outsource-work-order',
  outsourceOrder: 'kuaizhizao:outsource-order',
  purchaseRequisition: 'kuaizhizao:purchase-requisition',
  purchaseInquiry: 'kuaizhizao:purchase-inquiry',
  demandComputation: 'kuaizhizao:plan-management-demand-computation',
  warehouse: 'master-data:warehouse:warehouse',
} as const;

export type PullSourceSelectOption = { value: number; label: string };

export async function loadPullSourceReferenceOptions(args: {
  resource: string;
  hostResource: string;
  /** 默认 100；超过单页上限则分页拉齐 */
  maxItems?: number;
  isActive?: boolean;
}): Promise<PullSourceSelectOption[]> {
  const maxItems = args.maxItems ?? 100;
  const base = {
    resource: args.resource,
    hostResource: args.hostResource,
    isActive: args.isActive,
  };
  const items =
    maxItems <= REFERENCE_DISPLAY_MAX_PAGE_SIZE
      ? (
          await searchReferenceDisplay({
            ...base,
            pageSize: maxItems,
          })
        ).items ?? []
      : await searchReferenceDisplayAll(base, maxItems);

  return items
    .filter((row) => row.id != null)
    .map((row) => ({
      value: Number(row.id),
      label: formatReferenceDisplayLabel(row) || String(row.code || row.id),
    }));
}

/** 取单行上选仓：仓库回显即可，不必 master-data:warehouse:read */
export async function loadPullWarehouseReferenceOptions(
  hostResource: string,
  maxItems = 500,
): Promise<PullSourceSelectOption[]> {
  return loadPullSourceReferenceOptions({
    resource: PULL_SOURCE_REFERENCE.warehouse,
    hostResource,
    maxItems,
    isActive: true,
  });
}
