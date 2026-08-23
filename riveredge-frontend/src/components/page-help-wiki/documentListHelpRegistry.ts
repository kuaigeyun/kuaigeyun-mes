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
} as const;

export type DocumentListHelpKey = (typeof DOCUMENT_LIST_HELP_KEYS)[keyof typeof DOCUMENT_LIST_HELP_KEYS];
