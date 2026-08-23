import type { HelpFaqDef, HelpSectionDef } from './buildWikiFromSections';

const docPrefix = (docKey: string) => `help.document.${docKey}`;

/** 标准单据列表帮助章节（概述 / 视图 / 工具栏 / 流程） */
export function buildStandardDocumentSections(docKey: string): HelpSectionDef[] {
  const p = docPrefix(docKey);
  return [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
    },
    {
      key: '2',
      labelKey: `${p}.views.label`,
      titleKey: `${p}.views.title`,
      bodyKeys: [`${p}.views.p1`, `${p}.views.p2`],
    },
    {
      key: '3',
      labelKey: `${p}.toolbar.label`,
      titleKey: `${p}.toolbar.title`,
      bodyKeys: [`${p}.toolbar.p1`, `${p}.toolbar.p2`],
      parentKey: 'guide',
    },
    {
      key: '4',
      labelKey: `${p}.lifecycle.label`,
      titleKey: `${p}.lifecycle.title`,
      bodyKeys: [`${p}.lifecycle.p1`, `${p}.lifecycle.p2`],
      parentKey: 'guide',
    },
  ];
}

export function buildStandardDocumentFaqs(docKey: string): HelpFaqDef[] {
  const p = docPrefix(docKey);
  return [
    { qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` },
    { qKey: `${p}.faq.q2`, aKey: `${p}.faq.a2` },
  ];
}

/** 操作指南父节点（3.x 章节挂在「操作指南」下） */
export function withGuideParent(sections: HelpSectionDef[]): HelpSectionDef[] {
  return sections.map((section) => {
    if (section.key === '1' || section.key === '2') return section;
    return { ...section, parentKey: section.parentKey ?? 'guide' };
  });
}

export function buildGuideTreeSections(docKey: string): HelpSectionDef[] {
  const base = buildStandardDocumentSections(docKey);
  return [
    base[0],
    base[1],
    ...base.slice(2).map((s) => ({ ...s, parentKey: 'guide' as const })),
  ];
}

export function buildGuideTreeOptions(docKey: string) {
  return {
    folderNodes: [
      {
        key: 'guide',
        titleKey: `${docPrefix(docKey)}.guide.label`,
        childKeys: ['3', '4'],
      },
    ],
    defaultExpandedKeys: ['guide'],
  };
}

export const DOCUMENT_LIST_HELP_KEYS = {
  salesOrder: 'sales-order',
  salesContract: 'sales-contract',
  quotation: 'quotation',
  salesForecast: 'sales-forecast',
  shipmentNotice: 'shipment-notice',
  salesReturn: 'sales-return',
  purchaseOrder: 'purchase-order',
  purchaseRequisition: 'purchase-requisition',
  purchaseInquiry: 'purchase-inquiry',
  receiptNotice: 'receipt-notice',
  purchaseReturn: 'purchase-return',
  workOrder: 'work-order',
  // batch3 kuaizhizao
  salesDelivery: 'sales-delivery',
  salesOrderChange: 'sales-order-change',
  salesReview: 'sales-review',
  purchaseOrderChange: 'purchase-order-change',
  purchaseReceipt: 'purchase-receipt',
  demandComputation: 'demand-computation',
  demandManagement: 'demand-management',
  incomingInspection: 'incoming-inspection',
  finishedGoodsInspection: 'finished-goods-inspection',
  processInspection: 'process-inspection',
  oqcInspection: 'oqc-inspection',
  faiOrder: 'fai-order',
  outsourceWorkOrder: 'outsource-work-order',
  outsourceOrder: 'outsource-order',
  reworkOrder: 'rework-order',
  reporting: 'reporting',
  stocktaking: 'stocktaking',
  inventoryTransfer: 'inventory-transfer',
  otherInbound: 'other-inbound',
  otherOutbound: 'other-outbound',
  materialBorrow: 'material-borrow',
  materialReturn: 'material-return',
  deliveryNote: 'delivery-note',
  // batch3 equipment
  equipmentRepairs: 'equipment-repairs',
  equipmentFaults: 'equipment-faults',
  equipmentCalibrations: 'equipment-calibrations',
  equipmentScrap: 'equipment-scrap',
  equipmentTransfers: 'equipment-transfers',
  equipmentStatus: 'equipment-status',
  maintenancePlans: 'maintenance-plans',
  maintenanceExecutions: 'maintenance-executions',
  maintenanceReminders: 'maintenance-reminders',
  maintenancePlanCalendar: 'maintenance-plan-calendar',
  spotChecks: 'spot-checks',
  routePatrols: 'route-patrols',
  sparePartRequisitions: 'spare-part-requisitions',
  spareParts: 'spare-parts',
  maintenanceSchemes: 'maintenance-schemes',
  maintenanceItems: 'maintenance-items',
  inspectionSchemes: 'inspection-schemes',
  inspectionItems: 'inspection-items',
  patrolRoutes: 'patrol-routes',
  moldRepairs: 'mold-repairs',
  moldMaintenances: 'mold-maintenances',
  moldCalibrations: 'mold-calibrations',
  moldBorrows: 'mold-borrows',
  moldReturns: 'mold-returns',
  moldScrapApplications: 'mold-scrap-applications',
  moldTrials: 'mold-trials',
  moldMaintenanceSchemes: 'mold-maintenance-schemes',
  moldMaintenanceItems: 'mold-maintenance-items',
  moldRepairSchemes: 'mold-repair-schemes',
  moldRepairItems: 'mold-repair-items',
  toolRepairs: 'tool-repairs',
  toolMaintenances: 'tool-maintenances',
  toolCalibrations: 'tool-calibrations',
  toolBorrows: 'tool-borrows',
  toolReturns: 'tool-returns',
  toolScrapApplications: 'tool-scrap-applications',
  toolMaintenanceSchemes: 'tool-maintenance-schemes',
  toolMaintenanceItems: 'tool-maintenance-items',
  toolRepairSchemes: 'tool-repair-schemes',
  toolRepairItems: 'tool-repair-items',
  // batch3 kuaicaiwu
  receipt: 'receipt',
  payment: 'payment',
  receivable: 'receivable',
  payable: 'payable',
  salesInvoice: 'sales-invoice',
  purchaseInvoice: 'purchase-invoice',
  settlement: 'settlement',
  priceSettlement: 'price-settlement',
  voucher: 'voucher',
  prepayment: 'prepayment',
  notesReceivable: 'notes-receivable',
  notesPayable: 'notes-payable',
  bankAccount: 'bank-account',
  documentReconciliation: 'document-reconciliation',
  openingBalance: 'opening-balance',

  // batch4
  afterSalesTicket: 'after-sales-ticket',
  afterSalesDispatch: 'after-sales-dispatch',
  afterSalesRepair: 'after-sales-repair',
  afterSalesInstall: 'after-sales-install',
  afterSalesReturnVisit: 'after-sales-return-visit',
  afterSalesServiceAsset: 'after-sales-service-asset',
  afterSalesSettlement: 'after-sales-settlement',
  afterSalesSpareRequisition: 'after-sales-spare-requisition',
  freightOrder: 'freight-order',
  freightBill: 'freight-bill',
  deliveryDelayException: 'delivery-delay-exception',
  materialShortageException: 'material-shortage-exception',
  qualityException: 'quality-exception',
  exceptionProcess: 'exception-process',
  packingBinding: 'packing-binding',
  exceptionDeliveryDelay: 'exception-delivery-delay',
  exceptionMaterialShortage: 'exception-material-shortage',
  eightDReport: 'eight-d-report',
  internalAudit: 'internal-audit',
  managementReview: 'management-review',
  nonconformingLedger: 'nonconforming-ledger',
  periodClose: 'period-close',
} as const;

export type DocumentListHelpKey = (typeof DOCUMENT_LIST_HELP_KEYS)[keyof typeof DOCUMENT_LIST_HELP_KEYS];
