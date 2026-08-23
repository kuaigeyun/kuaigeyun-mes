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
  | 'personal.tasks'
  | 'masterData.customers'
  | 'masterData.suppliers'
  | 'masterData.partnerPriceBooks'
  | 'masterData.materials'
  | 'masterData.marketPrices'
  | 'masterData.units'
  | 'masterData.batches'
  | 'masterData.batchRules'
  | 'masterData.serials'
  | 'masterData.serialRules'
  | 'masterData.variantAttributes'
  | 'masterData.routes'
  | 'masterData.operations'
  | 'masterData.sop'
  | 'masterData.drawings'
  | 'masterData.drawingWhereUsed'
  | 'masterData.defectTypes'
  | 'system.users'
  | 'system.roles'
  | 'system.menus'
  | 'system.permissions'
  | 'system.customFields'
  | 'system.dataDictionaries'
  | 'system.languages'
  | 'system.approvalProcesses'
  | 'system.messageTemplates'
  | 'system.messageConfig'
  | 'system.applicationConnections'
  | 'system.apis'
  | 'system.datasets'
  | 'system.reportTemplates'
  | 'system.operationLogs'
  | 'system.loginLogs'
  | 'system.invitationCodes'
  | 'system.pluginManager'
  | 'system.workingHoursConfigs'
  | 'system.equipment'
  | 'system.molds'
  | 'kuaizhizao.purchaseArrivalWarnings'
  | 'kuaizhizao.customerPool'
  | 'kuaizhizao.customerFollowUps'
  | 'kuaizhizao.inventory'
  | 'kuaizhizao.inventoryAlert'
  | 'kuaizhizao.equipmentLedger'
  | 'kuaizhizao.moldsLedger'
  | 'kuaizhizao.toolsLedger'
  | 'kuaicaiwu.chartOfAccounts'
  | 'kuaicaiwu.cashier'
  | 'kuaicaiwu.books'
  | 'kuaicaiwu.financialStatements'
  | 'kuaicaiwu.glSettings'
  | 'kuaicaiwu.taxSettings'
  | 'kuaicaiwu.vatLedger'
  | 'kuaicaiwu.inputCertification'
  | 'kuaicaiwu.standardCosts'
  | 'kuaicaiwu.costCalculations'
  | 'kuaicaiwu.costRules'
  | 'kuaizhizao.hourlyRates'
  | 'kuaizhizao.performanceSummaries'
  | 'kuaizhizao.employeeConfigs'
  | 'kuaizhizao.kpiDefinitions'
  | 'kuaizhizao.shifts'
  | 'kuaizhizao.skills'
  | 'kuaizhizao.holidays'
  | 'kuaizhizao.workCalendar'
  | 'kuaizhizao.carriers'
  | 'kuaizhizao.drivers'
  | 'kuaizhizao.vehicles'
  | 'kuaizhizao.computationHistory'
  | 'kuaizhizao.demandReplanDashboard'
  | 'kuaizhizao.scheduling'
  | 'kuaizhizao.inspectionPlans'
  | 'kuaizhizao.isoClauses'
  | 'kuaizhizao.spcMonitor'
  | 'kuaizhizao.systemDocuments'
  | 'kuaizhizao.backflushRecords'
  | 'kuaizhizao.barcodeMappingRules'
  | 'kuaizhizao.batchInventoryQuery'
  | 'kuaizhizao.batchingCenter'
  | 'kuaizhizao.customerMaterialRegistration'
  | 'kuaizhizao.lineSideWarehouse'
  | 'kuaizhizao.replenishmentSuggestions'
  | 'kuaizhizao.moldMaintenanceReminders'
  | 'kuaizhizao.toolMaintenanceReminders'
  | 'kuaizhizao.documentTiming'
  | 'masterData.drawingDistributions'
  | 'masterData.drawingLoans'
  | 'infra.clientReleases'
  | 'infra.licenseManagement'
  | 'infra.packages'
  | 'infra.scheduledTasks'
  | 'infra.scripts'
  | 'infra.sensitiveWordBlacklist'
  | 'system.equipmentFaults'
  | 'system.maintenancePlans'
  | 'kuaiai.knowledge'
  | 'kuaiiot.alerts'
  | 'kuaiiot.connections'
  | 'kuaiiot.devices'
  | 'kuaiiot.edgeConfigs'
  | 'kuaiiot.products'
  | 'kuaiiot.tags'
  | 'kuaiplm.changeManagement'
  | 'kuaiplm.knowledgeBase'
  | 'kuaiplm.designReviews'
  | 'kuaiplm.fmea'
  | 'kuaiplm.requirements'
  | 'kuaiplm.rdProjects'
  | 'kuaicaiwu.marginReport';

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
  'masterData.customers',
  'masterData.suppliers',
  'masterData.partnerPriceBooks',
  'masterData.materials',
  'masterData.marketPrices',
  'masterData.units',
  'masterData.batches',
  'masterData.batchRules',
  'masterData.serials',
  'masterData.serialRules',
  'masterData.variantAttributes',
  'masterData.routes',
  'masterData.operations',
  'masterData.sop',
  'masterData.drawings',
  'masterData.drawingWhereUsed',
  'masterData.defectTypes',
  'system.users',
  'system.roles',
  'system.menus',
  'system.permissions',
  'system.customFields',
  'system.dataDictionaries',
  'system.languages',
  'system.approvalProcesses',
  'system.messageTemplates',
  'system.messageConfig',
  'system.applicationConnections',
  'system.apis',
  'system.datasets',
  'system.reportTemplates',
  'system.operationLogs',
  'system.loginLogs',
  'system.invitationCodes',
  'system.pluginManager',
  'system.workingHoursConfigs',
  'system.equipment',
  'system.molds',
  'kuaizhizao.purchaseArrivalWarnings',
  'kuaizhizao.customerPool',
  'kuaizhizao.customerFollowUps',
  'kuaizhizao.inventory',
  'kuaizhizao.inventoryAlert',
  'kuaizhizao.equipmentLedger',
  'kuaizhizao.moldsLedger',
  'kuaizhizao.toolsLedger',
  'kuaicaiwu.chartOfAccounts',
  'kuaicaiwu.cashier',
  'kuaicaiwu.books',
  'kuaicaiwu.financialStatements',
  'kuaicaiwu.glSettings',
  'kuaicaiwu.taxSettings',
  'kuaicaiwu.vatLedger',
  'kuaicaiwu.inputCertification',
  'kuaicaiwu.standardCosts',
  'kuaicaiwu.costCalculations',
  'kuaicaiwu.costRules',
  'kuaizhizao.hourlyRates',
  'kuaizhizao.performanceSummaries',
  'kuaizhizao.employeeConfigs',
  'kuaizhizao.kpiDefinitions',
  'kuaizhizao.shifts',
  'kuaizhizao.skills',
  'kuaizhizao.holidays',
  'kuaizhizao.workCalendar',
  'kuaizhizao.carriers',
  'kuaizhizao.drivers',
  'kuaizhizao.vehicles',
  'kuaizhizao.computationHistory',
  'kuaizhizao.demandReplanDashboard',
  'kuaizhizao.scheduling',
  'kuaizhizao.inspectionPlans',
  'kuaizhizao.isoClauses',
  'kuaizhizao.spcMonitor',
  'kuaizhizao.systemDocuments',
  'kuaizhizao.backflushRecords',
  'kuaizhizao.barcodeMappingRules',
  'kuaizhizao.batchInventoryQuery',
  'kuaizhizao.batchingCenter',
  'kuaizhizao.customerMaterialRegistration',
  'kuaizhizao.lineSideWarehouse',
  'kuaizhizao.replenishmentSuggestions',
  'kuaizhizao.moldMaintenanceReminders',
  'kuaizhizao.toolMaintenanceReminders',
  'kuaizhizao.documentTiming',
  'masterData.drawingDistributions',
  'masterData.drawingLoans',
  'infra.clientReleases',
  'infra.licenseManagement',
  'infra.packages',
  'infra.scheduledTasks',
  'infra.scripts',
  'infra.sensitiveWordBlacklist',
  'system.equipmentFaults',
  'system.maintenancePlans',
  'kuaiai.knowledge',
  'kuaiiot.alerts',
  'kuaiiot.connections',
  'kuaiiot.devices',
  'kuaiiot.edgeConfigs',
  'kuaiiot.products',
  'kuaiiot.tags',
  'kuaiplm.changeManagement',
  'kuaiplm.knowledgeBase',
  'kuaiplm.designReviews',
  'kuaiplm.fmea',
  'kuaiplm.requirements',
  'kuaiplm.rdProjects',
  'kuaicaiwu.marginReport',
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
  'masterData.customers': 'standard',
  'masterData.suppliers': 'standard',
  'masterData.partnerPriceBooks': 'standard',
  'masterData.materials': 'standard',
  'masterData.marketPrices': 'standard',
  'masterData.units': 'standard',
  'masterData.batches': 'standard',
  'masterData.batchRules': 'standard',
  'masterData.serials': 'standard',
  'masterData.serialRules': 'standard',
  'masterData.variantAttributes': 'standard',
  'masterData.routes': 'standard',
  'masterData.operations': 'standard',
  'masterData.sop': 'standard',
  'masterData.drawings': 'standard',
  'masterData.drawingWhereUsed': 'standard',
  'masterData.defectTypes': 'standard',
  'system.users': 'standard',
  'system.roles': 'standard',
  'system.menus': 'standard',
  'system.permissions': 'standard',
  'system.customFields': 'standard',
  'system.dataDictionaries': 'standard',
  'system.languages': 'standard',
  'system.approvalProcesses': 'standard',
  'system.messageTemplates': 'standard',
  'system.messageConfig': 'standard',
  'system.applicationConnections': 'standard',
  'system.apis': 'standard',
  'system.datasets': 'standard',
  'system.reportTemplates': 'standard',
  'system.operationLogs': 'standard',
  'system.loginLogs': 'standard',
  'system.invitationCodes': 'standard',
  'system.pluginManager': 'standard',
  'system.workingHoursConfigs': 'standard',
  'system.equipment': 'standard',
  'system.molds': 'standard',
  'kuaizhizao.purchaseArrivalWarnings': 'standard',
  'kuaizhizao.customerPool': 'standard',
  'kuaizhizao.customerFollowUps': 'standard',
  'kuaizhizao.inventory': 'standard',
  'kuaizhizao.inventoryAlert': 'standard',
  'kuaizhizao.equipmentLedger': 'standard',
  'kuaizhizao.moldsLedger': 'standard',
  'kuaizhizao.toolsLedger': 'standard',
  'kuaicaiwu.chartOfAccounts': 'standard',
  'kuaicaiwu.cashier': 'standard',
  'kuaicaiwu.books': 'standard',
  'kuaicaiwu.financialStatements': 'standard',
  'kuaicaiwu.glSettings': 'standard',
  'kuaicaiwu.taxSettings': 'standard',
  'kuaicaiwu.vatLedger': 'standard',
  'kuaicaiwu.inputCertification': 'standard',
  'kuaicaiwu.standardCosts': 'standard',
  'kuaicaiwu.costCalculations': 'standard',
  'kuaicaiwu.costRules': 'standard',
  'kuaizhizao.hourlyRates': 'standard',
  'kuaizhizao.performanceSummaries': 'standard',
  'kuaizhizao.employeeConfigs': 'standard',
  'kuaizhizao.kpiDefinitions': 'standard',
  'kuaizhizao.shifts': 'standard',
  'kuaizhizao.skills': 'standard',
  'kuaizhizao.holidays': 'standard',
  'kuaizhizao.workCalendar': 'standard',
  'kuaizhizao.carriers': 'standard',
  'kuaizhizao.drivers': 'standard',
  'kuaizhizao.vehicles': 'standard',
  'kuaizhizao.computationHistory': 'standard',
  'kuaizhizao.demandReplanDashboard': 'standard',
  'kuaizhizao.scheduling': 'standard',
  'kuaizhizao.inspectionPlans': 'standard',
  'kuaizhizao.isoClauses': 'standard',
  'kuaizhizao.spcMonitor': 'standard',
  'kuaizhizao.systemDocuments': 'standard',
  'kuaizhizao.backflushRecords': 'standard',
  'kuaizhizao.barcodeMappingRules': 'standard',
  'kuaizhizao.batchInventoryQuery': 'standard',
  'kuaizhizao.batchingCenter': 'standard',
  'kuaizhizao.customerMaterialRegistration': 'standard',
  'kuaizhizao.lineSideWarehouse': 'standard',
  'kuaizhizao.replenishmentSuggestions': 'standard',
  'kuaizhizao.moldMaintenanceReminders': 'standard',
  'kuaizhizao.toolMaintenanceReminders': 'standard',
  'kuaizhizao.documentTiming': 'standard',
  'masterData.drawingDistributions': 'standard',
  'masterData.drawingLoans': 'standard',
  'infra.clientReleases': 'standard',
  'infra.licenseManagement': 'standard',
  'infra.packages': 'standard',
  'infra.scheduledTasks': 'standard',
  'infra.scripts': 'standard',
  'infra.sensitiveWordBlacklist': 'standard',
  'system.equipmentFaults': 'standard',
  'system.maintenancePlans': 'standard',
  'kuaiai.knowledge': 'standard',
  'kuaiiot.alerts': 'standard',
  'kuaiiot.connections': 'standard',
  'kuaiiot.devices': 'standard',
  'kuaiiot.edgeConfigs': 'standard',
  'kuaiiot.products': 'standard',
  'kuaiiot.tags': 'standard',
  'kuaiplm.changeManagement': 'standard',
  'kuaiplm.knowledgeBase': 'standard',
  'kuaiplm.designReviews': 'standard',
  'kuaiplm.fmea': 'standard',
  'kuaiplm.requirements': 'standard',
  'kuaiplm.rdProjects': 'standard',
  'kuaicaiwu.marginReport': 'standard',
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
