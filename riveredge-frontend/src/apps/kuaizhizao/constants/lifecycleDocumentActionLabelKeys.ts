/**
 * 生命周期「下一步建议」与 documentAction.label 对齐（值为 i18n key）。
 * 禁止在 lifecycle 中自造「下推XX」类动作名。
 */
export const LIFECYCLE_DOCUMENT_ACTION_LABEL_KEYS = {
  salesOrderFromSalesContract: 'app.kuaizhizao.documentAction.sales_order.pull_from_sales_contract.label',
  workOrderFromSalesContract: 'app.kuaizhizao.documentAction.work_order.pull_from_sales_contract.label',
  demandComputationFromSalesOrder: 'app.kuaizhizao.documentAction.demand_computation.pull_from_sales_order.label',
  demandComputationFromSalesForecast: 'app.kuaizhizao.documentAction.demand_computation.pull_from_sales_forecast.label',
  demandComputationFromDemand: 'app.kuaizhizao.documentAction.demand_computation.pull_from_demand.label',
  shipmentNoticeFromSalesOrder: 'app.kuaizhizao.documentAction.shipment_notice.pull_from_sales_order.label',
  salesDeliveryFromSalesOrder: 'app.kuaizhizao.documentAction.sales_delivery.pull_from_sales_order.label',
  salesInvoiceFromSalesOrder: 'app.kuaizhizao.documentAction.sales_invoice.pull_from_sales_order.label',
  receiptNoticeFromPurchaseOrder: 'app.kuaizhizao.documentAction.receipt_notice.pull_from_purchase_order.label',
  purchaseReceiptFromPurchaseOrder: 'app.kuaizhizao.documentAction.purchase_receipt.pull_from_purchase_order.label',
  workOrderFromDemandComputation: 'app.kuaizhizao.documentAction.work_order.pull_from_demand_computation.label',
  purchaseRequisitionFromDemandComputation:
    'app.kuaizhizao.documentAction.purchase_requisition.pull_from_demand_computation.label',
  purchaseOrderFromDemandComputation: 'app.kuaizhizao.documentAction.purchase_order.pull_from_demand_computation.label',
} as const;
