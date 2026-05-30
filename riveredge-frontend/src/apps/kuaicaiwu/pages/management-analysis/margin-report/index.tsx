import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProColumns } from '@ant-design/pro-components';
import { InputNumber, Space } from 'antd';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { managementReportService } from '../../../services/management-report';

type MarginRow = Record<string, unknown>;
type Dimension = 'product' | 'customer' | 'order';

const productColumns: ProColumns<MarginRow>[] = [
  { title: '产品编码', dataIndex: 'product_code', width: 120 },
  { title: '产品名称', dataIndex: 'product_name', ellipsis: true },
  { title: '销售额', dataIndex: 'revenue', valueType: 'money', align: 'right' },
  { title: '成本', dataIndex: 'cost', valueType: 'money', align: 'right' },
  { title: '毛利', dataIndex: 'gross_margin', valueType: 'money', align: 'right' },
  {
    title: '毛利率',
    dataIndex: 'gross_margin_rate',
    align: 'right',
    render: (_, r) => `${((Number(r.gross_margin_rate) || 0) * 100).toFixed(2)}%`,
  },
];

const customerColumns: ProColumns<MarginRow>[] = [
  { title: '客户', dataIndex: 'customer_name', ellipsis: true },
  { title: '销售额', dataIndex: 'revenue', valueType: 'money', align: 'right' },
  { title: '成本', dataIndex: 'cost', valueType: 'money', align: 'right' },
  { title: '毛利', dataIndex: 'gross_margin', valueType: 'money', align: 'right' },
  {
    title: '毛利率',
    dataIndex: 'gross_margin_rate',
    align: 'right',
    render: (_, r) => `${((Number(r.gross_margin_rate) || 0) * 100).toFixed(2)}%`,
  },
];

const orderColumns: ProColumns<MarginRow>[] = [
  { title: '订单号', dataIndex: 'sales_order_code', width: 140 },
  { title: '出库单', dataIndex: 'delivery_code', width: 140 },
  { title: '销售额', dataIndex: 'revenue', valueType: 'money', align: 'right' },
  { title: '成本', dataIndex: 'cost', valueType: 'money', align: 'right' },
  { title: '毛利', dataIndex: 'gross_margin', valueType: 'money', align: 'right' },
  {
    title: '毛利率',
    dataIndex: 'gross_margin_rate',
    align: 'right',
    render: (_, r) => `${((Number(r.gross_margin_rate) || 0) * 100).toFixed(2)}%`,
  },
];

const COLUMNS: Record<Dimension, ProColumns<MarginRow>[]> = {
  product: productColumns,
  customer: customerColumns,
  order: orderColumns,
};

const MarginTable: React.FC<{ dimension: Dimension; days: number }> = ({ dimension, days }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['marginReport', dimension, days],
    queryFn: async () => {
      if (dimension === 'product') return managementReportService.getMarginByProduct(days);
      if (dimension === 'customer') return managementReportService.getMarginByCustomer(days);
      return managementReportService.getMarginByOrder(days);
    },
  });

  const items: MarginRow[] = (data as any)?.items ?? [];

  return (
    <UniTable<MarginRow>
      rowKey={(r, i) => String(r.product_id ?? r.customer_id ?? r.delivery_id ?? i)}
      columnPersistenceId={`apps.kuaicaiwu.pages.management-analysis.margin-report.${dimension}`}
      columns={COLUMNS[dimension]}
      dataSource={items}
      loading={isLoading}
      search={false}
      pagination={{ pageSize: 20 }}
      toolBarRender={false}
    />
  );
};

const MarginReportPage: React.FC = () => {
  const [days, setDays] = useState(30);
  const [dimension, setDimension] = useState<Dimension>('product');

  const tabBarExtraContent = useMemo(
    () => (
      <Space>
        <span>统计天数</span>
        <InputNumber min={7} max={365} value={days} onChange={(v) => setDays(Number(v) || 30)} />
      </Space>
    ),
    [days],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={dimension}
      onTabChange={(key) => setDimension(key as Dimension)}
      tabBarExtraContent={tabBarExtraContent}
      tabs={[
        { key: 'product', label: '按产品', children: <MarginTable dimension="product" days={days} /> },
        { key: 'customer', label: '按客户', children: <MarginTable dimension="customer" days={days} /> },
        { key: 'order', label: '按订单', children: <MarginTable dimension="order" days={days} /> },
      ]}
    />
  );
};

export default MarginReportPage;
