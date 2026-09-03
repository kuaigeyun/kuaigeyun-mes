/**
 * 质量管理列表页：堆叠列与合格/不合格数量展示（Ant Design 语义色）
 *
 * 检验四单据列表列序：与 GLOBAL_DOC_LIST_FIELD_RANK 中 inspection_code /
 * quality_inspection_kind / quality_inspection_* / downstream_push_progress / inspector_name / notes 对齐；
 * 余量列仅 notes（buildQualityInspectionListNotesColumn）；本文件挂载 key，页面不得另起 key 或浅覆盖 rank。
 */

import React from 'react';
import { Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import type { InspectionPlanStepItem } from '../../../components/InspectionPlanStepEditor';
import type { DefectLedgerItem } from '../../../services/quality-improvement';
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_IDENTITY_CLASS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { formatQuantity } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  getInspectionTemplateSource,
  hasInspectionPlanSteps,
} from './inspectionTemplateUtils';
import { renderNcSourceInspectionStackedCell } from '../nonconforming-ledger/ncLedgerSource';
import { resolveQualityInspectionKindMarkerColor } from './qualityMeta';

/** 不良处理源检验单列 key → rank 10.6（台账编号后） */
export const NC_SOURCE_INSPECTION_KEY = 'nc_source_inspection';

const NC_SOURCE_INSPECTION_COLUMN_WIDTH = 150;

/** 质检方案列表：检验步骤预览列 key → rank 20.15（类型后、版本前） */
export const INSPECTION_PLAN_STEPS_KEY = 'inspection_plan_steps';

/** 方案类型列宽：容纳「过程检验 (IPQC)」等最长文案，禁止 ellipsis 截断 */
const INSPECTION_PLAN_TYPE_COLUMN_WIDTH = 144;

export const QUALITY_INSPECTION_KIND_KEY = 'quality_inspection_kind';

/** 第二业务列（伙伴/来源叠列）统一 key → rank 11 */
export const QUALITY_INSPECTION_PARTNER_STACKED_KEY = 'quality_inspection_partner_stacked';

/** 数量后专属结论列（如 OQC 放行）统一 key → rank 32 */
export const QUALITY_INSPECTION_EXTRA_KEY = 'quality_inspection_extra';

function renderRecordQuantityWithUnit(record: Record<string, unknown>, quantityKey: string): React.ReactNode {
  const qty = record[quantityKey];
  const unit = String(record.material_unit ?? record.materialUnit ?? '').trim();
  return formatQuantityWithUnit(qty, unit || undefined);
}

export function pickRecordText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function renderQualifiedQuantity(value: unknown, record?: Record<string, unknown>): React.ReactNode {
  if (record) {
    return <Typography.Text type="success">{renderRecordQuantityWithUnit(record, 'qualified_quantity')}</Typography.Text>;
  }
  return <Typography.Text type="success">{formatQuantity(value)}</Typography.Text>;
}

export function renderUnqualifiedQuantity(value: unknown, record?: Record<string, unknown>): React.ReactNode {
  if (record) {
    return <Typography.Text type="danger">{renderRecordQuantityWithUnit(record, 'unqualified_quantity')}</Typography.Text>;
  }
  return <Typography.Text type="danger">{formatQuantity(value)}</Typography.Text>;
}

/** 不良处理台账：源检验单（类型 + 单号堆叠，定宽） */
export function buildNcSourceInspectionStackedColumn<T extends object>(
  t: TFunction,
  navigate: (path: string) => void,
): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.nc.columns.sourceInspection'),
    key: NC_SOURCE_INSPECTION_KEY,
    dataIndex: NC_SOURCE_INSPECTION_KEY,
    width: NC_SOURCE_INSPECTION_COLUMN_WIDTH,
    minWidth: NC_SOURCE_INSPECTION_COLUMN_WIDTH,
    uniTableKeepWidth: true,
    resizable: false,
    ellipsis: false,
    hideInSearch: true,
    onCell: () => ({ style: { whiteSpace: 'normal' } }),
    render: (_, row) => renderNcSourceInspectionStackedCell(t, row as DefectLedgerItem, navigate),
  };
}

function sortInspectionPlanStepLabels(steps: InspectionPlanStepItem[] | undefined): string[] {
  return (steps || [])
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    .map((step) => String(step.inspection_item ?? '').trim())
    .filter((text) => text.length > 0);
}

export function renderInspectionPlanStepsPreview(
  steps: InspectionPlanStepItem[] | undefined,
  t: TFunction,
): React.ReactNode {
  const labels = sortInspectionPlanStepLabels(steps);
  if (labels.length === 0) return '-';
  const preview = labels.slice(0, 2);
  const restCount = labels.length - preview.length;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {preview.map((text, index) => (
        <MarkerTag key={`${index}-${text}`}>{text}</MarkerTag>
      ))}
      {restCount > 0 ? (
        <MarkerTag color="default">
          {t('app.kuaizhizao.quality.plans.stepsAndMore', { count: restCount })}
        </MarkerTag>
      ) : null}
    </div>
  );
}

/** 质检方案列表：检验步骤列（余量列，吃掉视口剩余宽度；禁止 filler / max 上限） */
export function buildInspectionPlanStepsColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.plans.columns.inspectionSteps'),
    key: INSPECTION_PLAN_STEPS_KEY,
    dataIndex: INSPECTION_PLAN_STEPS_KEY,
    minWidth: 160,
    uniTablePrimaryFlex: true,
    uniTableRemainderFlex: true,
    resizable: false,
    ellipsis: false,
    hideInSearch: true,
    onCell: () => ({ style: { whiteSpace: 'normal' } }),
    render: (_, record) =>
      renderInspectionPlanStepsPreview(
        (record as { steps?: InspectionPlanStepItem[] }).steps,
        t,
      ),
  };
}

/** 质检方案列表：方案类型列（定宽完整展示 IQC/IPQC/FQC 文案） */
export function buildInspectionPlanTypeColumn<T extends object>(
  t: TFunction,
  render: ProColumns<T>['render'],
  options?: { sorter?: boolean },
): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.plans.columns.planType'),
    dataIndex: 'plan_type',
    width: INSPECTION_PLAN_TYPE_COLUMN_WIDTH,
    minWidth: INSPECTION_PLAN_TYPE_COLUMN_WIDTH,
    uniTableKeepWidth: true,
    resizable: false,
    ellipsis: false,
    sorter: options?.sorter ?? false,
    hideInSearch: true,
    render,
  };
}

export function stackedPrimarySecondaryColumn<T extends object>(
  title: string,
  key: string,
  primaryKeys: string[],
  secondaryKeys: string[],
  options?: {
    dataIndex?: string;
    fixed?: 'left' | 'right';
    minWidth?: number;
    /** keep=ContentKeepWidth（默认）；remainder=唯一余量列 */
    widthMode?: 'keep' | 'remainder';
  },
): ProColumns<T> {
  const minWidth = options?.minWidth ?? 200;
  const remainder = options?.widthMode === 'remainder';
  return {
    title,
    key,
    dataIndex: options?.dataIndex ?? primaryKeys[0],
    fixed: options?.fixed,
    ...(remainder
      ? {
          minWidth,
          uniTablePrimaryFlex: true,
          uniTableRemainderFlex: true,
        }
      : {
          width: minWidth,
          minWidth,
          uniTableKeepWidth: true,
          uniTablePrimaryFlex: false,
        }),
    resizable: false,
    ellipsis: false,
    render: (_, record) => (
      <UniTableStackedPrimaryCell
        record={record as Record<string, unknown>}
        secondaryKeys={secondaryKeys}
        primary={pickRecordText(record as Record<string, unknown>, ...primaryKeys) || '-'}
        secondary={pickRecordText(record as Record<string, unknown>, ...secondaryKeys) || '-'}
      />
    ),
  };
}

/**
 * 检验四单据第二业务列（来料：供应商/入库单；过程：工序/工单；成品：工单/销售订单；出货：客户/发货通知）。
 * key 固定为 QUALITY_INSPECTION_PARTNER_STACKED_KEY，勿在页面改 key。
 */
export function buildQualityInspectionPartnerStackedColumn<T extends object>(
  title: string,
  primaryKeys: string[],
  secondaryKeys: string[],
  options?: { dataIndex?: string; fixed?: 'left' | 'right' },
): ProColumns<T> {
  return stackedPrimarySecondaryColumn<T>(
    title,
    QUALITY_INSPECTION_PARTNER_STACKED_KEY,
    primaryKeys,
    secondaryKeys,
    options,
  );
}

/** 检验四单据检验员列：只展示人名，不叠检验时间（时间在高级搜索） */
export function buildInspectorNameColumn<T extends object>(
  title: string,
  options?: { dataIndex?: string; width?: number; primaryKeys?: string[] },
): ProColumns<T> {
  const primaryKeys = options?.primaryKeys ?? ['inspector_name', 'inspectorName'];
  const width = options?.width ?? 96;
  return {
    title,
    key: 'inspector_name',
    dataIndex: options?.dataIndex ?? 'inspector_name',
    width,
    minWidth: width,
    uniTableKeepWidth: true,
    resizable: false,
    sorter: true,
    hideInSearch: true,
    ellipsis: true,
    render: (_, record) =>
      pickRecordText(record as Record<string, unknown>, ...primaryKeys) || '-',
  };
}

/** 检验四单据下推进度列；key 固定 downstream_push_progress → rank 50 */
export function buildQualityInspectionListPushProgressColumn<T extends object>(
  t: TFunction,
  options: {
    dataIndex: string;
    getPercent: (record: T) => number;
  },
): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
    key: 'downstream_push_progress',
    dataIndex: options.dataIndex,
    ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
    render: (_, record) => {
      const percent = options.getPercent(record);
      return (
        <DocumentPushProgressBar
          percent={percent}
          tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
            percent: Math.round(percent),
          })}
        />
      );
    },
  };
}

export const qualifiedQuantityColumnProps = {
  align: 'right' as const,
  width: 100,
  minWidth: 100,
  uniTableKeepWidth: true,
  resizable: false,
  render: (_: unknown, record: Record<string, unknown>) =>
    renderQualifiedQuantity(record.qualified_quantity ?? record.qualifiedQuantity, record),
};

export const unqualifiedQuantityColumnProps = {
  align: 'right' as const,
  width: 100,
  minWidth: 100,
  uniTableKeepWidth: true,
  resizable: false,
  render: (_: unknown, record: Record<string, unknown>) =>
    renderUnqualifiedQuantity(record.unqualified_quantity ?? record.unqualifiedQuantity, record),
};

/** 检验四单据列表：高级搜索区（顺序与来料检验一致） */
export function buildQualityInspectionListSearchColumns<T extends object>(
  t: TFunction,
  inspectionDocStatusValueEnum: ProColumns['valueEnum'],
  inspectionQualityStatusValueEnum: ProColumns['valueEnum'],
): ProColumns<T>[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
      dataIndex: 'inspection_time_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 11 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: inspectionDocStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
      dataIndex: 'quality_status',
      valueType: 'select',
      valueEnum: inspectionQualityStatusValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
  ];
}

/** 检验类型定宽：简易检验 / 方案检验 */
const QUALITY_INSPECTION_KIND_COLUMN_WIDTH = 96;

/** 检验四单据类型列：有方案步骤为方案检验，否则简易检验 */
export function buildQualityInspectionListKindColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionKind'),
    key: QUALITY_INSPECTION_KIND_KEY,
    dataIndex: QUALITY_INSPECTION_KIND_KEY,
    width: QUALITY_INSPECTION_KIND_COLUMN_WIDTH,
    minWidth: QUALITY_INSPECTION_KIND_COLUMN_WIDTH,
    uniTableKeepWidth: true,
    resizable: false,
    fixed: 'left',
    hideInSearch: true,
    ellipsis: true,
    render: (_, record) => {
      const isPlan = hasInspectionPlanSteps(
        getInspectionTemplateSource(record as Record<string, unknown>),
      );
      return (
        <MarkerTag color={resolveQualityInspectionKindMarkerColor(isPlan)}>
          {isPlan
            ? t('app.kuaizhizao.quality.common.inspectionKind.plan')
            : t('app.kuaizhizao.quality.common.inspectionKind.simple')}
        </MarkerTag>
      );
    },
  };
}

/** 检验单号定宽：LLJY+日期+流水约 16 位 + 复制图标；单号不得省略号截断 */
const QUALITY_INSPECTION_CODE_COLUMN_WIDTH = 196;

export function buildQualityInspectionListCodeColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
    key: 'inspection_code',
    dataIndex: 'inspection_code',
    width: QUALITY_INSPECTION_CODE_COLUMN_WIDTH,
    minWidth: QUALITY_INSPECTION_CODE_COLUMN_WIDTH,
    uniTableKeepWidth: true,
    resizable: false,
    ellipsis: false,
    fixed: 'left',
    sorter: true,
    search: { order: 30 } as ProColumns['search'],
    render: (_, r) => {
      const code = String((r as Record<string, unknown>).inspection_code ?? '').trim() || '-';
      return (
        <span
          className={UNI_TABLE_STACKED_IDENTITY_CLASS}
          style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
        >
          <Typography.Text
            copyable={code === '-' ? undefined : { text: code }}
            style={{ margin: 0, whiteSpace: 'nowrap' }}
          >
            {code}
          </Typography.Text>
        </span>
      );
    },
  };
}

export function buildQualityInspectionListMaterialColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.material'),
    // 与 GLOBAL_DOC_LIST_FIELD_RANK.quality_inspection_material 对齐（勿用 material_name）
    key: 'quality_inspection_material',
    dataIndex: 'material_name',
    // 余量列留给检验备注；物料叠列 ContentKeepWidth
    width: 200,
    minWidth: 200,
    uniTableKeepWidth: true,
    uniTablePrimaryFlex: false,
    resizable: false,
    ellipsis: false,
    render: (_, r) => {
      const row = r as Record<string, unknown>;
      return (
        <MaterialStackedCell
          material_name={row.material_name as string | undefined}
          material_code={row.material_code as string | undefined}
        />
      );
    },
  };
}

/**
 * 检验四单据：检验备注（唯一 RemainderFlex）。
 * key 用 notes → GLOBAL_DOC_LIST_FIELD_RANK.notes（勿用 quality_inspection_extra，OQC 放行占用该 key）。
 */
export function buildQualityInspectionListNotesColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionNotes'),
    key: 'notes',
    dataIndex: 'notes',
    minWidth: 160,
    uniTablePrimaryFlex: true,
    uniTableRemainderFlex: true,
    resizable: false,
    ellipsis: true,
    hideInSearch: true,
  };
}

export function buildQualityInspectionListMaterialHiddenColumns<T extends object>(
  t: TFunction,
): ProColumns<T>[] {
  return [
    { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code', hideInTable: true },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', hideInTable: true },
  ];
}

/**
 * 检验数量列（四单据共用）。
 * 列表不展示「检验结果」（与执行状态重复）；详情仍用 qualityDetailColumns。
 * extraAfterQuantity：下推进度 / OQC 放行等，须自带 rank 约定 key（见 buildQualityInspectionListPushProgressColumn / QUALITY_INSPECTION_EXTRA_KEY）。
 */
export function buildQualityInspectionListQuantityResultColumns<T extends object>(
  t: TFunction,
  extraAfterQuantity: ProColumns<T>[] = [],
): ProColumns<T>[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'inspection_quantity',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) =>
        renderRecordQuantityWithUnit(record as Record<string, unknown>, 'inspection_quantity'),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
      dataIndex: 'qualified_quantity',
      sorter: true,
      hideInSearch: true,
      ...qualifiedQuantityColumnProps,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      sorter: true,
      hideInSearch: true,
      ...unqualifiedQuantityColumnProps,
    },
    ...extraAfterQuantity,
  ];
}
