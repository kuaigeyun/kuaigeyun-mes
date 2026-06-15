export const OUTBOUND_LIST_PATH = '/apps/kuaizhizao/warehouse-management/outbound';

export const outboundWorkOrderEntryPath = (woId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/work-order/${woId}`;

export const outboundSalesOrderEntryPath = (soId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/sales-order/${soId}`;

export const outboundShipmentNoticeEntryPath = (noticeId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/shipment-notice/${noticeId}`;

export const outboundOutsourceEntryPath = (woId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/outsource-work-order/${woId}`;
