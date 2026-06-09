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
