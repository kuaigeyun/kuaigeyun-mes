import type { HelpFaqDef, HelpSectionDef } from './buildWikiFromSections';

export type RichListPageHelpKey =
  | 'masterData.plants'
  | 'masterData.workshops'
  | 'masterData.workCenters'
  | 'masterData.workGroups'
  | 'masterData.productionLines'
  | 'masterData.workstations'
  | 'masterData.warehouses'
  | 'masterData.storageAreas'
  | 'masterData.storageLocations'
  | 'masterData.bom'
  | 'system.departments'
  | 'system.positions'
  | 'system.tenants'
  | 'system.systemParameters'
  | 'system.printTemplates'
  | 'system.printDevices'
  | 'system.integrationConfigs'
  | 'system.dataSources'
  | 'system.approvalInstances'
  | 'system.onlineUsers'
  | 'system.dataBackups'
  | 'personal.tasks';

export type RichListPageProfile = 'standard' | 'bom';

export const RICH_LIST_PAGE_HELP_KEYS: RichListPageHelpKey[] = [
  'masterData.plants',
  'masterData.workshops',
  'masterData.workCenters',
  'masterData.workGroups',
  'masterData.productionLines',
  'masterData.workstations',
  'masterData.warehouses',
  'masterData.storageAreas',
  'masterData.storageLocations',
  'masterData.bom',
  'system.departments',
  'system.positions',
  'system.tenants',
  'system.systemParameters',
  'system.printTemplates',
  'system.printDevices',
  'system.integrationConfigs',
  'system.dataSources',
  'system.approvalInstances',
  'system.onlineUsers',
  'system.dataBackups',
  'personal.tasks',
];

export const RICH_LIST_PAGE_PROFILES: Record<RichListPageHelpKey, RichListPageProfile> = {
  'masterData.plants': 'standard',
  'masterData.workshops': 'standard',
  'masterData.workCenters': 'standard',
  'masterData.workGroups': 'standard',
  'masterData.productionLines': 'standard',
  'masterData.workstations': 'standard',
  'masterData.warehouses': 'standard',
  'masterData.storageAreas': 'standard',
  'masterData.storageLocations': 'standard',
  'masterData.bom': 'bom',
  'system.departments': 'standard',
  'system.positions': 'standard',
  'system.tenants': 'standard',
  'system.systemParameters': 'standard',
  'system.printTemplates': 'standard',
  'system.printDevices': 'standard',
  'system.integrationConfigs': 'standard',
  'system.dataSources': 'standard',
  'system.approvalInstances': 'standard',
  'system.onlineUsers': 'standard',
  'system.dataBackups': 'standard',
  'personal.tasks': 'standard',
};

const prefix = (pageKey: string) => `help.listPage.${pageKey}`;

export function isRichListPageHelpKey(pageKey: string): pageKey is RichListPageHelpKey {
  return (RICH_LIST_PAGE_HELP_KEYS as string[]).includes(pageKey);
}

export function buildRichListPageSections(pageKey: RichListPageHelpKey): HelpSectionDef[] {
  const p = prefix(pageKey);
  const profile = RICH_LIST_PAGE_PROFILES[pageKey];

  const sections: HelpSectionDef[] = [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
      bullets: [`${p}.overview.b1`, `${p}.overview.b2`, `${p}.overview.b3`],
    },
    {
      key: '2',
      labelKey: `${p}.layout.label`,
      titleKey: `${p}.layout.title`,
      bodyKeys: [`${p}.layout.p1`],
      bullets: [`${p}.layout.b1`, `${p}.layout.b2`, `${p}.layout.b3`, `${p}.layout.b4`],
    },
  ];

  if (profile === 'bom') {
    sections.push({
      key: '3',
      labelKey: `${p}.views.label`,
      titleKey: `${p}.views.title`,
      bodyKeys: [`${p}.views.p1`],
      subsections: [
        {
          titleKey: `${p}.views.productTitle`,
          bodyKeys: [`${p}.views.productP1`],
          bullets: [`${p}.views.productB1`, `${p}.views.productB2`],
        },
        {
          titleKey: `${p}.views.semiTitle`,
          bodyKeys: [`${p}.views.semiP1`],
          bullets: [`${p}.views.semiB1`, `${p}.views.semiB2`],
        },
        {
          titleKey: `${p}.views.allTitle`,
          bodyKeys: [`${p}.views.allP1`],
          bullets: [`${p}.views.allB1`, `${p}.views.allB2`],
        },
      ],
    });
  }

  sections.push(
    {
      key: profile === 'bom' ? '4' : '3',
      labelKey: `${p}.operations.label`,
      titleKey: `${p}.operations.title`,
      bodyKeys: [`${p}.operations.p1`],
      orderedSteps: [`${p}.operations.s1`, `${p}.operations.s2`, `${p}.operations.s3`, `${p}.operations.s4`],
      bullets: [`${p}.operations.b1`, `${p}.operations.b2`, `${p}.operations.b3`, `${p}.operations.b4`, `${p}.operations.b5`],
    },
    {
      key: profile === 'bom' ? '5' : '4',
      labelKey: `${p}.search.label`,
      titleKey: `${p}.search.title`,
      bodyKeys: [`${p}.search.p1`],
      bullets: [`${p}.search.b1`, `${p}.search.b2`, `${p}.search.b3`, `${p}.search.b4`],
    },
  );

  return sections;
}

export function buildRichListPageFaqs(pageKey: RichListPageHelpKey): HelpFaqDef[] {
  const p = prefix(pageKey);
  return [
    { qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` },
    { qKey: `${p}.faq.q2`, aKey: `${p}.faq.a2` },
    { qKey: `${p}.faq.q3`, aKey: `${p}.faq.a3` },
    { qKey: `${p}.faq.q4`, aKey: `${p}.faq.a4` },
  ];
}
