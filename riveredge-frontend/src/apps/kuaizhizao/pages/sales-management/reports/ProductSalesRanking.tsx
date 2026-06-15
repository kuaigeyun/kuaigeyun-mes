/**
 * 产品销售排行榜报表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const ProductSalesRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.productDeliveryDateRange'),
        dataIndex: 'delivery_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as any,
      },
      {
        title: t('app.kuaizhizao.reports.rank'),
        dataIndex: 'rank',
        valueType: 'indexBorder',
        width: 60,
        fixed: 'left',
      },
      {
        title: t('app.kuaizhizao.reports.productName'),
        dataIndex: 'product_name',
        ellipsis: true,
        fixed: 'left',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.reports.productCode'),
        dataIndex: 'product_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.productSpec'),
        dataIndex: 'product_spec',
        ellipsis: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.salesTotalQuantity'),
        dataIndex: 'total_quantity',
        valueType: 'digit',
        sorter: true,
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.salesTotalAmount'),
        dataIndex: 'total_revenue',
        valueType: 'money',
        sorter: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.profit'),
        dataIndex: 'profit',
        valueType: 'money',
        sorter: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.unit'),
        dataIndex: 'unit',
        width: 80,
      },
      {
        title: t('app.kuaizhizao.reports.category'),
        dataIndex: 'category',
        width: 120,
        render: (text) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: t('app.kuaizhizao.reports.avgUnitPrice'),
        dataIndex: 'avg_price',
        valueType: 'money',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.ProductSalesRanking"
      title={t('app.kuaizhizao.menu.reports.product-sales-ranking')}
      reportType="product_ranking"
      columns={columns}
      dateRangeKeys={['delivery_date_range', 'date_range', 'dateRange']}
    />
  );
};

export default ProductSalesRanking;
