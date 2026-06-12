import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Card, Col, Row, Segmented, Select, Space, Statistic, Tag } from 'antd';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { apiRequest } from '../../../../../services/api';

interface InventoryItem {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit?: string | null;
  quantity: number;
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

const InventoryPage: React.FC = () => {
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

  const exportRows = (rows: InventoryItem[]) => {
    const headers = ['物料编号', '物料名称', '库存数量', '状态', '仓库'];
    const lines = rows.map((r) =>
      [
        r.material_code,
        r.material_name,
        `${r.quantity}${r.material_unit ? ` ${r.material_unit}` : ''}`,
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

  const columns: ProColumns<InventoryItem>[] = [
    {
      title: '物料',
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <MaterialStackedCell
          material_name={r.material_name}
          material_code={r.material_code}
        />
      ),
    },
    { title: '物料编号', dataIndex: 'material_code', hideInTable: true },
    { title: '物料名称', dataIndex: 'material_name', hideInTable: true },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
      render: (_, record) => {
        const qty = Number(record.quantity || 0);
        const unit = String(record.material_unit || '').trim();
        return (
          <span style={{ color: qty <= 0 ? '#ff4d4f' : undefined }}>
            {qty}
            {unit ? ` ${unit}` : ''}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, record) => {
        let color = 'default';
        if (record.status === '已过期') color = 'red';
        else if (record.status === '无库存') color = 'orange';
        else if (record.status === '在库') color = 'green';
        return <Tag color={color}>{record.status}</Tag>;
      },
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 140, render: (_, r) => r.warehouse_name || '-' },
  ];

  const fetchInventory = async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
    const search = searchFormValues || {};
    const baseQuery = {
      material_id: search.material_id,
      warehouse_id: search.warehouse_id,
      include_zero_stock: includeZeroStock,
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
      messageApi.error(error?.message || '查询失败');
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
        messageApi.warning('暂无数据可导出');
        return;
      }
      exportRows(rows);
      messageApi.success(`已导出 ${rows.length} 条记录`);
    } catch (error: any) {
      messageApi.error(error?.message || '导出失败');
    }
  };

  return (
    <ListPageTemplate>
      <Card size="small" style={{ marginBottom: 12 }} title="分析区">
        <Row gutter={12}>
          <Col span={4}><Statistic title="记录数" value={summary.total_records} /></Col>
          <Col span={4}><Statistic title="库存总量" value={summary.total_quantity} precision={2} /></Col>
          <Col span={4}><Statistic title="在库" value={summary.in_stock_count} /></Col>
          <Col span={4}><Statistic title="无库存" value={summary.zero_stock_count} /></Col>
          <Col span={4}><Statistic title="近效期(30天)" value={summary.near_expiry_count} /></Col>
          <Col span={4}><Statistic title="过期" value={summary.expired_count} /></Col>
        </Row>
        <Space style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {groupTags.map((g) => (
            <Tag key={g.group_key}>
              {g.group_key}: {g.record_count}项 / {Number(g.total_quantity || 0).toFixed(2)}
            </Tag>
          ))}
        </Space>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }} title="筛选区">
        <Space wrap>
          <Segmented
            value={includeZeroStock ? 'show' : 'hide'}
            options={[
              { label: '显示0库存', value: 'show' },
              { label: '隐藏0库存', value: 'hide' },
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
              { label: '全部状态', value: 'all' },
              { label: '仅在库', value: 'in_stock' },
              { label: '仅无库存', value: 'zero' },
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
              { label: '按仓库分组', value: 'warehouse' },
              { label: '按物料分组', value: 'material' },
              { label: '按状态分组', value: 'status' },
              { label: '按库龄分组', value: 'aging_bucket' },
            ]}
            onChange={(v) => {
              setGroupBy(v);
              actionRef.current?.reload();
            }}
          />
        </Space>
      </Card>

      <Card size="small" title="结果区">
        <UniTable<InventoryItem>
          headerTitle="即时库存查询"
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory"
          actionRef={actionRef}
          columns={columns}
          request={fetchInventory}
          showExportButton
          onExport={handleExport}
          rowKey="id"
          search={{ labelWidth: 'auto' }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          scroll={{ x: 760 }}
        />
      </Card>
    </ListPageTemplate>
  );
};

export default InventoryPage;
