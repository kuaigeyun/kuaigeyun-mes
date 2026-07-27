/**
 * 质量管理列表页：堆叠列与合格/不合格数量展示（Ant Design 语义色）
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
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';

export function pickRecordText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function renderQualifiedQuantity(value: unknown): React.ReactNode {
  return <Typography.Text type="success">{formatQuantity(value)}</Typography.Text>;
}

export function renderUnqualifiedQuantity(value: unknown): React.ReactNode {
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

export function buildInspectorTimeStackedColumn<T extends object>(
  title: string,
  options?: { dataIndex?: string; width?: number; timeKeys?: string[]; primaryKeys?: string[] },
): ProColumns<T> {
  const timeKeys = options?.timeKeys ?? ['inspection_time', 'inspectionTime'];
  const primaryKeys = options?.primaryKeys ?? ['inspector_name', 'inspectorName'];
  return {
    title,
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

export const qualifiedQuantityColumnProps = {
  align: 'right' as const,
  width: 100,
  render: (_: unknown, record: Record<string, unknown>) =>
    renderQualifiedQuantity(record.qualified_quantity ?? record.qualifiedQuantity),
};

export const unqualifiedQuantityColumnProps = {
  align: 'right' as const,
  width: 100,
  render: (_: unknown, record: Record<string, unknown>) =>
    renderUnqualifiedQuantity(record.unqualified_quantity ?? record.unqualifiedQuantity),
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
    key: 'material_name',
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

/** 检验数量与结果列（顺序与来料检验一致；可追加环节专属列如放行结论、下推进度） */
export function buildQualityInspectionListQuantityResultColumns<T extends object>(
  t: TFunction,
  renderInspectionResult: (t: TFunction, value?: string | null) => React.ReactNode,
  extraAfterResult: ProColumns<T>[] = [],
): ProColumns<T>[] {
  return [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'inspection_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (text) => text || 0,
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
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
      dataIndex: 'inspection_result',
      width: 100,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        renderInspectionResult(t, String((r as Record<string, unknown>).inspection_result ?? '')),
    },
    ...extraAfterResult,
  ];
}
