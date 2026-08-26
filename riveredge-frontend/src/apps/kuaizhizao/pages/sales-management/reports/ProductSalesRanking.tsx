/**
 * 存货销售排行
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { formatQuantity } from '../../../../../utils/format';
import { reportPercent } from '../../../utils/reportPresentation';

const ProductSalesRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.rank'),
        dataIndex: 'rank',
        width: 64,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.productCode'),
        dataIndex: 'product_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.productName'),
        dataIndex: 'product_name',
        ellipsis: true,
        width: 180,
      },
      {
        title: t('app.kuaizhizao.reports.productSpec'),
        dataIndex: 'product_spec',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('common.unit'),
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.category'),
        dataIndex: 'category',
        width: 100,
        hideInSearch: true,
        ellipsis: true,
        render: (value: string) => (value && String(value).trim() ? value : '—'),
      },
      {
        title: t('app.kuaizhizao.reports.salesTotalQuantity'),
        dataIndex: 'total_quantity',
        sorter: true,
        width: 110,
        hideInSearch: true,
        align: 'right',
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.reports.salesTotalAmount'),
        dataIndex: 'total_revenue',
        valueType: 'money',
        sorter: true,
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.avgUnitPrice'),
        dataIndex: 'avg_price',
        valueType: 'money',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.profit'),
        dataIndex: 'profit',
        valueType: 'money',
        sorter: true,
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.amountShare'),
        dataIndex: 'amount_share',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.amount_share),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.ProductSalesRanking-v3"
      title={t('app.kuaizhizao.menu.reports.product-sales-ranking')}
      reportType="product_ranking"
      rowKey="product_id"
      columns={columns}
    />
  );
};

export default ProductSalesRanking;
