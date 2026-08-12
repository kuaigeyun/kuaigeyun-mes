/**
 * 主数据列表展示：启用/是否/类型用 MarkerTag filled（无流程 lifecycle）。
 * 业务列不堆叠；审计叠列仍走 masterCrudCreatedUpdatedColumns。
 */
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';

export function renderMasterActiveTag(
  t: TFunction,
  isActive?: boolean | null,
  enabledKey = 'common.enabled',
  disabledKey = 'common.disabled',
) {
  return (
    <MarkerTag color={isActive ? 'success' : 'default'}>
      {isActive ? t(enabledKey) : t(disabledKey)}
    </MarkerTag>
  );
}

export function renderMasterYesNoTag(
  t: TFunction,
  value?: boolean | null,
  yesKey = 'common.yes',
  noKey = 'common.no',
) {
  return (
    <MarkerTag color={value ? 'processing' : 'default'}>
      {value ? t(yesKey) : t(noKey)}
    </MarkerTag>
  );
}

export function renderMasterTypeMarker(
  label: string,
  color: string = 'processing',
) {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <MarkerTag color={color}>{text}</MarkerTag>;
}
