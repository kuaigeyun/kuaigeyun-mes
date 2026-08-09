/**
 * 工序管理：报工类型 / 超报方式 / 不良品项 / 启用状态徽章（唯一真源）
 *
 * - 状态（启用）：StatusTag solid
 * - 类型 / 模式 / 分类标识：MarkerTag filled
 */

import React from 'react';
import { Space } from 'antd';
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';
import type { DefectTypeMinimal } from '../types/process';

export type OperationReportingType = 'quantity' | 'status';
export type OperationOverReportMode = 'none' | 'fixed' | 'percent';

const REPORTING_TYPE_MARKER_COLOR: Record<OperationReportingType, string> = {
  quantity: 'processing',
  status: 'success',
};

const OVER_REPORT_MODE_MARKER_COLOR: Record<Exclude<OperationOverReportMode, 'none'>, string> = {
  fixed: 'geekblue',
  percent: 'orange',
};

const DEFECT_TYPE_MARKER_COLOR = 'warning';
const PERSONNEL_MARKER_COLOR = 'cyan';
const OVERFLOW_MARKER_COLOR = 'default';

export function normalizeOperationReportingType(value?: string | null): OperationReportingType | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'quantity') return 'quantity';
  if (raw === 'status') return 'status';
  return null;
}

export function normalizeOperationOverReportMode(value?: string | null): OperationOverReportMode {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'fixed') return 'fixed';
  if (raw === 'percent') return 'percent';
  return 'none';
}

export function getOperationReportingTypeText(
  t: TFunction,
  reportingType?: string | null,
): string {
  const normalized = normalizeOperationReportingType(reportingType);
  if (normalized === 'quantity') return t('field.operation.reportingTypeQuantity');
  if (normalized === 'status') return t('field.operation.reportingTypeStatus');
  return '-';
}

export function renderOperationReportingTypeMarker(
  t: TFunction,
  reportingType?: string | null,
): React.ReactNode {
  const normalized = normalizeOperationReportingType(reportingType);
  if (!normalized) return '-';
  return React.createElement(
    MarkerTag,
    { color: REPORTING_TYPE_MARKER_COLOR[normalized] },
    getOperationReportingTypeText(t, normalized),
  );
}

export function getOperationOverReportModeText(
  t: TFunction,
  mode?: string | null,
): string {
  const normalized = normalizeOperationOverReportMode(mode);
  if (normalized === 'fixed') return t('field.operation.overReportModeFixed');
  if (normalized === 'percent') return t('field.operation.overReportModePercent');
  return t('field.operation.overReportModeNone');
}

export function renderOperationOverReportModeMarker(
  t: TFunction,
  mode?: string | null,
  value?: number | string | null,
): React.ReactNode {
  const normalized = normalizeOperationOverReportMode(mode);
  const baseLabel = getOperationOverReportModeText(t, normalized);
  if (normalized === 'none') {
    return React.createElement(MarkerTag, { color: 'default' }, baseLabel);
  }
  const numeric = Number(value ?? 0) || 0;
  const detail = normalized === 'fixed' ? ` +${numeric}` : ` ${numeric}%`;
  const label = numeric > 0 ? `${baseLabel}${detail}` : baseLabel;
  return React.createElement(
    MarkerTag,
    { color: OVER_REPORT_MODE_MARKER_COLOR[normalized] },
    label,
  );
}

export function renderOperationDefectTypeMarkers(
  defectTypes?: DefectTypeMinimal[] | null,
  maxVisible = 3,
): React.ReactNode {
  const arr = Array.isArray(defectTypes) ? defectTypes : [];
  if (!arr.length) return '-';
  const visible = arr.slice(0, maxVisible);
  const overflow = arr.length - visible.length;
  return React.createElement(
    Space,
    { size: 'small', wrap: true },
    ...visible.map((item) =>
      React.createElement(
        MarkerTag,
        { key: item.uuid ?? item.code ?? item.name, color: DEFECT_TYPE_MARKER_COLOR },
        item.name ?? item.code ?? '-',
      ),
    ),
    overflow > 0
      ? React.createElement(MarkerTag, { color: OVERFLOW_MARKER_COLOR }, `+${overflow}`)
      : null,
  );
}

export function renderOperationPersonnelMarkers(
  names?: string[] | null,
  maxVisible = 3,
): React.ReactNode {
  const arr = Array.isArray(names) ? names.filter(Boolean) : [];
  if (!arr.length) return '-';
  const visible = arr.slice(0, maxVisible);
  const overflow = arr.length - visible.length;
  return React.createElement(
    Space,
    { size: 'small', wrap: true },
    ...visible.map((name, index) =>
      React.createElement(
        MarkerTag,
        { key: `${name}-${index}`, color: PERSONNEL_MARKER_COLOR },
        name,
      ),
    ),
    overflow > 0
      ? React.createElement(MarkerTag, { color: OVERFLOW_MARKER_COLOR }, `+${overflow}`)
      : null,
  );
}

export function renderOperationActiveStatusTag(
  t: TFunction,
  isActive?: boolean | null,
): React.ReactNode {
  const active = Boolean(isActive);
  return React.createElement(
    StatusTag,
    { color: active ? 'success' : 'default' },
    active ? t('app.master-data.plants.enabled') : t('app.master-data.plants.disabled'),
  );
}

export function buildOperationReportingTypeValueEnum(t: TFunction) {
  return {
    quantity: {
      text: t('field.operation.reportingTypeQuantity'),
      status: 'Processing',
    },
    status: {
      text: t('field.operation.reportingTypeStatus'),
      status: 'Success',
    },
  } as const;
}
