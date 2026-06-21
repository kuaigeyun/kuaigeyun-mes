import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Card, Col, Popover, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { apiRequest } from '../../../../../services/api';

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

interface GroupItem {
  group_key: string;
  record_count: number;
  total_quantity: number;
}

function formatQty(val: unknown): string {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
            {row.label}: <strong>{formatQty(row.value)}</strong>
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
  if (!hasDetail) return formatQty(total);
  return (
    <Popover content={<InTransitPopoverContent breakdown={breakdown} t={t} />} trigger="hover">
      <span style={{ cursor: 'help', borderBottom: '1px dashed var(--ant-color-text-secondary)' }}>
        {formatQty(total)}
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

  const tag = <Tag color={color}>{label}</Tag>;
  if (record.alert_message && status !== 'normal') {
    return (
      <Popover content={<Typography.Text style={{ fontSize: 12 }}>{record.alert_message}</Typography.Text>}>
        <span style={{ cursor: 'help' }}>{tag}</span>
      </Popover>
    );
  }
  return tag;
}

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<any>(null);
  const lastQueryRef = useRef<Record<string, any>>({});

  const [includeZeroStock, setIncludeZeroStock] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'zero'>('all');
  const [groupBy, setGroupBy] = useState<'warehouse' | 'material' | 'status' | 'aging_bucket'>('warehouse');
  const [summary, setSummary] = useState<InventorySummary>({
    total_records: 0,
    total_quantity: 0,
    in_stock_count: 0,
    zero_stock_count: 0,
    expired_count: 0,
    near_expiry_count: 0,
  });
  const [groups, setGroups] = useState<GroupItem[]>([]);

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
      t('app.kuaizhizao.warehouseCommon.colUnit'),
      t('app.kuaizhizao.warehouseReports.colStockQty'),
      t('app.kuaizhizao.warehouseInventory.colInTransit'),
      t('app.kuaizhizao.warehouseInventory.colAlert'),
      t('app.kuaizhizao.warehouseCommon.colStatus'),
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
    a.download = `inventory-realtime-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupTags = useMemo(() => groups.slice(0, 8), [groups]);

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
            setIncludeZeroStock(v === 'show');
            actionRef.current?.reload();
          }}
        />
        <Select
          value={statusFilter}
          style={{ width: 140 }}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.allStatus'), value: 'all' },
            { label: t('app.kuaizhizao.warehouseCommon.inStockOnly'), value: 'in_stock' },
            { label: t('app.kuaizhizao.warehouseCommon.zeroStockOnly'), value: 'zero' },
          ]}
          onChange={(v) => {
            setStatusFilter(v);
            actionRef.current?.reload();
          }}
        />
        <Select
          value={groupBy}
          style={{ width: 150 }}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.groupByWarehouse'), value: 'warehouse' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByMaterial'), value: 'material' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByStatus'), value: 'status' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByAging'), value: 'aging_bucket' },
          ]}
          onChange={(v) => {
            setGroupBy(v);
            actionRef.current?.reload();
          }}
        />
      </Space>
    ),
    [t, includeZeroStock, statusFilter, groupBy]
  );

  const columns: ProColumns<InventoryItem>[] = useMemo(
    () => [
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
      { title: t('app.kuaizhizao.warehouseReports.colMaterialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', hideInTable: true },
      {
        title: t('app.master-data.materials.specification'),
        dataIndex: 'material_spec',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => renderCell(r.material_spec),
      },
      {
        title: t('app.master-data.materials.model'),
        dataIndex: 'model',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => renderCell(r.model),
      },
      {
        title: t('app.kuaizhizao.warehouseInventory.colBrand'),
        dataIndex: 'brand',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => renderCell(r.brand),
      },
      {
        title: t('app.kuaizhizao.warehouseInventory.colTexture'),
        dataIndex: 'texture',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => renderCell(r.texture),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colUnit'),
        dataIndex: 'material_unit',
        width: 72,
        hideInSearch: true,
        render: (_, r) => renderCell(r.material_unit),
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colStockQty'),
        dataIndex: 'quantity',
        width: 100,
        align: 'right',
        valueType: 'digit',
        render: (_, record) => {
          const qty = Number(record.quantity || 0);
          return (
            <span style={{ color: qty <= 0 ? '#ff4d4f' : undefined }}>{formatQty(qty)}</span>
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseInventory.colInTransit'),
        dataIndex: 'in_transit_quantity',
        width: 100,
        align: 'right',
        hideInSearch: true,
        render: (_, record) => renderInTransitCell(record, t),
      },
      {
        title: t('app.kuaizhizao.warehouseInventory.colAlert'),
        dataIndex: 'alert_label',
        width: 96,
        align: 'center',
        hideInSearch: true,
        render: (_, record) => renderAlertCell(record, t),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colStatus'),
        dataIndex: 'status',
        width: 100,
        render: (_, record) => {
          let color = 'default';
          if (record.status === '已过期') color = 'red';
          else if (record.status === '无库存') color = 'orange';
          else if (record.status === '在库') color = 'green';
          return <Tag color={color}>{record.status}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 120,
        render: (_, r) => r.warehouse_name || '-',
      },
    ],
    [t]
  );

  const fetchInventory = async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
    const search = searchFormValues || {};
    const baseQuery = {
      material_id: search.material_id,
      warehouse_id: search.warehouse_id,
      include_zero_stock: !includeZeroStock,
      status_filter: statusFilter === 'all' ? undefined : statusFilter,
      keyword: (search as any).keyword ?? params.keyword,
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
        apiRequest<{ summary: InventorySummary; groups: GroupItem[] }>(
          '/apps/kuaizhizao/reports/inventory/material-balances/summary',
          { method: 'GET', params: { ...baseQuery, group_by: groupBy } }
        ),
      ]);
      setSummary(summaryRes.summary);
      setGroups(summaryRes.groups || []);
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
        const allRes = await apiRequest<{ items: InventoryItem[] }>(
          '/apps/kuaizhizao/reports/inventory/material-balances',
          { method: 'GET', params: { ...lastQueryRef.current, current: 1, page_size: 100000 } }
        );
        rows = allRes.items || [];
      }
      if (!rows.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseCommon.exportNoData'));
        return;
      }
      exportRows(rows);
      messageApi.success(t('app.kuaizhizao.warehouseCommon.exportSuccess', { count: rows.length }));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.exportFailed'));
    }
  };

  return (
    <ListPageTemplate>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12}>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statRecords')} value={summary.total_records} /></Col>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statTotalQty')} value={summary.total_quantity} precision={2} /></Col>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statInStock')} value={summary.in_stock_count} /></Col>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statZeroStock')} value={summary.zero_stock_count} /></Col>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statNearExpiry')} value={summary.near_expiry_count} /></Col>
          <Col span={4}><Statistic title={t('app.kuaizhizao.warehouseCommon.statExpired')} value={summary.expired_count} /></Col>
        </Row>
        <Space style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {groupTags.map((g) => (
            <Tag key={g.group_key}>
              {t('app.kuaizhizao.warehouseCommon.groupTag', {
                key: g.group_key,
                count: g.record_count,
                qty: Number(g.total_quantity || 0).toFixed(2),
              })}
            </Tag>
          ))}
        </Space>
      </Card>

      <UniTable<InventoryItem>
        headerActions={tableHeaderActions}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory"
        actionRef={actionRef}
        columns={columns}
        request={fetchInventory}
        showExportButton
        onExport={handleExport}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1560 }}
      />
    </ListPageTemplate>
  );
};

export default InventoryPage;
