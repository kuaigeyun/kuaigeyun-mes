import React from 'react';
import { Tag } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';

export const QUALITY_DISPOSAL_I18N: Record<string, string> = {
  return: 'app.kuaizhizao.quality.common.disposal.return',
  accept: 'app.kuaizhizao.quality.common.disposal.accept',
  quarantine: 'app.kuaizhizao.quality.common.disposal.quarantine',
  rework: 'app.kuaizhizao.quality.common.disposal.rework',
  scrap: 'app.kuaizhizao.quality.common.disposal.scrap',
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
  待检验: 'app.kuaizhizao.quality.common.result.pending',
  合格: 'app.kuaizhizao.quality.common.result.qualified',
  不合格: 'app.kuaizhizao.quality.common.result.unqualified',
  部分合格: 'app.kuaizhizao.quality.common.result.partial',
};

export const QUALITY_DOC_STATUS_I18N: Record<string, string> = {
  草稿: 'app.kuaizhizao.quality.common.docStatus.draft',
  已审核: 'app.kuaizhizao.quality.common.docStatus.reviewed',
  已完成: 'app.kuaizhizao.quality.common.docStatus.completed',
  已取消: 'app.kuaizhizao.quality.common.docStatus.cancelled',
  待检验: 'app.kuaizhizao.quality.common.docStatus.pendingInspection',
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

const DOC_STATUS_COLORS: Record<string, string> = {
  草稿: 'default',
  已审核: 'processing',
  已完成: 'success',
  已取消: 'error',
  待检验: 'default',
};

const RESULT_COLORS: Record<string, string> = {
  待检验: 'default',
  pending: 'default',
  合格: 'success',
  qualified: 'success',
  不合格: 'error',
  unqualified: 'error',
  部分合格: 'warning',
  partial: 'warning',
};

export function getQualityDisposalFallbackOptions(t: TFunction, keys: string[]) {
  return keys.map((value) => ({
    value,
    label: t(QUALITY_DISPOSAL_I18N[value] ?? value),
  }));
}

export function getQualityIncomingDisposalFallback(t: TFunction) {
  return getQualityDisposalFallbackOptions(t, ['return', 'accept', 'quarantine', 'other']);
}

export function getQualityFinishedDisposalFallback(t: TFunction) {
  return getQualityDisposalFallbackOptions(t, ['rework', 'scrap', 'accept', 'quarantine', 'other']);
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
  const color = RESULT_COLORS[String(result ?? 'pending')] ?? 'default';
  return React.createElement(Tag, { color }, text);
}

export function renderQualityDocStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getQualityDocStatusText(t, status);
  const color = DOC_STATUS_COLORS[String(status)] ?? 'default';
  return React.createElement(Tag, { color }, text);
}

export function renderQualityQualityStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  if (!status) {
    return React.createElement(Tag, null, t('app.kuaizhizao.quality.common.qualityStatus.pending'));
  }
  const key = QUALITY_QUALITY_STATUS_I18N[status];
  const text = key ? t(key) : status;
  const color = status === '合格' ? 'success' : 'error';
  return React.createElement(Tag, { color }, text);
}

const RELEASE_DECISION_COLORS: Record<string, string> = {
  released: 'success',
  rejected: 'error',
  pending: 'default',
};

export function renderReleaseDecisionTag(t: TFunction, decision?: string | null): React.ReactNode {
  const text = getQualityReleaseDecisionText(t, decision);
  const color = RELEASE_DECISION_COLORS[String(decision ?? 'pending')] ?? 'default';
  return React.createElement(Tag, { color }, text);
}

export function renderNcLedgerStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getQualityNcLedgerStatusText(t, status);
  const color = status === 'processed' ? 'success' : 'processing';
  return React.createElement(Tag, { color }, text);
}

export function buildQualityReportIncomingColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.quality.common.columns.inspectionCode'), dataIndex: 'inspection_code', width: 150 },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', width: 200 },
    { title: t('app.kuaizhizao.quality.common.columns.batchNo'), dataIndex: 'batch_no', width: 150 },
    { title: t('app.kuaizhizao.quality.common.columns.inspectionDate'), dataIndex: 'inspection_date', valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.quality.common.columns.sampleQty'), dataIndex: 'sample_qty', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'), dataIndex: 'qualified_qty', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.passRate'), dataIndex: 'pass_rate', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.status'), dataIndex: 'status', width: 100 },
  ];
}

export function buildQualityReportProcessColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.quality.common.columns.inspectionCode'), dataIndex: 'inspection_code', width: 150 },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', width: 200 },
    { title: t('app.kuaizhizao.quality.common.columns.workOrderCode'), dataIndex: 'work_order_code', width: 150 },
    { title: t('app.kuaizhizao.quality.common.columns.inspectionDate'), dataIndex: 'inspection_date', valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.quality.common.columns.sampleQty'), dataIndex: 'sample_qty', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'), dataIndex: 'qualified_qty', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.passRate'), dataIndex: 'pass_rate', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.common.columns.status'), dataIndex: 'status', width: 100 },
  ];
}

export function buildQualityReportFinishedColumns(t: TFunction): ProColumns[] {
  return buildQualityReportIncomingColumns(t);
}

export function buildQualityReportNonconformingColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.quality.reports.columns.handleCode'), dataIndex: 'handle_code', width: 150 },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', width: 200 },
    { title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'), dataIndex: 'unqualified_qty', valueType: 'digit', width: 100 },
    { title: t('app.kuaizhizao.quality.reports.columns.disposalMethod'), dataIndex: 'disposal_method', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.disposalDate'), dataIndex: 'disposal_date', valueType: 'date', width: 120 },
  ];
}

export function buildQualityReportExceptionColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.quality.reports.columns.exceptionCode'), dataIndex: 'exception_code', width: 150 },
    { title: t('app.kuaizhizao.quality.reports.columns.discoveryDate'), dataIndex: 'discovery_date', valueType: 'date', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.exceptionType'), dataIndex: 'type', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.reason'), dataIndex: 'reason', ellipsis: true },
    { title: t('app.kuaizhizao.quality.common.columns.status'), dataIndex: 'status', width: 100 },
  ];
}

export function buildQualityReportRateTrendColumns(t: TFunction): ProColumns[] {
  return [
    { title: t('app.kuaizhizao.quality.reports.columns.month'), dataIndex: 'month', valueType: 'dateMonth', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.iqcRate'), dataIndex: 'iqc_rate', valueType: 'percent', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.ipqcRate'), dataIndex: 'ipqc_rate', valueType: 'percent', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.fqcRate'), dataIndex: 'fqc_rate', valueType: 'percent', width: 120 },
    { title: t('app.kuaizhizao.quality.reports.columns.overallRate'), dataIndex: 'overall_rate', valueType: 'percent', width: 120, sorter: true },
  ];
}

/** 来料/过程/成品检验 uni-audit 工作流 props（与 record.audit + capabilities 对齐） */
export const QUALITY_INSPECTION_AUDIT_PENDING_STATUSES = ['待审核', '已检验'] as const;

export type QualityInspectionAuditEntityType =
  | 'incoming_inspection'
  | 'process_inspection'
  | 'finished_goods_inspection';

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
