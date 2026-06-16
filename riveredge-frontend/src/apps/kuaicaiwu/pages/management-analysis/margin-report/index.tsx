import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ProColumns } from '@ant-design/pro-components';
import { InputNumber, Space } from 'antd';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { managementReportService } from '../../../services/management-report';

type MarginRow = Record<string, unknown>;
type Dimension = 'product' | 'customer' | 'order';

const MarginTable: React.FC<{ dimension: Dimension; days: number }> = ({ dimension, days }) => {
  const { t } = useTranslation();

  const columns: ProColumns<MarginRow>[] = useMemo(() => {
    const marginRateCol: ProColumns<MarginRow> = {
      title: t('app.kuaicaiwu.marginReport.col.grossMarginRate'),
      dataIndex: 'gross_margin_rate',
      align: 'right',
      render: (_, r) => `${((Number(r.gross_margin_rate) || 0) * 100).toFixed(2)}%`,
    };
    const sharedCols: ProColumns<MarginRow>[] = [
      { title: t('app.kuaicaiwu.marginReport.col.revenue'), dataIndex: 'revenue', valueType: 'money', align: 'right' },
      { title: t('app.kuaicaiwu.marginReport.col.cost'), dataIndex: 'cost', valueType: 'money', align: 'right' },
      { title: t('app.kuaicaiwu.marginReport.col.grossMargin'), dataIndex: 'gross_margin', valueType: 'money', align: 'right' },
      marginRateCol,
    ];

    if (dimension === 'product') {
      return [
        { title: t('app.kuaicaiwu.marginReport.col.productCode'), dataIndex: 'product_code', width: 120 },
        { title: t('app.kuaicaiwu.marginReport.col.productName'), dataIndex: 'product_name', ellipsis: true },
        ...sharedCols,
      ];
    }
    if (dimension === 'customer') {
      return [
        { title: t('app.kuaicaiwu.marginReport.col.customer'), dataIndex: 'customer_name', ellipsis: true },
        ...sharedCols,
      ];
    }
    return [
      { title: t('app.kuaicaiwu.marginReport.col.orderNo'), dataIndex: 'sales_order_code', width: 140 },
      { title: t('app.kuaicaiwu.marginReport.col.deliveryNote'), dataIndex: 'delivery_code', width: 140 },
      ...sharedCols,
    ];
  }, [dimension, t]);

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
      columns={columns}
      dataSource={items}
      loading={isLoading}
      search={false}
      pagination={{ pageSize: 20 }}
      toolBarRender={false}
    />
  );
};

const MarginReportPage: React.FC = () => {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [dimension, setDimension] = useState<Dimension>('product');

  const tabBarExtraContent = useMemo(
    () => (
      <Space>
        <span>{t('app.kuaicaiwu.marginReport.statsDays')}</span>
        <InputNumber min={7} max={365} value={days} onChange={(v) => setDays(Number(v) || 30)} />
      </Space>
    ),
    [days, t],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={dimension}
      onTabChange={(key) => setDimension(key as Dimension)}
      tabBarExtraContent={tabBarExtraContent}
      tabs={[
        { key: 'product', label: t('app.kuaicaiwu.marginReport.tab.product'), children: <MarginTable dimension="product" days={days} /> },
        { key: 'customer', label: t('app.kuaicaiwu.marginReport.tab.customer'), children: <MarginTable dimension="customer" days={days} /> },
        { key: 'order', label: t('app.kuaicaiwu.marginReport.tab.order'), children: <MarginTable dimension="order" days={days} /> },
      ]}
    />
  );
};

export default MarginReportPage;
