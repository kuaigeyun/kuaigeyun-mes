import type { TFunction } from 'i18next';
import type { OnboardingChecklistCategory, OnboardingChecklistItem, OnboardingSubItem } from './systemLaunchData';

type SubDef = {
  id: string;
  nameKey: string;
  descKey: string;
  required: boolean;
  jump_path: string;
};

type RoleTaskDef = {
  id: string;
  nameKey: string;
  descKey: string;
  required: boolean;
  jump_path: string;
};

type RoleDef = {
  missionKey: string;
  prerequisiteDataKey: string;
  businessDocsKey: string;
  empowermentValueKey: string;
  tasks: RoleTaskDef[];
};

type ImpGroupDef = {
  id: string;
  nameKey: string;
  descKey: string;
  required: boolean;
  subItems: SubDef[];
};

type ImpPhaseDef = {
  id: string;
  nameKey: string;
  items: ImpGroupDef[];
};

const ROLE_CODES = [
  'sales',
  'purchase',
  'warehouse',
  'technician',
  'planner',
  'supervisor',
  'operator',
  'quality',
  'equipment',
  'finance',
  'manager',
  'implementer',
] as const;

const ROLE_LAUNCH_DEFS: Record<string, RoleDef> = {
  sales: {
    missionKey: 'pages.system.onboardingWizard.role.sales.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.sales.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.sales.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.sales.empowermentValue',
    tasks: [
      { id: 'sales_customer', nameKey: 'pages.system.onboardingWizard.role.sales.task.sales_customer.name', descKey: 'pages.system.onboardingWizard.role.sales.task.sales_customer.desc', required: true, jump_path: '/apps/master-data/supply-chain/customers' },
      { id: 'sales_price', nameKey: 'pages.system.onboardingWizard.role.sales.task.sales_price.name', descKey: 'pages.system.onboardingWizard.role.sales.task.sales_price.desc', required: false, jump_path: '/apps/kuaizhizao/sales-management/quotations' },
      { id: 'sales_order', nameKey: 'pages.system.onboardingWizard.role.sales.task.sales_order.name', descKey: 'pages.system.onboardingWizard.role.sales.task.sales_order.desc', required: true, jump_path: '/apps/kuaizhizao/sales-management/sales-orders' },
      { id: 'sales_delivery', nameKey: 'pages.system.onboardingWizard.role.sales.task.sales_delivery.name', descKey: 'pages.system.onboardingWizard.role.sales.task.sales_delivery.desc', required: true, jump_path: '/apps/kuaizhizao/sales-management/deliveries' },
    ],
  },
  purchase: {
    missionKey: 'pages.system.onboardingWizard.role.purchase.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.purchase.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.purchase.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.purchase.empowermentValue',
    tasks: [
      { id: 'pur_supplier', nameKey: 'pages.system.onboardingWizard.role.purchase.task.pur_supplier.name', descKey: 'pages.system.onboardingWizard.role.purchase.task.pur_supplier.desc', required: true, jump_path: '/apps/master-data/supply-chain/suppliers' },
      { id: 'pur_price', nameKey: 'pages.system.onboardingWizard.role.purchase.task.pur_price.name', descKey: 'pages.system.onboardingWizard.role.purchase.task.pur_price.desc', required: true, jump_path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { id: 'pur_order', nameKey: 'pages.system.onboardingWizard.role.purchase.task.pur_order.name', descKey: 'pages.system.onboardingWizard.role.purchase.task.pur_order.desc', required: true, jump_path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { id: 'pur_receipt', nameKey: 'pages.system.onboardingWizard.role.purchase.task.pur_receipt.name', descKey: 'pages.system.onboardingWizard.role.purchase.task.pur_receipt.desc', required: true, jump_path: '/apps/kuaizhizao/purchase-management/receipt-notices' },
    ],
  },
  warehouse: {
    missionKey: 'pages.system.onboardingWizard.role.warehouse.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.warehouse.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.warehouse.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.warehouse.empowermentValue',
    tasks: [
      { id: 'wh_setup', nameKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_setup.name', descKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_setup.desc', required: true, jump_path: '/apps/master-data/warehouse/warehouses' },
      { id: 'wh_stock_in', nameKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_stock_in.name', descKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_stock_in.desc', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/inbound' },
      { id: 'wh_picking', nameKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_picking.name', descKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_picking.desc', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/outbound' },
      { id: 'wh_stock_out', nameKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_stock_out.name', descKey: 'pages.system.onboardingWizard.role.warehouse.task.wh_stock_out.desc', required: true, jump_path: '/apps/kuaizhizao/warehouse-management/outbound' },
    ],
  },
  technician: {
    missionKey: 'pages.system.onboardingWizard.role.technician.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.technician.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.technician.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.technician.empowermentValue',
    tasks: [
      { id: 'tech_material', nameKey: 'pages.system.onboardingWizard.role.technician.task.tech_material.name', descKey: 'pages.system.onboardingWizard.role.technician.task.tech_material.desc', required: true, jump_path: '/apps/master-data/materials' },
      { id: 'tech_bom', nameKey: 'pages.system.onboardingWizard.role.technician.task.tech_bom.name', descKey: 'pages.system.onboardingWizard.role.technician.task.tech_bom.desc', required: true, jump_path: '/apps/master-data/process/engineering-bom' },
      { id: 'tech_route', nameKey: 'pages.system.onboardingWizard.role.technician.task.tech_route.name', descKey: 'pages.system.onboardingWizard.role.technician.task.tech_route.desc', required: true, jump_path: '/apps/master-data/process/routes' },
    ],
  },
  planner: {
    missionKey: 'pages.system.onboardingWizard.role.planner.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.planner.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.planner.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.planner.empowermentValue',
    tasks: [
      { id: 'plan_wc', nameKey: 'pages.system.onboardingWizard.role.planner.task.plan_wc.name', descKey: 'pages.system.onboardingWizard.role.planner.task.plan_wc.desc', required: true, jump_path: '/apps/master-data/factory/work-centers' },
      { id: 'plan_mrp', nameKey: 'pages.system.onboardingWizard.role.planner.task.plan_mrp.name', descKey: 'pages.system.onboardingWizard.role.planner.task.plan_mrp.desc', required: false, jump_path: '/apps/kuaizhizao/production-planning/mrp' },
      { id: 'plan_order', nameKey: 'pages.system.onboardingWizard.role.planner.task.plan_order.name', descKey: 'pages.system.onboardingWizard.role.planner.task.plan_order.desc', required: true, jump_path: '/apps/kuaizhizao/production-planning/work-orders' },
    ],
  },
  supervisor: {
    missionKey: 'pages.system.onboardingWizard.role.supervisor.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.supervisor.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.supervisor.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.supervisor.empowermentValue',
    tasks: [
      { id: 'sup_team', nameKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_team.name', descKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_team.desc', required: true, jump_path: '/apps/master-data/factory/teams' },
      { id: 'sup_dispatch', nameKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_dispatch.name', descKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_dispatch.desc', required: true, jump_path: '/apps/kuaizhizao/production-execution/dispatch' },
      { id: 'sup_monitor', nameKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_monitor.name', descKey: 'pages.system.onboardingWizard.role.supervisor.task.sup_monitor.desc', required: true, jump_path: '/apps/kuaizhizao/production-execution/dashboard' },
    ],
  },
  operator: {
    missionKey: 'pages.system.onboardingWizard.role.operator.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.operator.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.operator.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.operator.empowermentValue',
    tasks: [
      { id: 'op_receive', nameKey: 'pages.system.onboardingWizard.role.operator.task.op_receive.name', descKey: 'pages.system.onboardingWizard.role.operator.task.op_receive.desc', required: true, jump_path: '/apps/kuaizhizao/production-execution/tasks' },
      { id: 'op_report', nameKey: 'pages.system.onboardingWizard.role.operator.task.op_report.name', descKey: 'pages.system.onboardingWizard.role.operator.task.op_report.desc', required: true, jump_path: '/apps/kuaizhizao/production-execution/reporting' },
    ],
  },
  quality: {
    missionKey: 'pages.system.onboardingWizard.role.quality.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.quality.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.quality.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.quality.empowermentValue',
    tasks: [
      { id: 'qa_standard', nameKey: 'pages.system.onboardingWizard.role.quality.task.qa_standard.name', descKey: 'pages.system.onboardingWizard.role.quality.task.qa_standard.desc', required: true, jump_path: '/apps/master-data/quality/standards' },
      { id: 'qa_iqc', nameKey: 'pages.system.onboardingWizard.role.quality.task.qa_iqc.name', descKey: 'pages.system.onboardingWizard.role.quality.task.qa_iqc.desc', required: true, jump_path: '/apps/kuaizhizao/quality-control/iqc' },
      { id: 'qa_oqc', nameKey: 'pages.system.onboardingWizard.role.quality.task.qa_oqc.name', descKey: 'pages.system.onboardingWizard.role.quality.task.qa_oqc.desc', required: true, jump_path: '/apps/kuaizhizao/quality-control/oqc' },
    ],
  },
  equipment: {
    missionKey: 'pages.system.onboardingWizard.role.equipment.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.equipment.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.equipment.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.equipment.empowermentValue',
    tasks: [
      { id: 'eq_ledger', nameKey: 'pages.system.onboardingWizard.role.equipment.task.eq_ledger.name', descKey: 'pages.system.onboardingWizard.role.equipment.task.eq_ledger.desc', required: true, jump_path: '/apps/master-data/equipment/ledger' },
      { id: 'eq_maintain', nameKey: 'pages.system.onboardingWizard.role.equipment.task.eq_maintain.name', descKey: 'pages.system.onboardingWizard.role.equipment.task.eq_maintain.desc', required: true, jump_path: '/apps/kuaizhizao/equipment-maintenance/maintenance' },
    ],
  },
  finance: {
    missionKey: 'pages.system.onboardingWizard.role.finance.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.finance.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.finance.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.finance.empowermentValue',
    tasks: [
      { id: 'fi_ap', nameKey: 'pages.system.onboardingWizard.role.finance.task.fi_ap.name', descKey: 'pages.system.onboardingWizard.role.finance.task.fi_ap.desc', required: true, jump_path: '/apps/kuaizhizao/finance/ap' },
      { id: 'fi_ar', nameKey: 'pages.system.onboardingWizard.role.finance.task.fi_ar.name', descKey: 'pages.system.onboardingWizard.role.finance.task.fi_ar.desc', required: true, jump_path: '/apps/kuaizhizao/finance/ar' },
      { id: 'fi_cost', nameKey: 'pages.system.onboardingWizard.role.finance.task.fi_cost.name', descKey: 'pages.system.onboardingWizard.role.finance.task.fi_cost.desc', required: false, jump_path: '/apps/kuaizhizao/finance/costing' },
    ],
  },
  manager: {
    missionKey: 'pages.system.onboardingWizard.role.manager.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.manager.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.manager.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.manager.empowermentValue',
    tasks: [
      { id: 'mgr_approve', nameKey: 'pages.system.onboardingWizard.role.manager.task.mgr_approve.name', descKey: 'pages.system.onboardingWizard.role.manager.task.mgr_approve.desc', required: true, jump_path: '/apps/system/workflow/approvals' },
      { id: 'mgr_dashboard', nameKey: 'pages.system.onboardingWizard.role.manager.task.mgr_dashboard.name', descKey: 'pages.system.onboardingWizard.role.manager.task.mgr_dashboard.desc', required: true, jump_path: '/apps/dashboard/bi' },
    ],
  },
  implementer: {
    missionKey: 'pages.system.onboardingWizard.role.implementer.mission',
    prerequisiteDataKey: 'pages.system.onboardingWizard.role.implementer.prerequisiteData',
    businessDocsKey: 'pages.system.onboardingWizard.role.implementer.businessDocs',
    empowermentValueKey: 'pages.system.onboardingWizard.role.implementer.empowermentValue',
    tasks: [],
  },
};

const IMPLEMENTER_LAUNCH_STRUCTURE: ImpPhaseDef[] = [
  {
    id: 'imp_security_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.security',
    items: [
      {
        id: 'imp_security_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.securityGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.securityGroup.desc',
        required: true,
        subItems: [
          { id: 'imp_dept', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_dept.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_dept.desc', required: true, jump_path: '/system/departments' },
          { id: 'imp_post', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_post.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_post.desc', required: false, jump_path: '/system/positions' },
          { id: 'imp_role', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_role.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_role.desc', required: true, jump_path: '/system/roles' },
          { id: 'imp_user', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_user.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_user.desc', required: true, jump_path: '/system/users' },
        ],
      },
    ],
  },
  {
    id: 'imp_config_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.config',
    items: [
      {
        id: 'imp_standard_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.standardGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.standardGroup.desc',
        required: true,
        subItems: [
          { id: 'imp_rule', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_rule.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_rule.desc', required: true, jump_path: '/system/code-rules' },
          { id: 'imp_dict', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_dict.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_dict.desc', required: false, jump_path: '/system/data-dictionaries' },
          { id: 'imp_business', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_business.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_business.desc', required: false, jump_path: '/system/config-center' },
          { id: 'imp_lang', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_lang.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_lang.desc', required: false, jump_path: '/system/languages' },
          { id: 'imp_field', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_field.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_field.desc', required: false, jump_path: '/system/custom-fields' },
        ],
      },
      {
        id: 'imp_site_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.siteGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.siteGroup.desc',
        required: false,
        subItems: [
          { id: 'imp_menu', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_menu.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_menu.desc', required: false, jump_path: '/system/menus' },
          { id: 'imp_site', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_site.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_site.desc', required: false, jump_path: '/system/site-settings' },
        ],
      },
    ],
  },
  {
    id: 'imp_process_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.process',
    items: [
      {
        id: 'imp_workflow_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.workflowGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.workflowGroup.desc',
        required: true,
        subItems: [
          { id: 'imp_workflow', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_workflow.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_workflow.desc', required: true, jump_path: '/system/approval-processes' },
          { id: 'imp_msg', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_msg.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_msg.desc', required: false, jump_path: '/system/message-templates' },
          { id: 'imp_print', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_print.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_print.desc', required: false, jump_path: '/system/print-templates' },
        ],
      },
    ],
  },
  {
    id: 'imp_data_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.data',
    items: [
      {
        id: 'imp_integration_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.integrationGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.integrationGroup.desc',
        required: false,
        subItems: [
          { id: 'imp_file', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_file.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_file.desc', required: false, jump_path: '/system/files' },
          { id: 'imp_api', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_api.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_api.desc', required: false, jump_path: '/system/apis' },
          { id: 'imp_connector', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_connector.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_connector.desc', required: false, jump_path: '/system/application-connections' },
          { id: 'imp_dataset', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_dataset.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_dataset.desc', required: false, jump_path: '/system/datasets' },
        ],
      },
    ],
  },
  {
    id: 'imp_ops_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.ops',
    items: [
      {
        id: 'imp_ops_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.opsGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.opsGroup.desc',
        required: false,
        subItems: [
          { id: 'imp_audit', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_audit.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_audit.desc', required: false, jump_path: '/system/operation-logs' },
          { id: 'imp_login', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_login.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_login.desc', required: false, jump_path: '/system/login-logs' },
          { id: 'imp_online', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_online.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_online.desc', required: false, jump_path: '/system/online-users' },
          { id: 'imp_backup', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_backup.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_backup.desc', required: false, jump_path: '/system/data-backups' },
        ],
      },
    ],
  },
  {
    id: 'imp_app_phase',
    nameKey: 'pages.system.onboardingWizard.implementer.phase.app',
    items: [
      {
        id: 'imp_ext_group',
        nameKey: 'pages.system.onboardingWizard.implementer.task.extGroup.name',
        descKey: 'pages.system.onboardingWizard.implementer.task.extGroup.desc',
        required: false,
        subItems: [
          { id: 'imp_app_center', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_app_center.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_app_center.desc', required: false, jump_path: '/system/applications' },
          { id: 'imp_personal', nameKey: 'pages.system.onboardingWizard.implementer.sub.imp_personal.name', descKey: 'pages.system.onboardingWizard.implementer.sub.imp_personal.desc', required: false, jump_path: '/personal/profile' },
        ],
      },
    ],
  },
];

function mapTaskDef(task: RoleTaskDef, t: TFunction): OnboardingChecklistItem {
  return {
    id: task.id,
    name: t(task.nameKey),
    description: t(task.descKey),
    required: task.required,
    completed: false,
    jump_path: task.jump_path,
  };
}

function mapSubDef(sub: SubDef, t: TFunction): OnboardingSubItem {
  return {
    id: sub.id,
    name: t(sub.nameKey),
    description: t(sub.descKey),
    required: sub.required,
    jump_path: sub.jump_path,
  };
}

export function buildRoleMissionMap(t: TFunction): Record<string, string> {
  const map: Record<string, string> = {};
  ROLE_CODES.forEach((code) => {
    const def = ROLE_LAUNCH_DEFS[code];
    if (def) map[code] = t(def.missionKey);
  });
  return map;
}

export function buildRoleDetailsMap(t: TFunction): Record<string, { data: string; docs: string; value: string }> {
  const map: Record<string, { data: string; docs: string; value: string }> = {};
  ROLE_CODES.forEach((code) => {
    const def = ROLE_LAUNCH_DEFS[code];
    if (def) {
      map[code] = {
        data: t(def.prerequisiteDataKey),
        docs: t(def.businessDocsKey),
        value: t(def.empowermentValueKey),
      };
    }
  });
  return map;
}

export function buildRoleDefaultChecklists(t: TFunction): Record<string, OnboardingChecklistItem[]> {
  const map: Record<string, OnboardingChecklistItem[]> = {};
  Object.entries(ROLE_LAUNCH_DEFS).forEach(([code, def]) => {
    map[code] = def.tasks.map((task) => mapTaskDef(task, t));
  });
  return map;
}

export function buildImplementerChecklist(t: TFunction): OnboardingChecklistCategory[] {
  return IMPLEMENTER_LAUNCH_STRUCTURE.map((phase) => ({
    id: phase.id,
    name: t(phase.nameKey),
    items: phase.items.map((group) => ({
      id: group.id,
      name: t(group.nameKey),
      description: t(group.descKey),
      required: group.required,
      completed: false,
      jump_path: group.subItems[0]?.jump_path ?? '',
      subItems: group.subItems.map((sub) => mapSubDef(sub, t)),
    })),
  }));
}

/** Overlay localized name/description when API items share ids with the default checklist */
export function localizeRoleChecklistItems(
  apiItems: OnboardingChecklistItem[],
  roleCode: string,
  defaultChecklists: Record<string, OnboardingChecklistItem[]>
): OnboardingChecklistItem[] {
  const defaultById = Object.fromEntries(
    (defaultChecklists[roleCode] || []).map((item) => [item.id, item])
  );
  return apiItems.map((item) => {
    const def = defaultById[item.id];
    if (!def) return item;
    return {
      ...item,
      name: def.name,
      description: def.description,
      required: item.required ?? def.required,
    };
  });
}
