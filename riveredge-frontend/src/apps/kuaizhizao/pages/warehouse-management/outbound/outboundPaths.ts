export const OUTBOUND_LIST_PATH = '/apps/kuaizhizao/warehouse-management/outbound';

export const outboundWorkOrderEntryPath = (woId: number, materialCallId?: number) => {
  const base = `${OUTBOUND_LIST_PATH}/entry/work-order/${woId}`;
  if (materialCallId != null && materialCallId > 0) {
    return `${base}?materialCallId=${materialCallId}`;
  }
  return base;
};

export const outboundSalesOrderEntryPath = (soId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/sales-order/${soId}`;

export const outboundShipmentNoticeEntryPath = (noticeId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/shipment-notice/${noticeId}`;

export const outboundOutsourceEntryPath = (woId: number) =>
  `${OUTBOUND_LIST_PATH}/entry/outsource-work-order/${woId}`;
