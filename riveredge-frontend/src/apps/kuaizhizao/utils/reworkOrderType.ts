import type { TFunction } from 'i18next';

const REWORK_TYPE_I18N_KEYS: Record<string, string> = {
  返工: 'app.kuaizhizao.reworkOrder.typeRework',
  返修: 'app.kuaizhizao.reworkOrder.typeRepair',
  报废: 'app.kuaizhizao.reworkOrder.typeScrap',
  /** 历史错误码（成品检验下推曾写入），展示同「返工」 */
  internal: 'app.kuaizhizao.reworkOrder.typeRework',
  rework: 'app.kuaizhizao.reworkOrder.typeRework',
  repair: 'app.kuaizhizao.reworkOrder.typeRepair',
  scrap: 'app.kuaizhizao.reworkOrder.typeScrap',
};

const REWORK_TYPE_TAG_COLORS: Record<string, string> = {
  返工: 'blue',
  返修: 'orange',
  报废: 'red',
  internal: 'blue',
  rework: 'blue',
  repair: 'orange',
  scrap: 'red',
};

export function resolveReworkTypeDisplay(
  t: TFunction,
  reworkType?: string | null,
): { label: string; color: string } {
  const raw = String(reworkType ?? '').trim();
  if (!raw) {
    return { label: '-', color: 'default' };
  }
  const i18nKey = REWORK_TYPE_I18N_KEYS[raw];
  if (i18nKey) {
    return { label: t(i18nKey), color: REWORK_TYPE_TAG_COLORS[raw] ?? 'default' };
  }
  return { label: raw, color: 'default' };
}
