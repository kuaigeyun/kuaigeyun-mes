import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Popover, Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { ListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { apiRequest } from '../../../../../services/api';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import { resolveInventoryMaterialBalanceListParams } from '../../../utils/warehouseListCore';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
import { fetchAllCurrentPageItems } from '../../../../../utils/fetchAllListPages';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';

interface InTransitBreakdown {
  purchase_quantity: number;
  work_order_quantity: number;
  outsource_work_order_quantity: number;
}

interface InventoryItem {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string | null;
  brand?: string | null;
  texture?: string | null;
  model?: string | null;
  material_unit?: string | null;
  quantity: number;
  in_transit_quantity?: number;
  in_transit_breakdown?: InTransitBreakdown | null;
  alert_status?: string | null;
  alert_level?: string | null;
  alert_label?: string | null;
  alert_message?: string | null;
  status: string;
  warehouse_id?: number | null;
  warehouse_name: string | null;
}

interface InventorySummary {
  total_records: number;
  total_quantity: number;
  in_stock_count: number;
  zero_stock_count: number;
  expired_count: number;
  near_expiry_count: number;
}

interface WarehouseOption {
  id: number;
  name: string;
}

function InTransitPopoverContent({
  breakdown,
  t,
}: {
  breakdown?: InTransitBreakdown | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const rows = [
    {
      key: 'purchase',
      label: t('app.kuaizhizao.warehouseInventory.inTransitPurchase'),
      value: breakdown?.purchase_quantity ?? 0,
    },
    {
      key: 'work_order',
      label: t('app.kuaizhizao.warehouseInventory.inTransitWorkOrder'),
      value: breakdown?.work_order_quantity ?? 0,
    },
    {
      key: 'outsource',
      label: t('app.kuaizhizao.warehouseInventory.inTransitOutsource'),
      value: breakdown?.outsource_work_order_quantity ?? 0,
    },
  ];
  return (
    <div style={{ minWidth: 200, fontSize: 12 }}>
      <Typography.Text strong>{t('app.kuaizhizao.warehouseInventory.inTransitDetailTitle')}</Typography.Text>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {rows.map((row) => (
          <li key={row.key}>
            {row.label}: <strong>{formatQuantity(row.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderInTransitCell(record: InventoryItem, t: (key: string) => string) {
  const total = Number(record.in_transit_quantity ?? 0);
  if (!total) return '—';
  const breakdown = record.in_transit_breakdown;
  const hasDetail =
    breakdown &&
    (breakdown.purchase_quantity > 0 ||
      breakdown.work_order_quantity > 0 ||
      breakdown.outsource_work_order_quantity > 0);
  if (!hasDetail) return formatQuantity(total);
  return (
    <Popover content={<InTransitPopoverContent breakdown={breakdown} t={t} />} trigger="hover">
      <span style={{ cursor: 'help', borderBottom: '1px dashed var(--ant-color-text-secondary)' }}>
        {formatQuantity(total)}
      </span>
    </Popover>
  );
}

function renderAlertCell(record: InventoryItem, t: (key: string) => string) {
  const status = record.alert_status || 'normal';
  const label = record.alert_label || t('app.kuaizhizao.warehouseInventory.alertNormal');
  let color: string | undefined;
  if (status === 'low_stock') color = record.alert_level === 'critical' ? 'error' : 'warning';
  else if (status === 'high_stock') color = 'orange';
  else if (status === 'expired') color = 'error';
  else if (status === 'normal') color = 'success';

  const tag = <MarkerTag color={color}>{label}</MarkerTag>;
  if (record.alert_message && status !== 'normal') {
    return (
      <Popover content={<Typography.Text style={{ fontSize: 12 }}>{record.alert_message}</Typography.Text>}>
        <span style={{ cursor: 'help' }}>{tag}</span>
      </Popover>
    );
  }
  return tag;
}

function renderInventoryStockStatus(status: string) {
  let color: string = 'default';
  if (status === '已过期') color = 'error';
  else if (status === '无库存') color = 'warning';
  else if (status === '在库') color = 'success';
  return <MarkerTag color={color}>{status}</MarkerTag>;
}

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<any>(null);
  const lastQueryRef = useRef<Record<string, any>>({});

  const [includeZeroStock, setIncludeZeroStock] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState<'all' | number>('all');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  // setState 后立刻 reload 时闭包仍是旧值；用 ref 保证请求参数与开关一致
  const includeZeroStockRef = useRef(true);
  const warehouseFilterRef = useRef(warehouseFilter);
  includeZeroStockRef.current = includeZeroStock;
  warehouseFilterRef.current = warehouseFilter;
  const [summary, setSummary] = useState<InventorySummary>({
    total_records: 0,
    total_quantity: 0,
    in_stock_count: 0,
    zero_stock_count: 0,
    expired_count: 0,
    near_expiry_count: 0,
  });

  useEffect(() => {
    let cancelled = false;
    warehouseApi
      .list({ limit: 1000, is_active: true })
      .then((res: any) => {
        if (cancelled) return;
        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setWarehouses(
          items
            .map((w: any) => ({
              id: Number(w.id ?? w.warehouse_id),
              name: String(w.name || '').trim(),
            }))
            .filter((w: WarehouseOption) => Number.isFinite(w.id) && w.id > 0 && w.name)
            .sort((a: WarehouseOption, b: WarehouseOption) => a.name.localeCompare(b.name, 'zh-CN')),
        );
      })
      .catch(() => {
        if (!cancelled) {
          messageApi.error(t('app.kuaizhizao.warehouseInventory.loadWarehousesFailed'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [messageApi, t]);

  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const renderCell = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || '—';
  };

  const exportRows = (rows: InventoryItem[]) => {
    const headers = [
      t('app.kuaizhizao.warehouseReports.colMaterialCode'),
      t('app.kuaizhizao.warehouseReports.colMaterialName'),
      t('app.master-data.materials.specification'),
      t('app.master-data.materials.model'),
      t('app.kuaizhizao.warehouseInventory.colBrand'),
      t('app.kuaizhizao.warehouseInventory.colTexture'),
      t('common.unit'),
      t('app.kuaizhizao.warehouseReports.colStockQty'),
      t('app.kuaizhizao.warehouseInventory.colInTransit'),
      t('app.kuaizhizao.warehouseInventory.colAlert'),
      t('common.status'),
      t('app.kuaizhizao.warehouseReports.colWarehouse'),
    ];
    const lines = rows.map((r) =>
      [
        r.material_code,
        r.material_name,
        r.material_spec,
        r.model,
        r.brand,
        r.texture,
        r.material_unit,
        r.quantity,
        r.in_transit_quantity ?? 0,
        r.alert_label,
        r.status,
        r.warehouse_name || '-',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-realtime-${todaySiteDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const warehouseSelectOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.warehouseCommon.allWarehouses'), value: 'all' },
      ...warehouses.map((w) => ({ label: w.name, value: String(w.id) })),
    ],
    [t, warehouses],
  );

  const tableHeaderActions = useMemo(
    () => (
      <Space wrap>
        <ThemedSegmented
          surfaceBackground
          value={includeZeroStock ? 'show' : 'hide'}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.showZeroStock'), value: 'show' },
            { label: t('app.kuaizhizao.warehouseCommon.hideZeroStock'), value: 'hide' },
          ]}
          onChange={(v) => {
            const next = v === 'show';
            includeZeroStockRef.current = next;
            setIncludeZeroStock(next);
            actionRef.current?.reload();
          }}
        />
        <Select
          value={warehouseFilter === 'all' ? 'all' : String(warehouseFilter)}
          style={{ width: 200 }}
          showSearch
          optionFilterProp="label"
          options={warehouseSelectOptions}
          onChange={(v) => {
            const next: 'all' | number = v === 'all' ? 'all' : Number(v);
            warehouseFilterRef.current = next;
            setWarehouseFilter(next);
            actionRef.current?.reload();
          }}
        />
      </Space>
    ),
    [t, includeZeroStock, warehouseFilter, warehouseSelectOptions]
  );

  const columns: ProColumns<InventoryItem>[] = useMemo(
    () =>
      alignProColumns<InventoryItem>(
        [
          {
            title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
            key: 'material_name',
            dataIndex: 'material_name',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, r) => (
              <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
            ),
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
            dataIndex: 'material_code',
            hideInTable: true,
            sorter: true,
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
            dataIndex: 'material_name',
            hideInTable: true,
          },
          {
            title: t('app.master-data.materials.specification'),
            dataIndex: 'material_spec',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => renderCell(r.material_spec),
          },
          {
            title: t('app.master-data.materials.model'),
            dataIndex: 'model',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => renderCell(r.model),
          },
          {
            title: t('app.kuaizhizao.warehouseInventory.colBrand'),
            dataIndex: 'brand',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => renderCell(r.brand),
          },
          {
            title: t('app.kuaizhizao.warehouseInventory.colTexture'),
            dataIndex: 'texture',
            width: 72,
            minWidth: 72,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => renderCell(r.texture),
          },
          {
            title: t('common.unit'),
            dataIndex: 'material_unit',
            width: 56,
            minWidth: 56,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, r) => renderCell(r.material_unit),
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colStockQty'),
            dataIndex: 'quantity',
            width: 110,
            minWidth: 110,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            valueType: 'digit',
            sorter: true,
            render: (_, record) => {
              const qty = Number(record.quantity || 0);
              return (
                <span style={{ color: qty <= 0 ? '#ff4d4f' : undefined }}>
                  <QuantityWithUnitDisplay quantity={qty} unit={record.material_unit} />
                </span>
              );
            },
          },
          {
            title: t('app.kuaizhizao.warehouseInventory.colInTransit'),
            dataIndex: 'in_transit_quantity',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            hideInSearch: true,
            render: (_, record) => renderInTransitCell(record, t),
          },
          {
            title: t('app.kuaizhizao.warehouseInventory.colAlert'),
            dataIndex: 'alert_label',
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            hideInSearch: true,
            render: (_, record) => renderAlertCell(record, t),
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            hideInTable: false,
            hideInSearch: true,
            sorter: true,
            render: (_, record) => renderInventoryStockStatus(record.status),
          },
          {
            title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
            dataIndex: 'warehouse_name',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
            sorter: true,
            render: (_, r) => r.warehouse_name || '-',
          },
        ],
        WAREHOUSE_DOC_LIST_FIELD_RANK,
      ),
    [t],
  );

  const fetchInventory = async (params: any, sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
    const listParams = resolveInventoryMaterialBalanceListParams(searchFormValues, sort);
    const zeroStock = includeZeroStockRef.current;
    const warehouse = warehouseFilterRef.current;
    const baseQuery = {
      ...listParams,
      include_zero_stock: zeroStock,
      warehouse_id: warehouse === 'all' ? undefined : warehouse,
    };
    lastQueryRef.current = baseQuery;
    try {
      const [listRes, summaryRes] = await Promise.all([
        apiRequest<{ items: InventoryItem[]; total: number; current: number; page_size: number }>(
          '/apps/kuaizhizao/reports/inventory/material-balances',
          {
            method: 'GET',
            params: {
              ...baseQuery,
              current: params.current || 1,
              page_size: params.pageSize || 20,
            },
          }
        ),
        apiRequest<{ summary: InventorySummary }>(
          '/apps/kuaizhizao/reports/inventory/material-balances/summary',
          { method: 'GET', params: baseQuery }
        ),
      ]);
      setSummary(summaryRes.summary);
      return {
        data: listRes.items || [],
        total: listRes.total || 0,
        success: true,
      };
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.queryFailed'));
      return { data: [], total: 0, success: false };
    }
  };

  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: InventoryItem[]
  ) => {
    try {
      let rows: InventoryItem[] = [];
      if (type === 'selected') {
        const keySet = new Set((selectedRowKeys || []).map(String));
        rows = (currentPageData || []).filter((r) => keySet.has(String(r.id)));
      } else if (type === 'currentPage') {
        rows = currentPageData || [];
      } else {
        rows = await fetchAllCurrentPageItems<InventoryItem>((page) =>
          apiRequest<{ items: InventoryItem[]; total: number }>(
            '/apps/kuaizhizao/reports/inventory/material-balances',
            { method: 'GET', params: { ...lastQueryRef.current, ...page } },
          ),
        );
      }
      if (!rows.length) {
        messageApi.warning(t('common.exportNoData'));
        return;
      }
      exportRows(rows);
      messageApi.success(t('app.kuaizhizao.warehouseCommon.exportSuccess', { count: rows.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.exportFailed'));
    }
  };

  const statCards: StatCard[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseCommon.statRecords'), value: summary.total_records },
      {
        title: t('app.kuaizhizao.warehouseCommon.statTotalQty'),
        value: summary.total_quantity,
        precision: 2,
      },
      { title: t('app.kuaizhizao.warehouseCommon.statInStock'), value: summary.in_stock_count },
      { title: t('app.kuaizhizao.warehouseCommon.statZeroStock'), value: summary.zero_stock_count },
      { title: t('app.kuaizhizao.warehouseCommon.statNearExpiry'), value: summary.near_expiry_count },
      { title: t('app.kuaizhizao.warehouseCommon.statExpired'), value: summary.expired_count },
    ],
    [summary, t],
  );

  return (
    <ListPageTemplate
      statCards={statCards}
      statCardsPreferenceKey="apps.kuaizhizao.pages.warehouse-management.inventory"
    >
      <UniTable<InventoryItem>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.inventory')}
        headerActions={tableHeaderActions}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory-width-v4"
        actionRef={actionRef}
        columns={columns}
        request={fetchInventory}
        params={{ warehouse_id: warehouseFilter === 'all' ? undefined : warehouseFilter }}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        showExportButton
        onExport={handleExport}
        enableRowSelection
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />
    </ListPageTemplate>
  );
};

export default InventoryPage;
