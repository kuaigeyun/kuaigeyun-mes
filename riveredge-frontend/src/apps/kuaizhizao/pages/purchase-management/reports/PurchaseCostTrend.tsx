import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPurchaseReport } from '../../../services/reports';

const PurchaseCostTrend: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '订单编号', dataIndex: 'order_code', width: 150 },
    { title: '订单日期', dataIndex: 'order_date', valueType: 'date', width: 120 },
    { title: '采购总额', dataIndex: 'total_amount', valueType: 'money', width: 150 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-cost-trend')}
      reportType="cost_trend"
      columns={columns}
      request={async (params: any) => {
        const res = await getPurchaseReport({
          ...params,
          report_type: 'cost_trend',
        });
        return {
          data: res.data || [],
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    />
  );
};


export default PurchaseCostTrend;
