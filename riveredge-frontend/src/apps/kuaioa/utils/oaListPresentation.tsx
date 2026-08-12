/**
 * 轻办公列表展示：启用/是否/类型/台账态 → MarkerTag；审批流程态 → StatusTag。
 * 业务列不堆叠（编码与名称分列）；列表壳见 KuaioaCrudListPage。
 */
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';

const PRO_STATUS_TO_TAG: Record<string, string> = {
  Default: 'default',
  Processing: 'processing',
  Success: 'success',
  Error: 'error',
  Warning: 'warning',
};

export function resolveOaEnumTagColor(
  statusEnum: Record<string, { text: string; status?: string }> | undefined,
  value?: string | null,
): string {
  const key = String(value ?? '').trim();
  if (!key) return 'default';
  const pro = statusEnum?.[key]?.status;
  if (pro && PRO_STATUS_TO_TAG[pro]) return PRO_STATUS_TO_TAG[pro];
  return 'default';
}

export function resolveOaEnumLabel(
  statusEnum: Record<string, { text: string; status?: string }> | undefined,
  value?: string | null,
): string {
  const key = String(value ?? '').trim();
  if (!key) return '-';
  return statusEnum?.[key]?.text || key;
}

export function renderOaActiveTag(t: TFunction, isActive?: boolean | null) {
  return (
    <MarkerTag color={isActive ? 'success' : 'default'}>
      {isActive ? t('app.kuaioa.common.yes') : t('app.kuaioa.common.no')}
    </MarkerTag>
  );
}

export function renderOaYesNoTag(t: TFunction, value?: boolean | null) {
  return (
    <MarkerTag color={value ? 'processing' : 'default'}>
      {value ? t('app.kuaioa.common.yes') : t('app.kuaioa.common.no')}
    </MarkerTag>
  );
}

export function renderOaTypeMarker(label: string, color: string = 'processing') {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <MarkerTag color={color}>{text}</MarkerTag>;
}

/** 台账/培训/证照等非审批状态 */
export function renderOaStatusMarker(
  statusEnum: Record<string, { text: string; status?: string }> | undefined,
  value?: string | null,
) {
  const text = resolveOaEnumLabel(statusEnum, value);
  if (text === '-') return '-';
  return <MarkerTag color={resolveOaEnumTagColor(statusEnum, value)}>{text}</MarkerTag>;
}

/** 通用申请 / 资产采买等审批流程态（右固定 lifecycle） */
export function renderOaApprovalStatusTag(
  statusEnum: Record<string, { text: string; status?: string }> | undefined,
  value?: string | null,
) {
  const text = resolveOaEnumLabel(statusEnum, value);
  if (text === '-') return '-';
  return <StatusTag color={resolveOaEnumTagColor(statusEnum, value)}>{text}</StatusTag>;
}
