import type { TFunction } from 'i18next';

/**
 * 业务附件 category → 专用 i18n 键（如复用菜单文案）。
 * 未登记者走 pages.system.files.category.{slug}。
 */
export const FILE_UPLOAD_CATEGORY_I18N_KEYS: Record<string, string> = {
  engineering_drawing: 'app.master-data.menu.process.drawings',
  material_images: 'app.master-data.menu.materials',
  engineering_bom_attachments: 'app.master-data.menu.process.engineering-bom',
  'sop-node-attachment': 'app.master-data.menu.process.sop',
  haoligo_equipment: 'app.haoligo.menu.equipment.ledger',
  haoligo_equipment_upkeep: 'app.haoligo.menu.equipment.documents.upkeep-sheet',
  haoligo_equipment_upkeep_complete: 'app.haoligo.menu.equipment.documents.upkeep-complete',
  haoligo_equipment_spot_check: 'app.haoligo.menu.equipment.documents.spot-check',
  haoligo_equipment_route_patrol: 'app.haoligo.menu.equipment.documents.route-patrol',
  haoligo_patrol_hazard: 'app.haoligo.menu.patrol.hazards',
  haoligo_mold_trial: 'app.haoligo.menu.molds.documents.trial',
  haoligo_mold_maint: 'app.haoligo.menu.molds.documents.maintenance',
  haoligo_mold_maint_complete: 'app.haoligo.menu.molds.documents.maintenance-complete',
  haoligo_mold_outsource_maint: 'app.haoligo.menu.molds.documents.outsource-maintenance',
  haoligo_mold_outsource_maint_complete: 'app.haoligo.menu.molds.documents.outsource-complete',
};

/** 附件 category → 对应功能页菜单 path（navigation-tree 存在且启用时才展示文件夹） */
export const DOCUMENT_ATTACHMENT_MENU_PATHS: Record<string, string> = {
  engineering_drawing: '/apps/master-data/process/drawings',
  material_images: '/apps/master-data/materials',
  engineering_bom_attachments: '/apps/master-data/process/engineering-bom',
  'sop-node-attachment': '/apps/master-data/process/sop',
  sales_contract_attachments: '/apps/kuaizhizao/sales-management/sales-contracts',
  sales_order_attachments: '/apps/kuaizhizao/sales-management/sales-orders',
  quotation_attachments: '/apps/kuaizhizao/sales-management/quotations',
  sales_forecast_attachments: '/apps/kuaizhizao/sales-management/sales-forecasts',
  purchase_requisition_attachments: '/apps/kuaizhizao/purchase-management/purchase-requisitions',
  work_order_attachments: '/apps/kuaizhizao/production-execution/work-orders',
  sales_order_change_attachments: '/apps/kuaizhizao/sales-management/sales-order-changes',
  shipment_notice_attachments: '/apps/kuaizhizao/sales-management/shipment-notices',
  sales_return_attachments: '/apps/kuaizhizao/sales-management/sales-returns',
  purchase_inquiry_attachments: '/apps/kuaizhizao/purchase-management/purchase-inquiries',
  purchase_order_attachments: '/apps/kuaizhizao/purchase-management/purchase-orders',
  purchase_order_change_attachments: '/apps/kuaizhizao/purchase-management/purchase-order-changes',
  receipt_notice_attachments: '/apps/kuaizhizao/purchase-management/receipt-notices',
  purchase_return_attachments: '/apps/kuaizhizao/purchase-management/purchase-returns',
  rework_order_attachments: '/apps/kuaizhizao/production-execution/rework-orders',
  outsource_work_order_attachments: '/apps/kuaizhizao/production-execution/outsource-management',
  outsource_order_attachments: '/apps/kuaizhizao/production-execution/outsource-management',
  packing_binding_attachments: '/apps/kuaizhizao/production-execution/packing-binding',
  incoming_inspection_attachments: '/apps/kuaizhizao/quality-management/incoming-inspection',
  process_inspection_attachments: '/apps/kuaizhizao/quality-management/process-inspection',
  finished_goods_inspection_attachments: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
  oqc_inspection_attachments: '/apps/kuaizhizao/quality-management/oqc-inspection',
  nonconforming_ledger_attachments: '/apps/kuaizhizao/quality-management/nonconforming-ledger',
  quality_8d_report_attachments: '/apps/kuaizhizao/quality-management/eight-d-reports',
  inspection_plan_attachments: '/apps/kuaizhizao/quality-management/inspection-plans',
  equipment_attachments: '/apps/kuaizhizao/equipment-management/equipment',
  equipment_calibration_attachments: '/apps/kuaizhizao/equipment-management/equipment',
  mold_attachments: '/apps/kuaizhizao/equipment-management/molds',
  tool_ledger_attachments: '/apps/kuaizhizao/equipment-management/tool-ledger',
  equipment_fault_attachments: '/apps/kuaizhizao/equipment-management/equipment-faults',
  equipment_repair_attachments: '/apps/kuaizhizao/equipment-management/equipment-faults',
  maintenance_plan_attachments: '/apps/kuaizhizao/equipment-management/maintenance-plans',
  maintenance_execution_attachments: '/apps/kuaizhizao/equipment-management/maintenance-plans',
  maintenance_reminder_attachments: '/apps/kuaizhizao/equipment-management/maintenance-reminders',
  equipment_status_attachments: '/apps/kuaizhizao/equipment-management/equipment-status',
  mold_usage_attachments: '/apps/kuaizhizao/equipment-management/mold-usages',
  mold_calibration_attachments: '/apps/kuaizhizao/equipment-management/mold-calibrations',
  tool_usage_attachments: '/apps/kuaizhizao/equipment-management/tool-usages',
  tool_maintenance_attachments: '/apps/kuaizhizao/equipment-management/tool-maintenances',
  tool_calibration_attachments: '/apps/kuaizhizao/equipment-management/tool-calibrations',
  batching_order_attachments: '/apps/kuaizhizao/warehouse-management/batching-center',
  purchase_receipt_attachments: '/apps/kuaizhizao/warehouse-management/inbound',
  other_inbound_attachments: '/apps/kuaizhizao/warehouse-management/other-inbound',
  material_return_attachments: '/apps/kuaizhizao/warehouse-management/material-returns',
  customer_material_registration_attachments: '/apps/kuaizhizao/warehouse-management/customer-material-registration',
  sales_delivery_attachments: '/apps/kuaizhizao/warehouse-management/outbound',
  other_outbound_attachments: '/apps/kuaizhizao/warehouse-management/other-outbound',
  material_borrow_attachments: '/apps/kuaizhizao/warehouse-management/material-borrows',
  delivery_notice_attachments: '/apps/kuaizhizao/warehouse-management/delivery-notes',
  stocktaking_attachments: '/apps/kuaizhizao/warehouse-management/stocktaking',
  inventory_transfer_attachments: '/apps/kuaizhizao/warehouse-management/inventory-transfer',
  assembly_order_attachments: '/apps/kuaizhizao/warehouse-management/assembly-orders',
  disassembly_order_attachments: '/apps/kuaizhizao/warehouse-management/disassembly-orders',
  inventory_alert_rule_attachments: '/apps/kuaizhizao/warehouse-management/inventory-alert',
  barcode_mapping_rule_attachments: '/apps/kuaizhizao/warehouse-management/barcode-mapping-rules',
  receivable_attachments: '/apps/kuaicaiwu/finance-management/receivables',
  receipt_attachments: '/apps/kuaicaiwu/finance-management/receipts',
  payable_attachments: '/apps/kuaicaiwu/finance-management/payables',
  payment_attachments: '/apps/kuaicaiwu/finance-management/payments',
  sales_invoice_attachments: '/apps/kuaicaiwu/finance-management/sales-invoices',
  purchase_invoice_attachments: '/apps/kuaicaiwu/finance-management/purchase-invoices',
  partner_statement_attachments: '/apps/kuaicaiwu/finance-management/partner-statements',
  bank_account_attachments: '/apps/kuaicaiwu/finance-management/bank-accounts',
  haoligo_equipment: '/apps/haoligo/equipment/ledger',
  haoligo_equipment_upkeep: '/apps/haoligo/equipment/documents/upkeep-sheet',
  haoligo_equipment_upkeep_complete: '/apps/haoligo/equipment/documents/upkeep-complete',
  haoligo_equipment_spot_check: '/apps/haoligo/equipment/documents/spot-check',
  haoligo_equipment_route_patrol: '/apps/haoligo/equipment/documents/route-patrol',
  haoligo_patrol_hazard: '/apps/haoligo/patrol/hazards',
  haoligo_mold_trial: '/apps/haoligo/molds/documents/trial',
  haoligo_mold_maint: '/apps/haoligo/molds/documents/upkeep',
  haoligo_mold_maint_complete: '/apps/haoligo/molds/documents/upkeep-complete',
  haoligo_mold_outsource_maint: '/apps/haoligo/molds/documents/outsource-maintenance',
  haoligo_mold_outsource_maint_complete: '/apps/haoligo/molds/documents/outsource-complete',
};

function attachmentMenuPathsForCategory(category: string): readonly string[] {
  const path = DOCUMENT_ATTACHMENT_MENU_PATHS[category];
  return path ? [path] : [];
}

function isAttachmentCategoryMenuEnabled(
  category: string,
  enabledMenuPaths: ReadonlySet<string>,
): boolean {
  const paths = attachmentMenuPathsForCategory(category);
  return paths.length > 0 && paths.some(path => enabledMenuPaths.has(path));
}

/**
 * 文件管理「附件」下预置子文件夹（无上传文件时也展示）。
 * 顺序为产品约定；运行时若出现未登记者仍会通过 isDocumentAttachmentCategory 并入。
 */
export const DOCUMENT_ATTACHMENT_CATEGORIES: readonly string[] = [
  'engineering_drawing',
  'material_images',
  'engineering_bom_attachments',
  'sop-node-attachment',
  'sales_contract_attachments',
  'sales_order_attachments',
  'quotation_attachments',
  'sales_forecast_attachments',
  'purchase_requisition_attachments',
  'work_order_attachments',
  'sales_order_change_attachments',
  'shipment_notice_attachments',
  'sales_return_attachments',
  'purchase_inquiry_attachments',
  'purchase_order_attachments',
  'purchase_order_change_attachments',
  'receipt_notice_attachments',
  'purchase_return_attachments',
  'rework_order_attachments',
  'outsource_work_order_attachments',
  'outsource_order_attachments',
  'packing_binding_attachments',
  'incoming_inspection_attachments',
  'process_inspection_attachments',
  'finished_goods_inspection_attachments',
  'oqc_inspection_attachments',
  'nonconforming_ledger_attachments',
  'quality_8d_report_attachments',
  'inspection_plan_attachments',
  'equipment_attachments',
  'equipment_calibration_attachments',
  'mold_attachments',
  'tool_ledger_attachments',
  'equipment_fault_attachments',
  'equipment_repair_attachments',
  'maintenance_plan_attachments',
  'maintenance_execution_attachments',
  'maintenance_reminder_attachments',
  'equipment_status_attachments',
  'mold_usage_attachments',
  'mold_calibration_attachments',
  'tool_usage_attachments',
  'tool_maintenance_attachments',
  'tool_calibration_attachments',
  'batching_order_attachments',
  'purchase_receipt_attachments',
  'other_inbound_attachments',
  'material_return_attachments',
  'customer_material_registration_attachments',
  'sales_delivery_attachments',
  'other_outbound_attachments',
  'material_borrow_attachments',
  'delivery_notice_attachments',
  'stocktaking_attachments',
  'inventory_transfer_attachments',
  'assembly_order_attachments',
  'disassembly_order_attachments',
  'inventory_alert_rule_attachments',
  'barcode_mapping_rule_attachments',
  'receivable_attachments',
  'receipt_attachments',
  'payable_attachments',
  'payment_attachments',
  'sales_invoice_attachments',
  'purchase_invoice_attachments',
  'partner_statement_attachments',
  'bank_account_attachments',
  ...Object.keys(FILE_UPLOAD_CATEGORY_I18N_KEYS),
];

/**
 * 收集侧栏「附件」子目录：仅展示已有文件的 attachment category。
 * @param enabledMenuPaths undefined = 导航树未就绪，展示全部已有 attachment；Set = 再按已启用菜单过滤
 */
export function collectDocumentAttachmentCategories(
  existing: Iterable<string>,
  enabledMenuPaths?: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const filterByMenu = enabledMenuPaths !== undefined;

  for (const category of existing) {
    const raw = category.trim();
    if (!raw || seen.has(raw) || !isDocumentAttachmentCategory(raw)) continue;
    if (filterByMenu && !isAttachmentCategoryMenuEnabled(raw, enabledMenuPaths!)) continue;
    seen.add(raw);
    result.push(raw);
  }
  return result;
}

export function fileCategoryI18nKey(category: string): string {
  return FILE_UPLOAD_CATEGORY_I18N_KEYS[category] ?? `pages.system.files.category.${category}`;
}

/** 文件管理侧栏：业务附件虚拟分组节点 key（非 DB category） */
export const FILE_ATTACHMENTS_GROUP_KEY = '@attachments';

/** 文件管理侧栏：系统 / 用户文件夹虚拟分组 */
export const FILE_SYSTEM_FOLDERS_GROUP_KEY = '@system-folders';
export const FILE_USER_FOLDERS_GROUP_KEY = '@user-folders';
export const FILE_UNCATEGORIZED_GROUP_KEY = '@uncategorized';

/** 侧栏虚拟节点（非 DB category） */
export function isVirtualFileTreeKey(key: string | undefined): boolean {
  return (key || '').startsWith('@');
}

/** 用户自建文件夹：当前约定为中文 category 名 */
export function isUserFolderCategory(category: string | undefined): boolean {
  const raw = (category || '').trim();
  if (!raw || isVirtualFileTreeKey(raw)) return false;
  return /[\u4e00-\u9fff]/.test(raw);
}

/** 系统文件夹（含附件子目录、Logo/头像等业务 category） */
export function isSystemFolderCategory(category: string | undefined): boolean {
  const raw = (category || '').trim();
  if (!raw || isVirtualFileTreeKey(raw)) return false;
  return !isUserFolderCategory(raw);
}

/**
 * 是否为单据/业务附件 category（归入侧栏「附件」分组下的子文件夹）。
 * 用户自建中文文件夹、平台 Logo/头像等系统目录返回 false。
 */
export function isDocumentAttachmentCategory(category: string | undefined): boolean {
  const raw = (category || '').trim();
  if (!raw) return false;
  if (/[\u4e00-\u9fff]/.test(raw)) return false;
  if (raw in DOCUMENT_ATTACHMENT_MENU_PATHS) return true;
  if (raw.endsWith('_attachments')) return true;
  if (raw.startsWith('haoligo_')) return true;
  return raw in FILE_UPLOAD_CATEGORY_I18N_KEYS;
}

/** 文件管理侧栏 / 面包屑：category slug → 展示名（i18n 真源） */
export function resolveFileUploadCategoryDisplayName(
  category: string | undefined,
  t: TFunction,
): string {
  const raw = (category || '').trim();
  if (!raw) return '';
  // 用户自建文件夹（中文名）原样展示
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;

  const key = fileCategoryI18nKey(raw);
  const translated = t(key);
  if (translated !== key) return translated;

  return raw;
}
