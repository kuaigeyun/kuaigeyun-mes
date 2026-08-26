import React from 'react';
import { Tag } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { MaterialUnitLabel } from '../../../../../components/material-unit-label';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { resolveDocumentStatusTagColor } from '../../../../../constants/documentStatusColors';
import { reportPercent, reportTextEnum } from '../../../utils/reportPresentation';

export const QUALITY_DISPOSAL_I18N: Record<string, string> = {
  return: 'app.kuaizhizao.quality.common.disposal.return',
  accept: 'app.kuaizhizao.quality.common.disposal.accept',
  quarantine: 'app.kuaizhizao.quality.common.disposal.quarantine',
  rework: 'app.kuaizhizao.quality.common.disposal.rework',
  scrap: 'app.kuaizhizao.quality.common.disposal.scrap',
  downgrade: 'app.kuaizhizao.quality.common.disposal.downgrade',
  other: 'app.kuaizhizao.quality.common.disposal.other',
};

export const QUALITY_INSPECTION_STATUS_I18N: Record<string, string> = {
  pending: 'app.kuaizhizao.quality.common.status.pending',
  draft: 'app.kuaizhizao.quality.common.status.draft',
  inspected: 'app.kuaizhizao.quality.common.status.inspected',
  reviewed: 'app.kuaizhizao.quality.common.status.reviewed',
  rejected: 'app.kuaizhizao.quality.common.status.rejected',
  cancelled: 'app.kuaizhizao.quality.common.status.cancelled',
};

export const QUALITY_RESULT_I18N: Record<string, string> = {
  qualified: 'app.kuaizhizao.quality.common.result.qualified',
  unqualified: 'app.kuaizhizao.quality.common.result.unqualified',
  pending: 'app.kuaizhizao.quality.common.result.pending',
  partial: 'app.kuaizhizao.quality.common.result.partial',
  inspected: 'app.kuaizhizao.quality.common.status.inspected',
  待检验: 'app.kuaizhizao.quality.common.result.pending',
  合格: 'app.kuaizhizao.quality.common.result.qualified',
  不合格: 'app.kuaizhizao.quality.common.result.unqualified',
  部分合格: 'app.kuaizhizao.quality.common.result.partial',
  已检验: 'app.kuaizhizao.quality.common.status.inspected',
};

export const QUALITY_DOC_STATUS_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.quality.common.docStatus.draft',
  已审核: 'app.kuaizhizao.quality.common.docStatus.reviewed',
  已完成: 'app.kuaizhizao.quality.common.docStatus.completed',
  已取消: 'app.kuaizhizao.quality.common.docStatus.cancelled',
  待检验: 'app.kuaizhizao.quality.common.docStatus.pendingInspection',
  已检验: 'app.kuaizhizao.quality.common.status.inspected',
  已驳回: 'app.kuaizhizao.quality.common.reviewStatus.rejected',
};

export const QUALITY_REVIEW_STATUS_I18N: Record<string, string> = {
  待审核: 'app.kuaizhizao.quality.common.reviewStatus.pendingReview',
  已检验: 'app.kuaizhizao.quality.common.reviewStatus.inspected',
  已审核: 'app.kuaizhizao.quality.common.reviewStatus.reviewed',
  已驳回: 'app.kuaizhizao.quality.common.reviewStatus.rejected',
};

export const QUALITY_QUALITY_STATUS_I18N: Record<string, string> = {
  合格: 'app.kuaizhizao.quality.common.qualityStatus.qualified',
  不合格: 'app.kuaizhizao.quality.common.qualityStatus.unqualified',
};

export const QUALITY_TYPE_I18N: Record<string, string> = {
  incoming: 'app.kuaizhizao.quality.common.type.incoming',
  process: 'app.kuaizhizao.quality.common.type.process',
  finished: 'app.kuaizhizao.quality.common.type.finished',
  outbound: 'app.kuaizhizao.quality.common.type.outbound',
};

export const QUALITY_PLAN_TYPE_I18N: Record<string, string> = {
  incoming: 'app.kuaizhizao.quality.common.type.incoming',
  process: 'app.kuaizhizao.quality.common.type.process',
  finished: 'app.kuaizhizao.quality.common.type.finished',
  outbound: 'app.kuaizhizao.quality.common.type.outbound',
};

export const QUALITY_DEFECT_TYPE_I18N: Record<string, string> = {
  dimension: 'app.kuaizhizao.quality.common.defectType.dimension',
  appearance: 'app.kuaizhizao.quality.common.defectType.appearance',
  function: 'app.kuaizhizao.quality.common.defectType.function',
  material: 'app.kuaizhizao.quality.common.defectType.material',
  other: 'app.kuaizhizao.quality.common.defectType.other',
};

export const QUALITY_RELEASE_DECISION_I18N: Record<string, string> = {
  pending: 'app.kuaizhizao.quality.oqc.releaseDecision.pending',
  released: 'app.kuaizhizao.quality.oqc.releaseDecision.released',
  rejected: 'app.kuaizhizao.quality.oqc.releaseDecision.rejected',
};

export const QUALITY_NC_LEDGER_STATUS_I18N: Record<string, string> = {
  draft: 'app.kuaizhizao.quality.common.status.draft',
  processed: 'app.kuaizhizao.quality.nc.status.processed',
  cancelled: 'app.kuaizhizao.quality.common.status.cancelled',
};

/** 检验结果徽章色（结果/结论标识，filled；与审核状态 solid 区分） */
const RESULT_COLORS: Record<string, string> = {
  待检验: 'warning',
  pending: 'warning',
  已检验: 'processing',
  inspected: 'processing',
  合格: 'success',
  qualified: 'success',
  不合格: 'error',
  unqualified: 'error',
  部分合格: 'warning',
  partial: 'warning',
};

function resolveQualityResultColor(result?: string | null): string {
  const raw = String(result ?? '').trim();
  if (!raw) return RESULT_COLORS.pending;
  return RESULT_COLORS[raw] ?? 'default';
}

export function getQualityDisposalFallbackOptions(t: TFunction, keys: string[]) {
  return keys.map((value) => ({
    value,
    label: t(QUALITY_DISPOSAL_I18N[value] ?? value),
  }));
}

export function getQualityIncomingDisposalFallback(t: TFunction) {
  return getQualityDisposalFallbackOptions(t, ['return', 'accept', 'quarantine', 'downgrade', 'other']);
}

export function getQualityFinishedDisposalFallback(t: TFunction) {
  return getQualityDisposalFallbackOptions(t, ['rework', 'scrap', 'accept', 'quarantine', 'downgrade', 'other']);
}

/** 字典项与 fallback canonical 选项合并，保证新处置方式在旧字典下仍可选 */
export function mergeQualityDisposalOptions(
  dictOptions: Array<{ label: string; value: string }>,
  fallbackOptions: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const merged: Array<{ label: string; value: string }> = [];
  for (const opt of dictOptions) {
    if (!seen.has(opt.value)) {
      seen.add(opt.value);
      merged.push(opt);
    }
  }
  for (const opt of fallbackOptions) {
    if (!seen.has(opt.value)) {
      seen.add(opt.value);
      merged.push(opt);
    }
  }
  return merged;
}

export function getQualityPlanTypeFallback(t: TFunction) {
  return (['incoming', 'process', 'finished', 'outbound'] as const).map((value) => ({
    value,
    label: t(QUALITY_PLAN_TYPE_I18N[value]),
  }));
}

export function getQualityDefectTypeOptions(t: TFunction) {
  return (['dimension', 'appearance', 'function', 'material', 'other'] as const).map((value) => ({
    value,
    label: t(QUALITY_DEFECT_TYPE_I18N[value]),
  }));
}

export function getQualityDispositionValueEnum(t: TFunction): Record<string, string> {
  return Object.fromEntries(
    Object.entries(QUALITY_DISPOSAL_I18N).map(([value, key]) => [value, t(key)]),
  );
}

export function getQualityDefectTypeText(
  t: TFunction,
  defectType?: string | null,
  defectReason?: string | null,
): string {
  if (!defectType) return '-';
  const key = QUALITY_DEFECT_TYPE_I18N[defectType];
  if (key) return t(key);
  const reason = String(defectReason ?? '').trim();
  if (reason && reason !== defectType) return reason;
  return defectType;
}

export function getQualityDispositionText(t: TFunction, disposition?: string | null): string {
  if (!disposition) return '-';
  const key = QUALITY_DISPOSAL_I18N[disposition];
  return key ? t(key) : disposition;
}

const QUALITY_DISPOSITION_MARKER_COLORS: Record<string, string> = {
  return: 'orange',
  accept: 'success',
  quarantine: 'warning',
  rework: 'processing',
  scrap: 'error',
  downgrade: 'purple',
  other: 'default',
};

/** 检验四单据「类型」列 MarkerTag 颜色（分类标识，filled） */
export const QUALITY_INSPECTION_KIND_MARKER_COLORS = {
  simple: 'cyan',
  plan: 'processing',
} as const;

export function resolveQualityInspectionKindMarkerColor(isPlan: boolean): string {
  return isPlan
    ? QUALITY_INSPECTION_KIND_MARKER_COLORS.plan
    : QUALITY_INSPECTION_KIND_MARKER_COLORS.simple;
}

export function renderQualityDispositionMarkerTag(
  t: TFunction,
  disposition?: string | null,
): React.ReactNode {
  if (!disposition) return '-';
  const text = getQualityDispositionText(t, disposition);
  const color = QUALITY_DISPOSITION_MARKER_COLORS[disposition] ?? 'default';
  return React.createElement(MarkerTag, { color }, text);
}

export function getQualityReleaseDecisionValueEnum(t: TFunction): Record<string, string> {
  return Object.fromEntries(
    Object.entries(QUALITY_RELEASE_DECISION_I18N).map(([value, key]) => [value, t(key)]),
  );
}

export function getQualityInspectionResultValueEnum(t: TFunction): Record<string, string> {
  return {
    合格: t('app.kuaizhizao.quality.common.result.qualified'),
    不合格: t('app.kuaizhizao.quality.common.result.unqualified'),
    部分合格: t('app.kuaizhizao.quality.common.result.partial'),
  };
}

export function getQualityQualityStatusValueEnum(t: TFunction): Record<string, string> {
  return {
    合格: t('app.kuaizhizao.quality.common.qualityStatus.qualified'),
    不合格: t('app.kuaizhizao.quality.common.qualityStatus.unqualified'),
  };
}

export function getQualityNcLedgerStatusValueEnum(t: TFunction): Record<string, string> {
  return Object.fromEntries(
    Object.entries(QUALITY_NC_LEDGER_STATUS_I18N).map(([value, key]) => [value, t(key)]),
  );
}

export function getQualityReleaseDecisionText(t: TFunction, decision?: string | null): string {
  if (!decision) return t('app.kuaizhizao.quality.oqc.releaseDecision.pending');
  const key = QUALITY_RELEASE_DECISION_I18N[decision];
  return key ? t(key) : decision;
}

export function getQualityNcLedgerStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = QUALITY_NC_LEDGER_STATUS_I18N[status];
  return key ? t(key) : status;
}

export function getQualityInspectionStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = QUALITY_INSPECTION_STATUS_I18N[status];
  return key ? t(key) : status;
}

export function getQualityResultText(t: TFunction, result?: string | null): string {
  if (!result) return t('app.kuaizhizao.quality.common.result.pending');
  const key = QUALITY_RESULT_I18N[result];
  return key ? t(key) : result;
}

export function getQualityDocStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = QUALITY_DOC_STATUS_I18N[status];
  return key ? t(key) : status;
}

export function getQualityTypeText(t: TFunction, type?: string | null): string {
  if (!type) return '-';
  const key = QUALITY_TYPE_I18N[type];
  return key ? t(key) : type;
}

export function renderQualityResultTag(t: TFunction, result?: string | null): React.ReactNode {
  const text = getQualityResultText(t, result);
  const color = resolveQualityResultColor(result);
  return React.createElement(MarkerTag, { color }, text);
}

export function renderQualityDocStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getQualityDocStatusText(t, status);
  const color = resolveDocumentStatusTagColor(status);
  return React.createElement(StatusTag, { color }, text);
}

export function getQualityQualityStatusText(t: TFunction, status?: string | null): string {
  if (!status) return t('app.kuaizhizao.quality.common.qualityStatus.pending');
  const key = QUALITY_QUALITY_STATUS_I18N[status];
  return key ? t(key) : status;
}

export function renderQualityQualityStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getQualityQualityStatusText(t, status);
  if (!status) {
    return React.createElement(Tag, { variant: 'solid' }, text);
  }
  const color = status === '合格' ? 'success' : 'error';
  return React.createElement(Tag, { color, variant: 'solid' }, text);
}

const RELEASE_DECISION_COLORS: Record<string, string> = {
  released: 'success',
  rejected: 'error',
  pending: 'default',
};

export function renderReleaseDecisionTag(t: TFunction, decision?: string | null): React.ReactNode {
  const text = getQualityReleaseDecisionText(t, decision);
  const color = RELEASE_DECISION_COLORS[String(decision ?? 'pending')] ?? 'default';
  return React.createElement(Tag, { color, variant: 'solid' }, text);
}

export function renderNcLedgerStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getQualityNcLedgerStatusText(t, status);
  const color = resolveDocumentStatusTagColor(status === 'processed' ? '已完成' : status);
  return React.createElement(StatusTag, { color }, text);
}

/** 首件检验 FAI 流程状态（solid StatusTag） */
const FAI_STATUS_I18N: Record<string, string> = {
  draft: 'app.kuaizhizao.quality.fai.status.draft',
  in_progress: 'app.kuaizhizao.quality.fai.status.inProgress',
  submitted: 'app.kuaizhizao.quality.fai.status.submitted',
  approved: 'app.kuaizhizao.quality.fai.status.approved',
  rejected: 'app.kuaizhizao.quality.fai.status.rejected',
  closed: 'app.kuaizhizao.quality.fai.status.closed',
};

const FAI_CONCLUSION_I18N: Record<string, string> = {
  pending: 'app.kuaizhizao.quality.fai.conclusion.pending',
  pass: 'app.kuaizhizao.quality.fai.conclusion.pass',
  fail: 'app.kuaizhizao.quality.fai.conclusion.fail',
};

const FAI_CONCLUSION_COLORS: Record<string, string> = {
  pending: 'warning',
  pass: 'success',
  fail: 'error',
};

export function getFaiStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = FAI_STATUS_I18N[status];
  return key ? t(key) : status;
}

export function getFaiConclusionText(t: TFunction, conclusion?: string | null): string {
  if (!conclusion) return '-';
  const key = FAI_CONCLUSION_I18N[conclusion];
  return key ? t(key) : conclusion;
}

export function renderFaiStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getFaiStatusText(t, status);
  if (text === '-') return '-';
  return React.createElement(StatusTag, { color: resolveDocumentStatusTagColor(status) }, text);
}

/** 结论为结果标识，用 MarkerTag filled，不抢流程状态焦点 */
export function renderFaiConclusionTag(t: TFunction, conclusion?: string | null): React.ReactNode {
  if (!conclusion) return '-';
  const text = getFaiConclusionText(t, conclusion);
  const color = FAI_CONCLUSION_COLORS[String(conclusion)] ?? 'default';
  return React.createElement(MarkerTag, { color }, text);
}

const QUALITY_EXCEPTION_TYPE_I18N: Record<string, string> = {
  inspection_failure: 'app.kuaizhizao.productionException.quality.exceptionType.inspectionFailure',
  process_deviation: 'app.kuaizhizao.productionException.quality.exceptionType.processDeviation',
  customer_complaint: 'app.kuaizhizao.productionException.quality.exceptionType.customerComplaint',
};

const QUALITY_EXCEPTION_STATUS_I18N: Record<string, string> = {
  pending: 'app.kuaizhizao.productionException.status.pending',
  investigating: 'app.kuaizhizao.productionException.status.investigating',
  correcting: 'app.kuaizhizao.productionException.status.correcting',
  closed: 'app.kuaizhizao.productionException.status.closed',
};

const QUALITY_EXCEPTION_SEVERITY_I18N: Record<string, string> = {
  minor: 'app.kuaizhizao.productionException.quality.severity.minor',
  major: 'app.kuaizhizao.productionException.quality.severity.major',
  critical: 'app.kuaizhizao.productionException.quality.severity.critical',
};

function reportI18nEnum(t: TFunction, table: Record<string, string>) {
  return reportTextEnum(
    Object.fromEntries(Object.entries(table).map(([code, key]) => [code, t(key)])),
  );
}

function reportI18nText(t: TFunction, table: Record<string, string>, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const key = table[raw];
  return key ? t(key) : raw;
}

function qualityReportUnitColumn(t: TFunction): ProColumns {
  return {
    title: t('common.unit'),
    dataIndex: 'unit',
    width: 80,
    minWidth: 80,
    hideInSearch: true,
    render: (_, row) =>
      React.createElement(MaterialUnitLabel, {
        value: (row.unit || row.material_unit) as string | null,
      }),
  };
}

function qualityReportPassRateColumn(t: TFunction): ProColumns {
  return {
    title: t('app.kuaizhizao.quality.reports.columns.passRate'),
    dataIndex: 'pass_rate',
    width: 90,
    hideInSearch: true,
    align: 'right',
    render: (_, row) => reportPercent(row.pass_rate),
  };
}

function qualityInspectionStatusColumn(t: TFunction): ProColumns {
  const statusEnum = reportI18nEnum(t, QUALITY_DOC_STATUS_I18N);
  return {
    title: t('common.status'),
    dataIndex: 'status',
    width: 100,
    valueEnum: statusEnum,
    search: { order: 40 } as ProColumns['search'],
    render: (_, row) => getQualityDocStatusText(t, row.status as string),
  };
}

function qualityInspectionResultColumn(t: TFunction): ProColumns {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
    dataIndex: 'inspection_result',
    width: 100,
    hideInSearch: true,
    render: (_, row) => getQualityResultText(t, row.inspection_result as string),
  };
}

function qualityInspectionQtyColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'sample_qty',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
      dataIndex: 'qualified_qty',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
      dataIndex: 'unqualified_qty',
      valueType: 'digit',
      width: 110,
      hideInSearch: true,
      align: 'right',
    },
    qualityReportPassRateColumn(t),
  ];
}

export function buildQualityReportIncomingColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
      dataIndex: 'inspection_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionDate'),
      dataIndex: 'inspection_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.supplier'),
      dataIndex: 'supplier_name',
      ellipsis: true,
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialSpec'),
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 120,
      hideInSearch: true,
    },
    qualityReportUnitColumn(t),
    ...qualityInspectionQtyColumns(t),
    qualityInspectionResultColumn(t),
    qualityInspectionStatusColumn(t),
    {
      title: t('app.kuaizhizao.quality.common.columns.inspector'),
      dataIndex: 'inspector_name',
      width: 100,
      hideInSearch: true,
    },
  ];
}

export function buildQualityReportProcessColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
      dataIndex: 'inspection_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionDate'),
      dataIndex: 'inspection_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.operationName'),
      dataIndex: 'operation_name',
      ellipsis: true,
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialSpec'),
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 120,
      hideInSearch: true,
    },
    qualityReportUnitColumn(t),
    {
      title: t('app.kuaizhizao.quality.common.columns.batchNo'),
      dataIndex: 'batch_no',
      width: 120,
      hideInSearch: true,
    },
    ...qualityInspectionQtyColumns(t),
    qualityInspectionResultColumn(t),
    qualityInspectionStatusColumn(t),
    {
      title: t('app.kuaizhizao.quality.common.columns.inspector'),
      dataIndex: 'inspector_name',
      width: 100,
      hideInSearch: true,
    },
  ];
}

export function buildQualityReportFinishedColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
      dataIndex: 'inspection_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionDate'),
      dataIndex: 'inspection_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.salesOrderCode'),
      dataIndex: 'sales_order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.customer'),
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialSpec'),
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 120,
      hideInSearch: true,
    },
    qualityReportUnitColumn(t),
    {
      title: t('app.kuaizhizao.quality.common.columns.batchNo'),
      dataIndex: 'batch_no',
      width: 120,
      hideInSearch: true,
    },
    ...qualityInspectionQtyColumns(t),
    qualityInspectionResultColumn(t),
    qualityInspectionStatusColumn(t),
    {
      title: t('app.kuaizhizao.quality.common.columns.inspector'),
      dataIndex: 'inspector_name',
      width: 100,
      hideInSearch: true,
    },
  ];
}

export function buildQualityReportNonconformingColumns(t: TFunction): ProColumns[] {
  const disposalEnum = reportI18nEnum(t, QUALITY_DISPOSAL_I18N);
  const statusEnum = reportI18nEnum(t, QUALITY_NC_LEDGER_STATUS_I18N);
  const defectEnum = reportI18nEnum(t, QUALITY_DEFECT_TYPE_I18N);
  return [
    {
      title: t('app.kuaizhizao.quality.reports.columns.handleCode'),
      dataIndex: 'handle_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.nc.columns.defectType'),
      dataIndex: 'defect_type',
      width: 110,
      hideInSearch: true,
      valueEnum: defectEnum,
      render: (_, row) => reportI18nText(t, QUALITY_DEFECT_TYPE_I18N, row.defect_type),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
      dataIndex: 'unqualified_qty',
      valueType: 'digit',
      width: 110,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.disposalMethod'),
      dataIndex: 'disposal_method',
      width: 110,
      hideInSearch: true,
      valueEnum: disposalEnum,
      render: (_, row) => reportI18nText(t, QUALITY_DISPOSAL_I18N, row.disposal_method),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: statusEnum,
      search: { order: 40 } as ProColumns['search'],
      render: (_, row) => getQualityNcLedgerStatusText(t, row.status as string),
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.disposalDate'),
      dataIndex: 'disposal_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
  ];
}

export function buildQualityReportExceptionColumns(t: TFunction): ProColumns[] {
  const typeEnum = reportI18nEnum(t, QUALITY_EXCEPTION_TYPE_I18N);
  const statusEnum = reportI18nEnum(t, QUALITY_EXCEPTION_STATUS_I18N);
  const severityEnum = reportI18nEnum(t, QUALITY_EXCEPTION_SEVERITY_I18N);
  return [
    {
      title: t('app.kuaizhizao.quality.reports.columns.discoveryDate'),
      dataIndex: 'discovery_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.exceptionType'),
      dataIndex: 'type',
      width: 120,
      hideInSearch: true,
      valueEnum: typeEnum,
      render: (_, row) => reportI18nText(t, QUALITY_EXCEPTION_TYPE_I18N, row.type),
    },
    {
      title: t('app.kuaizhizao.productionException.quality.col.severity'),
      dataIndex: 'severity',
      width: 90,
      hideInSearch: true,
      valueEnum: severityEnum,
      render: (_, row) => reportI18nText(t, QUALITY_EXCEPTION_SEVERITY_I18N, row.severity),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.batchNo'),
      dataIndex: 'batch_no',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.reason'),
      dataIndex: 'reason',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: statusEnum,
      search: { order: 40 } as ProColumns['search'],
      render: (_, row) => reportI18nText(t, QUALITY_EXCEPTION_STATUS_I18N, row.status),
    },
    {
      title: t('app.kuaizhizao.productionException.col.responsiblePerson'),
      dataIndex: 'responsible_person_name',
      width: 100,
      hideInSearch: true,
    },
  ];
}

export function buildQualityReportRateTrendColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.quality.reports.columns.month'),
      dataIndex: 'month',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.incomingQty'),
      dataIndex: 'iqc_qty',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.incomingRate'),
      dataIndex: 'iqc_rate',
      width: 110,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.iqc_rate),
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.processQty'),
      dataIndex: 'ipqc_qty',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.processRate'),
      dataIndex: 'ipqc_rate',
      width: 110,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.ipqc_rate),
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.finishedQty'),
      dataIndex: 'fqc_qty',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.finishedRate'),
      dataIndex: 'fqc_rate',
      width: 110,
      hideInSearch: true,
      align: 'right',
      render: (_, row) => reportPercent(row.fqc_rate),
    },
    {
      title: t('app.kuaizhizao.quality.reports.columns.overallRate'),
      dataIndex: 'overall_rate',
      width: 110,
      hideInSearch: true,
      align: 'right',
      sorter: true,
      render: (_, row) => reportPercent(row.overall_rate),
    },
  ];
}

/** 来料/过程/成品检验 uni-audit 工作流 props（与 record.audit + capabilities 对齐） */
export const QUALITY_INSPECTION_AUDIT_PENDING_STATUSES = ['待审核', '已检验'] as const;

export type QualityInspectionAuditEntityType =
  | 'incoming_inspection'
  | 'process_inspection'
  | 'finished_goods_inspection'
  | 'oqc_inspection';

export function qualityInspectionUniAuditProps(opts: {
  entityType: QualityInspectionAuditEntityType;
  resourcePrefix: string;
  entityName: string;
  onSuccess: () => void;
  theme?: 'default' | 'link';
  size?: 'small' | 'middle' | 'large';
}) {
  return {
    entityType: opts.entityType,
    unifiedAudit: true as const,
    resourcePrefix: opts.resourcePrefix,
    entityName: opts.entityName,
    statusField: 'status',
    reviewStatusField: 'review_status',
    draftStatuses: [] as string[],
    pendingStatuses: [...QUALITY_INSPECTION_AUDIT_PENDING_STATUSES],
    approvedStatuses: ['已审核'],
    rejectedStatuses: ['已驳回'],
    theme: opts.theme ?? 'link',
    size: opts.size ?? 'small',
    onSuccess: opts.onSuccess,
  };
}
