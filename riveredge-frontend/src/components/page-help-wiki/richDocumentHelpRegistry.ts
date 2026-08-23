import type { HelpFaqDef, HelpSectionDef } from './buildWikiFromSections';
import { DOCUMENT_LIST_HELP_KEYS, type DocumentListHelpKey } from './documentListHelpRegistry';

export type RichDocHelpProfile = 'detailTable' | 'workOrder';

const docPrefix = (docKey: string) => `help.document.${docKey}`;

/** 第一批次及后续已编写富文本帮助的单据 */
export const RICH_DOCUMENT_HELP_KEYS: DocumentListHelpKey[] = [
  DOCUMENT_LIST_HELP_KEYS.salesOrder,
  DOCUMENT_LIST_HELP_KEYS.purchaseOrder,
  DOCUMENT_LIST_HELP_KEYS.workOrder,
  DOCUMENT_LIST_HELP_KEYS.quotation,
  DOCUMENT_LIST_HELP_KEYS.purchaseRequisition,
  DOCUMENT_LIST_HELP_KEYS.shipmentNotice,
  DOCUMENT_LIST_HELP_KEYS.receiptNotice,
  DOCUMENT_LIST_HELP_KEYS.salesContract,
];

export const RICH_DOC_HELP_PROFILES: Record<DocumentListHelpKey, RichDocHelpProfile> = {
  [DOCUMENT_LIST_HELP_KEYS.salesOrder]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.purchaseOrder]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.quotation]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.purchaseRequisition]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.shipmentNotice]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.receiptNotice]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.salesContract]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.salesForecast]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.salesReturn]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.purchaseInquiry]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.purchaseReturn]: 'detailTable',
  [DOCUMENT_LIST_HELP_KEYS.workOrder]: 'workOrder',
};

export function isRichDocumentHelpKey(docKey: string): docKey is DocumentListHelpKey {
  return (RICH_DOCUMENT_HELP_KEYS as string[]).includes(docKey);
}

const FAQ_COUNT = 6;
const GUIDE_CHILD_KEYS = ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6'] as const;

function buildOverviewSection(docKey: string): HelpSectionDef {
  const p = docPrefix(docKey);
  return {
    key: '1',
    labelKey: `${p}.overview.label`,
    titleKey: `${p}.overview.title`,
    bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
    bullets: [`${p}.overview.b1`, `${p}.overview.b2`, `${p}.overview.b3`, `${p}.overview.b4`],
  };
}

function buildWorkflowSection(docKey: string): HelpSectionDef {
  const p = docPrefix(docKey);
  return {
    key: '2',
    labelKey: `${p}.workflow.label`,
    titleKey: `${p}.workflow.title`,
    bodyKeys: [`${p}.workflow.p1`],
    orderedSteps: [`${p}.workflow.s1`, `${p}.workflow.s2`, `${p}.workflow.s3`, `${p}.workflow.s4`, `${p}.workflow.s5`, `${p}.workflow.s6`],
  };
}

function buildLayoutSection(docKey: string): HelpSectionDef {
  const p = docPrefix(docKey);
  return {
    key: '3',
    labelKey: `${p}.layout.label`,
    titleKey: `${p}.layout.title`,
    bodyKeys: [`${p}.layout.p1`],
    bullets: [`${p}.layout.b1`, `${p}.layout.b2`, `${p}.layout.b3`, `${p}.layout.b4`],
  };
}

function buildSearchSection(docKey: string): HelpSectionDef {
  const p = docPrefix(docKey);
  return {
    key: '4',
    labelKey: `${p}.search.label`,
    titleKey: `${p}.search.title`,
    bodyKeys: [`${p}.search.p1`],
    bullets: [`${p}.search.b1`, `${p}.search.b2`, `${p}.search.b3`, `${p}.search.b4`, `${p}.search.b5`, `${p}.search.b6`],
  };
}

function buildGuideSections(docKey: string, profile: RichDocHelpProfile): HelpSectionDef[] {
  const p = docPrefix(docKey);
  const viewsSection: HelpSectionDef =
    profile === 'workOrder'
      ? {
          key: '5.2',
          labelKey: `${p}.views.label`,
          titleKey: `${p}.views.title`,
          bodyKeys: [`${p}.views.p1`],
          subsections: [
            {
              titleKey: `${p}.views.tableTitle`,
              bodyKeys: [`${p}.views.tableP1`],
              bullets: [`${p}.views.tableB1`, `${p}.views.tableB2`, `${p}.views.tableB3`],
            },
            {
              titleKey: `${p}.views.productTreeTitle`,
              bodyKeys: [`${p}.views.productTreeP1`],
              bullets: [`${p}.views.productTreeB1`, `${p}.views.productTreeB2`, `${p}.views.productTreeB3`],
            },
            {
              titleKey: `${p}.views.orderTreeTitle`,
              bodyKeys: [`${p}.views.orderTreeP1`],
              bullets: [`${p}.views.orderTreeB1`, `${p}.views.orderTreeB2`, `${p}.views.orderTreeB3`],
            },
          ],
          parentKey: 'guide',
        }
      : {
          key: '5.2',
          labelKey: `${p}.views.label`,
          titleKey: `${p}.views.title`,
          bodyKeys: [`${p}.views.p1`],
          subsections: [
            {
              titleKey: `${p}.views.orderTitle`,
              bodyKeys: [`${p}.views.orderP1`],
              bullets: [`${p}.views.orderB1`, `${p}.views.orderB2`, `${p}.views.orderB3`],
            },
            {
              titleKey: `${p}.views.detailTitle`,
              bodyKeys: [`${p}.views.detailP1`],
              bullets: [`${p}.views.detailB1`, `${p}.views.detailB2`, `${p}.views.detailB3`],
            },
          ],
          parentKey: 'guide',
        };

  return [
    {
      key: '5.1',
      labelKey: `${p}.create.label`,
      titleKey: `${p}.create.title`,
      bodyKeys: [`${p}.create.p1`],
      orderedSteps: [`${p}.create.s1`, `${p}.create.s2`, `${p}.create.s3`, `${p}.create.s4`],
      bullets: [`${p}.create.b1`, `${p}.create.b2`, `${p}.create.b3`],
      parentKey: 'guide',
    },
    viewsSection,
    {
      key: '5.3',
      labelKey: `${p}.batch.label`,
      titleKey: `${p}.batch.title`,
      bodyKeys: [`${p}.batch.p1`],
      bullets: [`${p}.batch.b1`, `${p}.batch.b2`, `${p}.batch.b3`, `${p}.batch.b4`, `${p}.batch.b5`, `${p}.batch.b6`],
      parentKey: 'guide',
    },
    {
      key: '5.4',
      labelKey: `${p}.push.label`,
      titleKey: `${p}.push.title`,
      bodyKeys: [`${p}.push.p1`, `${p}.push.p2`],
      bullets: [`${p}.push.b1`, `${p}.push.b2`, `${p}.push.b3`, `${p}.push.b4`, `${p}.push.b5`, `${p}.push.b6`, `${p}.push.b7`, `${p}.push.b8`],
      alert: { titleKey: `${p}.push.alert`, type: 'info' },
      parentKey: 'guide',
    },
    {
      key: '5.5',
      labelKey: `${p}.lifecycle.label`,
      titleKey: `${p}.lifecycle.title`,
      bodyKeys: [`${p}.lifecycle.p1`],
      subsections: [
        {
          titleKey: `${p}.lifecycle.auditTitle`,
          bodyKeys: [`${p}.lifecycle.auditP1`],
          bullets: [`${p}.lifecycle.auditB1`, `${p}.lifecycle.auditB2`, `${p}.lifecycle.auditB3`],
        },
        {
          titleKey: `${p}.lifecycle.closeTitle`,
          bodyKeys: [`${p}.lifecycle.closeP1`],
          bullets: [`${p}.lifecycle.closeB1`, `${p}.lifecycle.closeB2`],
        },
      ],
      parentKey: 'guide',
    },
    {
      key: '5.6',
      labelKey: `${p}.detail.label`,
      titleKey: `${p}.detail.title`,
      bodyKeys: [`${p}.detail.p1`],
      bullets: [`${p}.detail.b1`, `${p}.detail.b2`, `${p}.detail.b3`, `${p}.detail.b4`],
      parentKey: 'guide',
    },
  ];
}

export function buildRichDocumentFaqs(docKey: string): HelpFaqDef[] {
  const p = docPrefix(docKey);
  return Array.from({ length: FAQ_COUNT }, (_, index) => {
    const n = index + 1;
    return { qKey: `${p}.faq.q${n}`, aKey: `${p}.faq.a${n}` };
  });
}

export function buildRichDocumentHelpSections(docKey: DocumentListHelpKey): HelpSectionDef[] {
  const profile = RICH_DOC_HELP_PROFILES[docKey] ?? 'detailTable';
  return [
    buildOverviewSection(docKey),
    buildWorkflowSection(docKey),
    buildLayoutSection(docKey),
    buildSearchSection(docKey),
    ...buildGuideSections(docKey, profile),
  ];
}

export function buildRichDocumentHelpTreeOptions(docKey: string) {
  const p = docPrefix(docKey);
  return {
    folderNodes: [
      {
        key: 'guide',
        titleKey: `${p}.guide.label`,
        childKeys: [...GUIDE_CHILD_KEYS],
      },
    ],
    defaultExpandedKeys: ['guide'],
  };
}
