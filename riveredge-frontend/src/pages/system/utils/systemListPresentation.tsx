/**
 * 系统配置列表展示：启用/类型/标识 → MarkerTag；流程/登录/备份等状态 → StatusTag。
 * 系统级多为配置主数据：业务列不堆叠（与主数据 plants 一致）；审计叠列另议。
 */
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';

export function renderSystemActiveTag(
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

export function renderSystemTypeMarker(label: string, color: string = 'processing') {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <MarkerTag color={color}>{text}</MarkerTag>;
}

export function renderSystemYesNoTag(
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

/** 审批实例 / 登录结果 / 备份任务等流程态 */
export function renderSystemStatusTag(label: string, color: string = 'default') {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <StatusTag color={color}>{text}</StatusTag>;
}
