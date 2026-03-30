import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const PurchasePlanComparison: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '申购单号', dataIndex: 'requisition_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '需求日期', dataIndex: 'requirement_date', valueType: 'date', width: 120 },
    { title: '数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-plan-comparison')}
      reportType="purchase_comparison"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'purchase_comparison',
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


export default PurchasePlanComparison;
