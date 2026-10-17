import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../utils/uniTableLayoutColumns';

/** 列表列宽：短码/徽章 KeepWidth；名称 RemainderFlex。 */
export const VISION_LIST_COL = {
  code: { width: 140, minWidth: 140, uniTableKeepWidth: true, resizable: false, ellipsis: true },
  name: {
    minWidth: 140,
    uniTableRemainderFlex: true,
    uniTablePrimaryFlex: true,
    resizable: false,
    ellipsis: true,
  },
  token: { width: 180, minWidth: 180, uniTableKeepWidth: true, resizable: false, ellipsis: true },
  marker: { ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS },
  datetime: {
    width: 176,
    minWidth: 176,
    uniTableKeepWidth: true,
    resizable: false,
    uniTableAuditStackedColumn: false,
  },
  eventId: { width: 160, minWidth: 160, uniTableKeepWidth: true, resizable: false, ellipsis: true },
  number: { width: 100, minWidth: 100, uniTableKeepWidth: true, resizable: false },
  recipe: { width: 140, minWidth: 140, uniTableKeepWidth: true, resizable: false, ellipsis: true },
  station: { width: 110, minWidth: 110, uniTableKeepWidth: true, resizable: false, ellipsis: true },
} as const;

export function renderJudgmentMarker(
  judgment: string,
  t: (key: string, opt?: { defaultValue?: string }) => string,
) {
  const key = String(judgment || '').toUpperCase();
  const color = key === 'OK' ? 'success' : key === 'NG' ? 'error' : 'warning';
  const label =
    key === 'OK'
      ? t('app.kuaivision.judgment.ok', { defaultValue: '合格' })
      : key === 'NG'
        ? t('app.kuaivision.judgment.ng', { defaultValue: '不合格' })
        : t('app.kuaivision.judgment.unknown', { defaultValue: '未知' });
  return <MarkerTag color={color}>{label}</MarkerTag>;
}

export function renderVisionEnabledMarker(t: TFunction, enabled?: boolean | null) {
  return (
    <MarkerTag color={enabled ? 'success' : 'default'}>
      {enabled ? t('common.yes') : t('common.no')}
    </MarkerTag>
  );
}
