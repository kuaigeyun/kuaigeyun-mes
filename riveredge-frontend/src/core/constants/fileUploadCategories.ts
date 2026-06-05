import type { TFunction } from 'i18next';

/**
 * 业务附件 category → i18n 键（与后端 business_upload_access 白名单一致）。
 * 文件管理侧栏文件夹名唯一真源。
 */
export const FILE_UPLOAD_CATEGORY_I18N_KEYS: Record<string, string> = {
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
  'site-logo': 'pages.system.files.category.siteLogo',
  avatar: 'pages.system.files.category.avatar',
};

export function resolveFileUploadCategoryDisplayName(
  category: string | undefined,
  t: TFunction,
): string {
  const raw = (category || '').trim();
  if (!raw) return '';
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;

  const key = FILE_UPLOAD_CATEGORY_I18N_KEYS[raw];
  if (key) {
    return t(key, { defaultValue: raw });
  }
  return raw;
}
