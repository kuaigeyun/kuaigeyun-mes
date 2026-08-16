/**
 * 快研发列表展示：类型/分类/优先级 → MarkerTag；变更/Phase2 流程态 → StatusTag。
 * 业务列不堆叠（编码与名称分列）；审计叠列仍走 plmCreatedUpdatedColumns。
 */
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';
import {
  getKuaiplmChangeCategoryText,
  getKuaiplmChangeStatusText,
  getKuaiplmChangeTypeText,
} from '../components/kuaiplmMeta';

const CHANGE_STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'default',
  pending: 'processing',
  approved: 'success',
  executed: 'default',
  rejected: 'error',
  cancelled: 'default',
};

const CHANGE_CATEGORY_MARKER_COLOR: Record<string, string> = {
  bom: 'blue',
  route: 'purple',
  process_route: 'purple',
  drawing: 'cyan',
};

export function renderPlmChangeCategoryMarker(t: TFunction, category?: string | null) {
  const text = getKuaiplmChangeCategoryText(t, category);
  if (text === '-') return '-';
  const key = String(category ?? '').toLowerCase();
  return <MarkerTag color={CHANGE_CATEGORY_MARKER_COLOR[key] ?? 'processing'}>{text}</MarkerTag>;
}

export function renderPlmChangeTypeMarker(
  t: TFunction,
  changeType?: string | null,
  category?: string | null,
) {
  const text = getKuaiplmChangeTypeText(t, changeType, category);
  if (text === '-') return '-';
  return <MarkerTag color="processing">{text}</MarkerTag>;
}

/** 变更单流程态（右固定 lifecycle） */
export function renderPlmChangeStatusTag(t: TFunction, status?: string | null) {
  const text = getKuaiplmChangeStatusText(t, status);
  if (text === '-') return '-';
  const key = String(status ?? '').toLowerCase();
  return <StatusTag color={CHANGE_STATUS_TAG_COLOR[key] ?? 'default'}>{text}</StatusTag>;
}
