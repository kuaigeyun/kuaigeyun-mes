import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Card, Col, Popover, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
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

interface BatchInventoryItem {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec?: string | null;
  brand?: string | null;
  texture?: string | null;
  model?: string | null;
  material_unit?: string | null;
  batch_no: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number;
  in_transit_quantity?: number;
  in_transit_breakdown?: InTransitBreakdown | null;
  alert_status?: string | null;
  alert_level?: string | null;
  alert_label?: string | null;
  alert_message?: string | null;
  supplier_batch_no: string | null;
  status: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
}

function formatQty(val: unknown) {
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

function renderInTransitCell(record: BatchInventoryItem, t: (key: string) => string) {
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

function renderAlertCell(record: BatchInventoryItem, t: (key: string) => string) {
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

const BatchInventoryQuery: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [searchParams] = useSearchParams();
  const [includeExpired, setIncludeExpired] = useState(false);
  const [includeZeroStock, setIncludeZeroStock] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'zero' | 'expired'>('all');
  const [agingBucket, setAgingBucket] = useState<'all' | 'expired' | '0-30' | '31-90' | '90+'>('all');
  const [groupBy, setGroupBy] = useState<'warehouse' | 'material' | 'status' | 'aging_bucket'>('aging_bucket');
  const lastQueryRef = useRef<Record<string, any>>({});
  const actionRef = useRef<any>(null);
  const [summary, setSummary] = useState({
    total_records: 0,
    total_quantity: 0,
    in_stock_count: 0,
    zero_stock_count: 0,
    expired_count: 0,
    near_expiry_count: 0,
  });
  const [groups, setGroups] = useState<Array<{ group_key: string; record_count: number; total_quantity: number }>>([]);

  const escapeCsv = (v: unknown) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const renderCell = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || '—';
  };

  const groupTags = useMemo(() => groups.slice(0, 8), [groups]);

  const tableHeaderActions = useMemo(
    () => (
      <Space wrap>
        <ThemedSegmented
          surfaceBackground
          value={includeExpired ? 'show' : 'hide'}
          options={[
            { label: t('app.kuaizhizao.batchInventoryQuery.showExpiredBatches'), value: 'show' },
            { label: t('app.kuaizhizao.batchInventoryQuery.hideExpiredBatches'), value: 'hide' },
          ]}
          onChange={(v) => {
            setIncludeExpired(v === 'show');
            actionRef.current?.reload();
          }}
        />
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
          style={{ width: 160 }}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.allStatus'), value: 'all' },
            { label: t('app.kuaizhizao.warehouseCommon.inStockOnly'), value: 'in_stock' },
            { label: t('app.kuaizhizao.warehouseCommon.zeroStockOnly'), value: 'zero' },
            { label: t('app.kuaizhizao.warehouseCommon.expiredOnly'), value: 'expired' },
          ]}
          onChange={(v) => {
            setStatusFilter(v);
            actionRef.current?.reload();
          }}
        />
        <Select
          value={agingBucket}
          style={{ width: 160 }}
          options={[
            { label: t('app.kuaizhizao.warehouseCommon.allAging'), value: 'all' },
            { label: t('app.kuaizhizao.warehouseCommon.agingExpired'), value: 'expired' },
            { label: t('app.kuaizhizao.warehouseCommon.aging0_30'), value: '0-30' },
            { label: t('app.kuaizhizao.warehouseCommon.aging31_90'), value: '31-90' },
            { label: t('app.kuaizhizao.warehouseCommon.aging90Plus'), value: '90+' },
          ]}
          onChange={(v) => {
            setAgingBucket(v);
            actionRef.current?.reload();
          }}
        />
        <Select
          value={groupBy}
          style={{ width: 160 }}
          options={[
            { label: t('app.kuaizhizao.batchInventoryQuery.groupByAgingBucket'), value: 'aging_bucket' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByWarehouse'), value: 'warehouse' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByMaterial'), value: 'material' },
            { label: t('app.kuaizhizao.warehouseCommon.groupByStatus'), value: 'status' },
          ]}
          onChange={(v) => {
            setGroupBy(v);
            actionRef.current?.reload();
          }}
        />
      </Space>
    ),
    [t, includeExpired, includeZeroStock, statusFilter, agingBucket, groupBy]
  );

  const columns: ProColumns<BatchInventoryItem>[] = useMemo(
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
        title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'),
        dataIndex: 'batch_no',
        width: 120,
        copyable: true,
      },
      {
        title: t('app.kuaizhizao.batchInventoryQuery.colProductionDate'),
        dataIndex: 'production_date',
        width: 120,
        valueType: 'date',
        render: (_, record) => record.production_date || '-',
      },
      {
        title: t('app.kuaizhizao.batchInventoryQuery.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 120,
        valueType: 'date',
        render: (_, record) => {
          if (!record.expiry_date) return '-';
          const isExpired = dayjs(record.expiry_date).isBefore(dayjs());
          const isNearExpiry = dayjs(record.expiry_date).diff(dayjs(), 'day') <= 30;

          return (
            <Space>
              {record.expiry_date}
              {isExpired && <Tag color="red">{t('app.kuaizhizao.warehouseCommon.tagExpired')}</Tag>}
              {!isExpired && isNearExpiry && <WarningOutlined style={{ color: '#faad14' }} />}
            </Space>
          );
        },
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
        title: t('app.kuaizhizao.batchInventoryQuery.colSupplierBatchNo'),
        dataIndex: 'supplier_batch_no',
        width: 120,
        render: (_, record) => record.supplier_batch_no || '-',
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
        render: (_, record) => record.warehouse_name || '-',
      },
    ],
    [t]
  );

  const fetchBatchInventory = async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
    const search = searchFormValues || {};
    const apiParams = {
      material_id: search.material_id || params.material_id,
      warehouse_id: search.warehouse_id,
      batch_number: search.batch_no,
      include_expired: includeExpired,
      include_zero_stock: !includeZeroStock,
      aging_bucket: agingBucket === 'all' ? undefined : agingBucket,
      status_filter: statusFilter === 'all' ? undefined : statusFilter,
      keyword: (search as any).keyword ?? params.keyword,
    };
    lastQueryRef.current = apiParams;
    try {
      const [listRes, summaryRes] = await Promise.all([
        apiRequest<{ items: BatchInventoryItem[]; total: number }>(
          '/apps/kuaizhizao/reports/inventory/batch-lines',
          {
            method: 'GET',
            params: {
              ...apiParams,
              current: params.current || 1,
              page_size: params.pageSize || 20,
            },
          }
        ),
        apiRequest<{ summary: typeof summary; groups: Array<{ group_key: string; record_count: number; total_quantity: number }> }>(
          '/apps/kuaizhizao/reports/inventory/batch-lines/summary',
          {
            method: 'GET',
            params: { ...apiParams, group_by: groupBy },
          }
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
      return {
        data: [],
        total: 0,
        success: false,
      };
    }
  };

  const handleExport = async (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: BatchInventoryItem[]
  ) => {
    try {
      let items: BatchInventoryItem[] = [];
      if (type === 'selected') {
        const keySet = new Set((selectedRowKeys || []).map(String));
        items = (currentPageData || []).filter((row) => keySet.has(String(row.id)));
      } else if (type === 'currentPage') {
        items = currentPageData || [];
      } else {
        const response = await apiRequest<{ items?: BatchInventoryItem[] }>(
          '/apps/kuaizhizao/reports/inventory/batch-lines',
          {
            method: 'GET',
            params: { ...lastQueryRef.current, current: 1, page_size: 100000 },
          }
        );
        items = response.items ?? (Array.isArray(response) ? response : []);
      }
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.warehouseCommon.exportNoData'));
        return;
      }
      const headers = [
        t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        t('app.kuaizhizao.warehouseReports.colMaterialName'),
        t('app.master-data.materials.specification'),
        t('app.master-data.materials.model'),
        t('app.kuaizhizao.warehouseInventory.colBrand'),
        t('app.kuaizhizao.warehouseInventory.colTexture'),
        t('app.kuaizhizao.warehouseCommon.colUnit'),
        t('app.kuaizhizao.batchInventoryQuery.colBatchNo'),
        t('app.kuaizhizao.batchInventoryQuery.colProductionDate'),
        t('app.kuaizhizao.batchInventoryQuery.colExpiryDate'),
        t('app.kuaizhizao.warehouseReports.colStockQty'),
        t('app.kuaizhizao.warehouseInventory.colInTransit'),
        t('app.kuaizhizao.warehouseInventory.colAlert'),
        t('app.kuaizhizao.batchInventoryQuery.colSupplierBatchNo'),
        t('app.kuaizhizao.warehouseCommon.colStatus'),
        t('app.kuaizhizao.warehouseReports.colWarehouse'),
      ];
      const lines = items.map((r) =>
        [
          r.material_code,
          r.material_name,
          r.material_spec,
          r.model,
          r.brand,
          r.texture,
          r.material_unit,
          r.batch_no,
          r.production_date,
          r.expiry_date,
          r.quantity,
          r.in_transit_quantity ?? 0,
          r.alert_label,
          r.supplier_batch_no,
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
      a.download = `batch-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('app.kuaizhizao.warehouseCommon.exportSuccess', { count: items.length }));
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

      <UniTable<BatchInventoryItem>
        headerActions={tableHeaderActions}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.batch-inventory-query"
        request={fetchBatchInventory}
        showExportButton
        onExport={handleExport}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 2100 }}
        params={{ material_id: searchParams.get('material_id') || undefined }}
      />
    </ListPageTemplate>
  );
};

export default BatchInventoryQuery;
