import type { TFunction } from 'i18next';
import { EIGHT_D_STAGE_FIELDS } from './eightDMeta';

/** 各阶段提纲模板 i18n key：app.kuaizhizao.eightD.outline.{stageKey} */
export function getEightDStageOutlineHtml(t: TFunction, stageKey: string): string {
  if (!EIGHT_D_STAGE_FIELDS[stageKey]) return '';
  const html = t(`app.kuaizhizao.eightD.outline.${stageKey}`, { defaultValue: '' }).trim();
  return html;
}

export function hasEightDStageOutline(t: TFunction, stageKey: string): boolean {
  return Boolean(getEightDStageOutlineHtml(t, stageKey));
}
