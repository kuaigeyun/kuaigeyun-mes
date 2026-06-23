/**
 * 存货销售汇总表（按产品汇总已出库数量与金额）
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const MaterialSalesSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.statPeriod'),
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as ProColumns['search'],
    },
    copyableCodeColumn(t('app.kuaizhizao.reports.materialCode'), 'material_code', 120),
    {
      title: t('app.kuaizhizao.reports.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: t('app.kuaizhizao.reports.materialSpec'),
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 140,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.totalQuantity'),
      dataIndex: 'total_quantity',
      valueType: 'digit',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.totalAmount'),
      dataIndex: 'total_amount',
      valueType: 'money',
      width: 130,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.avgPrice'),
      dataIndex: 'avg_price',
      valueType: 'money',
      width: 110,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.unit'),
      dataIndex: 'unit',
      width: 80,
      hideInSearch: true,
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.material-sales-summary')}
      reportType="material-sales-summary"
      summaryFields={['total_quantity', 'total_amount']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.MaterialSalesSummary"
      rowKey="material_code"
      columns={columns}
    />
  );
};

export default MaterialSalesSummary;
