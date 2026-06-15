export const INBOUND_LIST_PATH = '/apps/kuaizhizao/warehouse-management/inbound';

export const inboundPoEntryPath = (poId: number) =>
  `${INBOUND_LIST_PATH}/entry/purchase-order/${poId}`;

/** 收货通知取单：当前统一跳转采购订单入库录入页 */
export const inboundReceiptNoticeEntryPath = (noticeId: number) =>
  `${INBOUND_LIST_PATH}/entry/receipt-notice/${noticeId}`;

export const inboundWorkOrderEntryPath = (woId: number) =>
  `${INBOUND_LIST_PATH}/entry/work-order/${woId}`;

export const inboundProductionReturnEntryPath = (workOrderId: number) =>
  `${INBOUND_LIST_PATH}/entry/production-return/${workOrderId}`;

export const inboundSalesReturnEntryPath = (salesOrderId: number) =>
  `${INBOUND_LIST_PATH}/entry/sales-order/${salesOrderId}`;

export const inboundOutsourceEntryPath = (woId: number, pullType: string) =>
  `${INBOUND_LIST_PATH}/entry/outsource-work-order/${woId}?pullType=${encodeURIComponent(pullType)}`;
