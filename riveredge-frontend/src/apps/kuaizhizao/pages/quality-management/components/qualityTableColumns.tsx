/**
 * 质量管理列表页：堆叠列与合格/不合格数量展示（Ant Design 语义色）
 */

import React from 'react';
import { Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';

export function pickRecordText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function renderQualifiedQuantity(value: unknown): React.ReactNode {
  const val = Number(value ?? 0);
  return <Typography.Text type="success">{val.toFixed(2)}</Typography.Text>;
}

export function renderUnqualifiedQuantity(value: unknown): React.ReactNode {
  const val = Number(value ?? 0);
  return <Typography.Text type="danger">{val.toFixed(2)}</Typography.Text>;
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
