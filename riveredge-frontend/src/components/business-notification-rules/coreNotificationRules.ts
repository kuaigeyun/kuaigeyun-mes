/** 快制造（kuaizhizao）业务消息提醒单据类型 */

export const CORE_NOTIFICATION_DOCUMENT_OPTIONS = [
  { value: 'sales_order', labelKey: 'pages.system.configCenter.notification.document.sales_order', fallback: '销售订单' },
  { value: 'quotation', labelKey: 'pages.system.configCenter.notification.document.quotation', fallback: '报价单' },
  { value: 'purchase_order', labelKey: 'pages.system.configCenter.notification.document.purchase_order', fallback: '采购订单' },
  { value: 'work_order', labelKey: 'pages.system.configCenter.notification.document.work_order', fallback: '工单' },
  {
    value: 'quality_inspection',
    labelKey: 'pages.system.configCenter.notification.document.quality_inspection',
    fallback: '质检单',
  },
  {
    value: 'quality_exception',
    labelKey: 'pages.system.configCenter.notification.document.quality_exception',
    fallback: '质量异常单',
  },
  {
    value: 'equipment_fault',
    labelKey: 'pages.system.configCenter.notification.document.equipment_fault',
    fallback: '设备故障单',
  },
  {
    value: 'maintenance_order',
    labelKey: 'pages.system.configCenter.notification.document.maintenance_order',
    fallback: '维保工单',
  },
  {
    value: 'shipment_notice',
    labelKey: 'pages.system.configCenter.notification.document.shipment_notice',
    fallback: '发货通知',
  },
  { value: 'inbound', labelKey: 'pages.system.configCenter.notification.document.inbound', fallback: '入库单' },
  { value: 'outbound', labelKey: 'pages.system.configCenter.notification.document.outbound', fallback: '出库单' },
] as const;

export const CORE_NOTIFICATION_ACTION_OPTIONS: Record<
  string,
  Array<{ value: string; labelKey: string; fallback: string }>
> = {
  sales_order: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.sales_order.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.sales_order.approved', fallback: '审核通过' },
    {
      value: 'pushed_to_work_order',
      labelKey: 'pages.system.configCenter.notification.action.sales_order.pushed_to_work_order',
      fallback: '下推工单',
    },
    {
      value: 'delivery_delayed',
      labelKey: 'pages.system.configCenter.notification.action.sales_order.delivery_delayed',
      fallback: '交期延误',
    },
  ],
  quotation: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.quotation.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.quotation.approved', fallback: '审核通过' },
    {
      value: 'customer_confirmed',
      labelKey: 'pages.system.configCenter.notification.action.quotation.customer_confirmed',
      fallback: '客户确认',
    },
    {
      value: 'converted_to_order',
      labelKey: 'pages.system.configCenter.notification.action.quotation.converted_to_order',
      fallback: '转销售订单',
    },
  ],
  purchase_order: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.purchase_order.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.purchase_order.approved', fallback: '审核通过' },
    {
      value: 'pushed_to_receipt',
      labelKey: 'pages.system.configCenter.notification.action.purchase_order.pushed_to_receipt',
      fallback: '下推收货',
    },
    {
      value: 'delivery_delayed',
      labelKey: 'pages.system.configCenter.notification.action.purchase_order.delivery_delayed',
      fallback: '交期延误',
    },
  ],
  work_order: [
    { value: 'released', labelKey: 'pages.system.configCenter.notification.action.work_order.released', fallback: '下达' },
    { value: 'started', labelKey: 'pages.system.configCenter.notification.action.work_order.started', fallback: '开工' },
    { value: 'completed', labelKey: 'pages.system.configCenter.notification.action.work_order.completed', fallback: '完工' },
    { value: 'reworked', labelKey: 'pages.system.configCenter.notification.action.work_order.reworked', fallback: '转返工' },
  ],
  quality_inspection: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.submitted', fallback: '提交' },
    { value: 'approved', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.approved', fallback: '审核通过' },
    { value: 'rejected', labelKey: 'pages.system.configCenter.notification.action.quality_inspection.rejected', fallback: '驳回' },
    {
      value: 'abnormal_detected',
      labelKey: 'pages.system.configCenter.notification.action.quality_inspection.abnormal_detected',
      fallback: '检出异常',
    },
  ],
  quality_exception: [
    { value: 'created', labelKey: 'pages.system.configCenter.notification.action.quality_exception.created', fallback: '新建异常' },
    { value: 'assigned', labelKey: 'pages.system.configCenter.notification.action.quality_exception.assigned', fallback: '分派处理' },
    { value: 'closed', labelKey: 'pages.system.configCenter.notification.action.quality_exception.closed', fallback: '异常关闭' },
  ],
  equipment_fault: [
    { value: 'reported', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.reported', fallback: '故障报修' },
    { value: 'assigned', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.assigned', fallback: '派工维修' },
    { value: 'resolved', labelKey: 'pages.system.configCenter.notification.action.equipment_fault.resolved', fallback: '故障恢复' },
  ],
  maintenance_order: [
    { value: 'created', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.created', fallback: '新建维保' },
    { value: 'started', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.started', fallback: '开始维保' },
    { value: 'completed', labelKey: 'pages.system.configCenter.notification.action.maintenance_order.completed', fallback: '完成维保' },
  ],
  shipment_notice: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.shipment_notice.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.shipment_notice.confirmed', fallback: '确认发货' },
    {
      value: 'delivery_delayed',
      labelKey: 'pages.system.configCenter.notification.action.shipment_notice.delivery_delayed',
      fallback: '发货延误',
    },
  ],
  inbound: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.inbound.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.inbound.confirmed', fallback: '确认入库' },
  ],
  outbound: [
    { value: 'submitted', labelKey: 'pages.system.configCenter.notification.action.outbound.submitted', fallback: '提交' },
    { value: 'confirmed', labelKey: 'pages.system.configCenter.notification.action.outbound.confirmed', fallback: '确认出库' },
  ],
};

export const CORE_NOTIFICATION_RECIPIENT_SCOPES = [
  { value: 'creator', labelKey: 'pages.system.configCenter.notification.scope.creator', fallback: '创建人/申请人' },
  { value: 'salesman', labelKey: 'pages.system.configCenter.notification.scope.salesman', fallback: '业务员' },
  { value: 'follower', labelKey: 'pages.system.configCenter.notification.scope.follower', fallback: '跟单员' },
];
