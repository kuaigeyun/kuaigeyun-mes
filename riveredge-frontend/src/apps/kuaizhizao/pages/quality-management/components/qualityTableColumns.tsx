/**
 * 质量管理列表页：堆叠列与合格/不合格数量展示（Ant Design 语义色）
 *
 * 检验四单据列表列序：与 GLOBAL_DOC_LIST_FIELD_RANK 中 quality_inspection_* /
 * inspection_code / downstream_push_progress / inspector_name 对齐；本文件挂载 key，
 * 页面不得另起 key 或浅覆盖 rank。
 */

import React from 'react';
import { Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';

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

export function stackedPrimarySecondaryColumn<T extends object>(
  title: string,
  key: string,
  primaryKeys: string[],
  secondaryKeys: string[],
  options?: { dataIndex?: string; fixed?: 'left' | 'right' },
): ProColumns<T> {
  return {
    title,
    key,
    dataIndex: options?.dataIndex ?? primaryKeys[0],
    fixed: options?.fixed,
    ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
    render: (_, record) => (
      <UniTableStackedPrimaryCell
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

export function buildInspectorTimeStackedColumn<T extends object>(
  title: string,
  options?: { dataIndex?: string; width?: number; timeKeys?: string[]; primaryKeys?: string[] },
): ProColumns<T> {
  const timeKeys = options?.timeKeys ?? ['inspection_time', 'inspectionTime'];
  const primaryKeys = options?.primaryKeys ?? ['inspector_name', 'inspectorName'];
  return {
    title,
    key: 'inspector_name',
    dataIndex: options?.dataIndex ?? 'inspector_name',
    width: options?.width ?? 168,
    uniTableKeepWidth: true,
    sorter: true,
    hideInSearch: true,
    render: (_, record) => {
      const rawTime = pickRecordText(record as Record<string, unknown>, ...timeKeys);
      return (
        <UniTableStackedPrimaryCell
          primary={pickRecordText(record as Record<string, unknown>, ...primaryKeys) || '-'}
          secondary={rawTime ? formatDateTime(rawTime, 'YYYY-MM-DD HH:mm:ss') : '-'}
          secondaryCopyable={false}
        />
      );
    },
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
  render: (_: unknown, record: Record<string, unknown>) =>
    renderQualifiedQuantity(record.qualified_quantity ?? record.qualifiedQuantity, record),
};

export const unqualifiedQuantityColumnProps = {
  align: 'right' as const,
  width: 100,
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
      title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 11 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.status'),
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

export function buildQualityInspectionListCodeColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
    dataIndex: 'inspection_code',
    width: 140,
    ellipsis: true,
    fixed: 'left',
    sorter: true,
    search: { order: 30 } as ProColumns['search'],
    render: (_, r) => (
      <Typography.Text
        copyable={{ text: String((r as Record<string, unknown>).inspection_code ?? '') }}
        ellipsis
      >
        {String((r as Record<string, unknown>).inspection_code ?? '-')}
      </Typography.Text>
    ),
  };
}

export function buildQualityInspectionListMaterialColumn<T extends object>(t: TFunction): ProColumns<T> {
  return {
    title: t('app.kuaizhizao.quality.common.columns.material'),
    // 与 GLOBAL_DOC_LIST_FIELD_RANK.quality_inspection_material 对齐（勿用 material_name）
    key: 'quality_inspection_material',
    dataIndex: 'material_name',
    ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
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
