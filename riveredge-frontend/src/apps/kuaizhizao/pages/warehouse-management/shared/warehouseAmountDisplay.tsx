/**
 * 仓储 hub 列表/明细「显示金额」开关（默认关闭，偏好写入 localStorage）
 */
import React, { useCallback, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import type { ColumnsType } from 'antd/es/table';
import { Space, Switch } from 'antd';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'kuaizhizao.warehouse-hub.showAmount';

export function formatWarehouseAmount(val: unknown): string {
  if (val == null || val === '') return '-';
  const n = Number(val);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderWarehouseAmountCell(val: unknown): string {
  const formatted = formatWarehouseAmount(val);
  return formatted === '-' ? formatted : `¥${formatted}`;
}

export function useWarehouseShowAmount(): [boolean, (next: boolean) => void] {
  const [showAmount, setShowAmount] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setShowAmountPersist = useCallback((next: boolean) => {
    setShowAmount(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  return [showAmount, setShowAmountPersist];
}

export function WarehouseShowAmountSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Space size={6} style={{ marginInlineEnd: 4 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{t('app.kuaizhizao.warehouseCommon.showAmount')}</span>
      <Switch checked={checked} onChange={onChange} size="small" />
    </Space>
  );
}

export function buildWarehouseTotalAmountListColumn<T extends Record<string, unknown>>(
  t: TFunction,
  showAmount: boolean,
): ProColumns<T>[] {
  if (!showAmount) return [];
  return [
    {
      title: t('app.kuaizhizao.warehouseCommon.colAmount'),
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      sorter: true,
      render: (_dom, record) => renderWarehouseAmountCell(record.total_amount),
    },
  ];
}

type LineAmountCol = ColumnsType[number];

export function buildWarehouseLineUnitPriceColumn(t: TFunction, showAmount: boolean): LineAmountCol[] {
  if (!showAmount) return [];
  return [
    {
      title: t('app.kuaizhizao.warehouseCommon.colUnitPrice'),
      dataIndex: 'unit_price',
      width: 90,
      align: 'right' as const,
      render: (val: unknown) => renderWarehouseAmountCell(val),
    },
  ];
}

export function buildWarehouseLineAmountColumn(t: TFunction, showAmount: boolean): LineAmountCol[] {
  if (!showAmount) return [];
  return [
    {
      title: t('app.kuaizhizao.warehouseCommon.colAmount'),
      dataIndex: 'total_amount',
      width: 100,
      align: 'right' as const,
      render: (val: unknown) => renderWarehouseAmountCell(val),
    },
  ];
}

export function appendWarehouseLineAmountColumns<T extends LineAmountCol>(
  columns: T[],
  t: TFunction,
  showAmount: boolean,
  insertBeforeIndex?: number,
): T[] {
  if (!showAmount) return columns;
  const amountCols = [
    ...buildWarehouseLineUnitPriceColumn(t, true),
    ...buildWarehouseLineAmountColumn(t, true),
  ] as T[];
  if (insertBeforeIndex == null || insertBeforeIndex < 0 || insertBeforeIndex >= columns.length) {
    return [...columns, ...amountCols];
  }
  return [...columns.slice(0, insertBeforeIndex), ...amountCols, ...columns.slice(insertBeforeIndex)];
}
