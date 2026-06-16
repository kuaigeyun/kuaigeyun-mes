import type { TFunction } from 'i18next';

export interface OnboardingSubItem {
  id?: string;
  name: string;
  description: string;
  required: boolean;
  jump_path: string;
  check_key?: string;
}

export interface OnboardingChecklistItem {
  id: string;
  name: string;
  required: boolean;
  description: string;
  completed: boolean;
  jump_path: string;
  subItems?: OnboardingSubItem[];
  check_key?: string;
  actionable?: string;
}

export interface OnboardingChecklistCategory {
  id: string;
  name: string;
  items: OnboardingChecklistItem[];
}

type SubDef = {
  id?: string;
  nameKey: string;
  descKey: string;
  required: boolean;
  jump_path: string;
  check_key?: string;
};

type ItemDef = {
  id: string;
  nameKey: string;
  descKey: string;
  required: boolean;
  jump_path: string;
  check_key?: string;
  actionable?: string;
  subItems?: SubDef[];
};

type PhaseDef = {
  id: string;
  nameKey: string;
  items: ItemDef[];
};

const SYSTEM_LAUNCH_STRUCTURE: PhaseDef[] = [
  {
    id: 'infrastructure_phase',
    nameKey: 'pages.system.onboardingWizard.system.phase.infrastructure',
    items: [
      {
        id: 'factory_data',
        nameKey: 'pages.system.onboardingWizard.system.task.factoryData.name',
        descKey: 'pages.system.onboardingWizard.system.task.factoryData.desc',
        required: true,
        jump_path: '/apps/master-data/factory/work-centers',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryPlants.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryPlants.desc', required: false, jump_path: '/apps/master-data/factory/plants', check_key: 'factory_plants' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryWorkshops.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryWorkshops.desc', required: true, jump_path: '/apps/master-data/factory/workshops', check_key: 'factory_workshops' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryLines.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryLines.desc', required: true, jump_path: '/apps/master-data/factory/production-lines', check_key: 'factory_lines' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryWorkCenters.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryWorkCenters.desc', required: true, jump_path: '/apps/master-data/factory/work-centers', check_key: 'factory_work_centers' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryStations.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryStations.desc', required: true, jump_path: '/apps/master-data/factory/workstations', check_key: 'factory_stations' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.factoryWorkGroups.name', descKey: 'pages.system.onboardingWizard.system.sub.factoryWorkGroups.desc', required: true, jump_path: '/apps/master-data/factory/work-groups', check_key: 'factory_work_groups' },
        ],
      },
      {
        id: 'warehouse_data',
        nameKey: 'pages.system.onboardingWizard.system.task.warehouseData.name',
        descKey: 'pages.system.onboardingWizard.system.task.warehouseData.desc',
        required: true,
        jump_path: '/apps/master-data/warehouse/warehouses',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.warehouseMain.name', descKey: 'pages.system.onboardingWizard.system.sub.warehouseMain.desc', required: true, jump_path: '/apps/master-data/warehouse/warehouses', check_key: 'warehouse_main' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.warehouseAreas.name', descKey: 'pages.system.onboardingWizard.system.sub.warehouseAreas.desc', required: false, jump_path: '/apps/master-data/warehouse/storage-areas', check_key: 'warehouse_areas' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.warehouseLocations.name', descKey: 'pages.system.onboardingWizard.system.sub.warehouseLocations.desc', required: false, jump_path: '/apps/master-data/warehouse/storage-locations', check_key: 'warehouse_locations' },
        ],
      },
    ],
  },
  {
    id: 'modeling_phase',
    nameKey: 'pages.system.onboardingWizard.system.phase.modeling',
    items: [
      {
        id: 'material_data',
        nameKey: 'pages.system.onboardingWizard.system.task.materialData.name',
        descKey: 'pages.system.onboardingWizard.system.task.materialData.desc',
        required: true,
        jump_path: '/apps/master-data/materials',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.materialMain.name', descKey: 'pages.system.onboardingWizard.system.sub.materialMain.desc', required: true, jump_path: '/apps/master-data/materials', check_key: 'material_main' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.materialVariants.name', descKey: 'pages.system.onboardingWizard.system.sub.materialVariants.desc', required: false, jump_path: '/apps/master-data/materials/variant-attributes', check_key: 'material_variants' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.materialBatchRules.name', descKey: 'pages.system.onboardingWizard.system.sub.materialBatchRules.desc', required: false, jump_path: '/apps/master-data/materials/batch-rules', check_key: 'material_batch_rules' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.materialSerialRules.name', descKey: 'pages.system.onboardingWizard.system.sub.materialSerialRules.desc', required: false, jump_path: '/apps/master-data/materials/serial-rules', check_key: 'material_serial_rules' },
        ],
      },
      {
        id: 'partner_data',
        nameKey: 'pages.system.onboardingWizard.system.task.partnerData.name',
        descKey: 'pages.system.onboardingWizard.system.task.partnerData.desc',
        required: true,
        jump_path: '/apps/master-data/supply-chain/customers',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.partnerCustomers.name', descKey: 'pages.system.onboardingWizard.system.sub.partnerCustomers.desc', required: true, jump_path: '/apps/master-data/supply-chain/customers', check_key: 'partner_customers' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.partnerSuppliers.name', descKey: 'pages.system.onboardingWizard.system.sub.partnerSuppliers.desc', required: true, jump_path: '/apps/master-data/supply-chain/suppliers', check_key: 'partner_suppliers' },
        ],
      },
    ],
  },
  {
    id: 'process_phase',
    nameKey: 'pages.system.onboardingWizard.system.phase.process',
    items: [
      {
        id: 'bom_config',
        nameKey: 'pages.system.onboardingWizard.system.task.bomConfig.name',
        descKey: 'pages.system.onboardingWizard.system.task.bomConfig.desc',
        required: true,
        jump_path: '/apps/master-data/process/engineering-bom',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.processBom.name', descKey: 'pages.system.onboardingWizard.system.sub.processBom.desc', required: true, jump_path: '/apps/master-data/process/engineering-bom', check_key: 'process_bom' },
        ],
      },
      {
        id: 'process_routing',
        nameKey: 'pages.system.onboardingWizard.system.task.processRouting.name',
        descKey: 'pages.system.onboardingWizard.system.task.processRouting.desc',
        required: true,
        jump_path: '/apps/master-data/process/routes',
        subItems: [
          { nameKey: 'pages.system.onboardingWizard.system.sub.processOperations.name', descKey: 'pages.system.onboardingWizard.system.sub.processOperations.desc', required: true, jump_path: '/apps/master-data/process/operations', check_key: 'process_operations' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.processRoutes.name', descKey: 'pages.system.onboardingWizard.system.sub.processRoutes.desc', required: true, jump_path: '/apps/master-data/process/routes', check_key: 'process_routes' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.processDefects.name', descKey: 'pages.system.onboardingWizard.system.sub.processDefects.desc', required: false, jump_path: '/apps/master-data/process/defect-types', check_key: 'process_defects' },
          { nameKey: 'pages.system.onboardingWizard.system.sub.processSop.name', descKey: 'pages.system.onboardingWizard.system.sub.processSop.desc', required: false, jump_path: '/apps/master-data/process/sop', check_key: 'process_sop' },
        ],
      },
    ],
  },
  {
    id: 'validation_phase',
    nameKey: 'pages.system.onboardingWizard.system.phase.validation',
    items: [
      {
        id: 'first_order_run',
        nameKey: 'pages.system.onboardingWizard.system.task.firstOrderRun.name',
        descKey: 'pages.system.onboardingWizard.system.task.firstOrderRun.desc',
        required: true,
        jump_path: '/apps/kuaizhizao/sales-management/sales-orders',
      },
      {
        id: 'initial_data_verified',
        nameKey: 'pages.system.onboardingWizard.system.task.initialDataVerified.name',
        descKey: 'pages.system.onboardingWizard.system.task.initialDataVerified.desc',
        required: true,
        jump_path: '/apps/kuaizhizao/warehouse-management/initial-data',
        check_key: 'initial_data_verified',
        actionable: 'mark_initial_data_verified',
      },
    ],
  },
];

const MISSION_GUIDE_KEYS = [
  'warehouse_main',
  'warehouse_locations',
  'material_main',
  'partner_customers',
  'partner_suppliers',
  'process_operations',
  'process_routes',
  'first_order_run',
] as const;

export type MissionGuideKey = (typeof MISSION_GUIDE_KEYS)[number];

export function buildSystemLaunchChecklist(t: TFunction): OnboardingChecklistCategory[] {
  return SYSTEM_LAUNCH_STRUCTURE.map((phase) => ({
    id: phase.id,
    name: t(phase.nameKey),
    items: phase.items.map((item) => ({
      id: item.id,
      name: t(item.nameKey),
      required: item.required,
      description: t(item.descKey),
      completed: false,
      jump_path: item.jump_path,
      check_key: item.check_key,
      actionable: item.actionable,
      subItems: item.subItems?.map((sub) => ({
        id: sub.id,
        name: t(sub.nameKey),
        description: t(sub.descKey),
        required: sub.required,
        jump_path: sub.jump_path,
        check_key: sub.check_key,
      })),
    })),
  }));
}

export function buildMissionGuide(
  t: TFunction
): Record<string, { mission: string; standard: string; tip?: string; dependency?: string }> {
  const guide: Record<string, { mission: string; standard: string; tip?: string; dependency?: string }> = {};
  MISSION_GUIDE_KEYS.forEach((key) => {
    const base = `pages.system.onboardingWizard.guide.${key}`;
    const entry: { mission: string; standard: string; tip?: string; dependency?: string } = {
      mission: t(`${base}.mission`),
      standard: t(`${base}.standard`),
    };
    const tip = t(`${base}.tip`, { defaultValue: '' });
    const dependency = t(`${base}.dependency`, { defaultValue: '' });
    if (tip) entry.tip = tip;
    if (dependency) entry.dependency = dependency;
    guide[key] = entry;
  });
  return guide;
}

export const ROLE_TAB_NAME_KEYS: Record<string, string> = {
  implementer: 'pages.system.onboardingWizard.tabImplementer',
  system: 'pages.system.onboardingWizard.tabSystem',
  sales: 'pages.system.onboardingWizard.roleSales',
  purchase: 'pages.system.onboardingWizard.rolePurchase',
  warehouse: 'pages.system.onboardingWizard.roleWarehouse',
  technician: 'pages.system.onboardingWizard.roleTechnician',
  planner: 'pages.system.onboardingWizard.rolePlanner',
  supervisor: 'pages.system.onboardingWizard.roleSupervisor',
  operator: 'pages.system.onboardingWizard.roleOperator',
  quality: 'pages.system.onboardingWizard.roleQuality',
  equipment: 'pages.system.onboardingWizard.roleEquipment',
  finance: 'pages.system.onboardingWizard.roleFinance',
  manager: 'pages.system.onboardingWizard.roleManager',
};

/** item.id → realCounts key fallback (language-independent) */
export const SYSTEM_STOCK_COUNT_ID_MAP: Record<string, string> = {
  first_order_run: 'order_data',
  partner_data: 'partner_data',
  material_data: 'material_data',
  warehouse_data: 'warehouse_data',
  bom_config: 'bom_config',
  factory_data: 'work_center_config',
  process_routing: 'process_routing',
};
