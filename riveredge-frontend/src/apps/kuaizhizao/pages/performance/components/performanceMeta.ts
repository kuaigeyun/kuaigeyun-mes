import React from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';

export const PERFORMANCE_CALC_MODE_I18N: Record<string, string> = {
  time: 'app.kuaizhizao.performance.common.calcMode.time',
  piece: 'app.kuaizhizao.performance.common.calcMode.piece',
  mixed: 'app.kuaizhizao.performance.common.calcMode.mixed',
};

export const PERFORMANCE_PIECE_RATE_MODE_I18N: Record<string, string> = {
  operation: 'app.kuaizhizao.performance.common.pieceRateMode.operation',
  default: 'app.kuaizhizao.performance.common.pieceRateMode.default',
};

export const PERFORMANCE_KPI_CALC_TYPE_I18N: Record<string, string> = {
  quality: 'app.kuaizhizao.performance.common.kpiCalcType.quality',
  efficiency: 'app.kuaizhizao.performance.common.kpiCalcType.efficiency',
  attendance: 'app.kuaizhizao.performance.common.kpiCalcType.attendance',
  output: 'app.kuaizhizao.performance.common.kpiCalcType.output',
  formula: 'app.kuaizhizao.performance.common.kpiCalcType.formula',
};

export const PERFORMANCE_SUMMARY_STATUS_I18N: Record<string, string> = {
  pending: 'app.kuaizhizao.performance.common.summaryStatus.pending',
  calculated: 'app.kuaizhizao.performance.common.summaryStatus.calculated',
  confirmed: 'app.kuaizhizao.performance.common.summaryStatus.confirmed',
  draft: 'app.kuaizhizao.performance.common.summaryStatus.draft',
};

export const PERFORMANCE_ROSTER_STATUS_I18N: Record<string, string> = {
  published: 'app.kuaizhizao.performance.common.rosterStatus.published',
  draft: 'app.kuaizhizao.performance.common.rosterStatus.draft',
};

export function getPerformanceActiveValueEnum(t: TFunction) {
  return {
    true: { text: t('common.enabled') },
    false: { text: t('common.disabled') },
  };
}

export function getPerformanceInactiveActiveValueEnum(t: TFunction) {
  return {
    true: { text: t('common.enabled') },
    false: { text: t('app.kuaizhizao.performance.common.active.inactive') },
  };
}

export function getPerformanceYesNoValueEnum(t: TFunction) {
  return {
    true: { text: t('common.yes') },
    false: { text: t('common.no') },
  };
}

export function getPerformanceSummaryStatusValueEnum(t: TFunction) {
  return Object.fromEntries(
    Object.entries(PERFORMANCE_SUMMARY_STATUS_I18N).map(([k, v]) => [k, { text: t(v) }]),
  );
}

export function getCalcModeOptions(t: TFunction) {
  return (['time', 'piece', 'mixed'] as const).map((value) => ({
    value,
    label: t(PERFORMANCE_CALC_MODE_I18N[value]),
  }));
}

export function getPieceRateModeOptions(t: TFunction) {
  return (['operation', 'default'] as const).map((value) => ({
    value,
    label: t(PERFORMANCE_PIECE_RATE_MODE_I18N[value]),
  }));
}

export function getKpiCalcTypeOptions(t: TFunction) {
  return (['quality', 'efficiency', 'attendance', 'output', 'formula'] as const).map((value) => ({
    value,
    label: t(PERFORMANCE_KPI_CALC_TYPE_I18N[value]),
  }));
}

export function getCalcModeText(t: TFunction, mode?: string | null): string {
  if (!mode) return '-';
  const key = PERFORMANCE_CALC_MODE_I18N[mode];
  return key ? t(key) : mode;
}

export function getPieceRateModeText(t: TFunction, mode?: string | null): string {
  if (!mode) return '-';
  const key = PERFORMANCE_PIECE_RATE_MODE_I18N[mode];
  return key ? t(key) : mode;
}

export function getKpiCalcTypeText(t: TFunction, type?: string | null): string {
  if (!type) return '-';
  const key = PERFORMANCE_KPI_CALC_TYPE_I18N[type];
  return key ? t(key) : type;
}

export function renderActiveTag(t: TFunction, active?: boolean, variant: 'enabled' | 'inactive' = 'enabled'): React.ReactNode {
  const text = active
    ? t('common.enabled')
    : t(
        variant === 'inactive'
          ? 'app.kuaizhizao.performance.common.active.inactive'
          : 'common.disabled',
      );
  return React.createElement(MarkerTag, { color: active ? 'success' : 'default' }, text);
}

export function renderYesNoTag(t: TFunction, value?: boolean): React.ReactNode {
  const text = value
    ? t('common.yes')
    : t('common.no');
  return React.createElement(MarkerTag, { color: value ? 'processing' : 'default' }, text);
}

const SUMMARY_STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  pending: 'warning',
  calculated: 'processing',
  confirmed: 'success',
};

/** 绩效汇总流程状态（solid） */
export function renderSummaryStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const code = String(status ?? '').trim();
  if (!code) return '-';
  const label = PERFORMANCE_SUMMARY_STATUS_I18N[code]
    ? t(PERFORMANCE_SUMMARY_STATUS_I18N[code])
    : code;
  return React.createElement(StatusTag, { color: SUMMARY_STATUS_COLOR[code] || 'default' }, label);
}

export function renderPerformanceTypeMarker(text?: string | null, color = 'processing'): React.ReactNode {
  const value = String(text ?? '').trim();
  if (!value || value === '-') return '-';
  return React.createElement(MarkerTag, { color }, value);
}

export function buildPerformanceSalaryReportColumns(t: TFunction): ProColumns[] {
  const statusEnum = getPerformanceSummaryStatusValueEnum(t);
  return [
    { title: t('app.kuaizhizao.performance.common.columns.employee'), dataIndex: 'employee_name', width: 120, hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.period'), dataIndex: 'period', width: 100, hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.totalHours'), dataIndex: 'total_hours', valueType: 'digit', width: 90, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.totalPieces'), dataIndex: 'total_pieces', valueType: 'digit', width: 90, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.timeAmount'), dataIndex: 'time_amount', valueType: 'money', width: 110, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.pieceAmount'), dataIndex: 'piece_amount', valueType: 'money', width: 110, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.kpiCoefficient'), dataIndex: 'kpi_coefficient', width: 90, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.totalAmount'), dataIndex: 'total_amount', valueType: 'money', width: 120, align: 'right', hideInSearch: true },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      valueEnum: statusEnum,
      render: (_, row) => {
        const key = String(row?.status ?? '');
        return statusEnum[key]?.text ?? (key || '-');
      },
    },
  ];
}

export function buildPerformanceEfficiencyReportColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.performance.reports.columns.workerName'), dataIndex: 'worker_name', width: 140, hideInSearch: true },
    {
      title: t('app.kuaizhizao.performance.reports.columns.totalQty'),
      dataIndex: 'total_pieces',
      valueType: 'digit',
      width: 120,
      align: 'right',
      hideInSearch: true,
      render: (_, row) => {
        const v = row?.total_pieces ?? row?.total_qty ?? row?.qualified_quantity;
        return v == null || v === '' ? '-' : v;
      },
    },
    { title: t('app.kuaizhizao.performance.reports.columns.totalHours'), dataIndex: 'total_hours', valueType: 'digit', width: 100, align: 'right', hideInSearch: true },
    { title: t('app.kuaizhizao.performance.reports.columns.piecesPerHour'), dataIndex: 'pieces_per_hour', valueType: 'digit', width: 120, align: 'right', hideInSearch: true },
  ];
}
