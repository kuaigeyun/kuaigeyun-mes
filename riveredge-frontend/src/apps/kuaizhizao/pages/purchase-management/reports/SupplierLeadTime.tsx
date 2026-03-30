import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPurchaseReport } from '../../../services/reports';

const SupplierLeadTime: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '入库单号', dataIndex: 'receipt_code', width: 150 },
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '计划日期', dataIndex: 'planned_receipt_date', valueType: 'date', width: 120 },
    { title: '实际日期', dataIndex: 'actual_receipt_date', valueType: 'date', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.supplier-lead-time')}
      reportType="supplier_performance"
      columns={columns}
      request={async (params: any) => {
        const res = await getPurchaseReport({
          ...params,
          report_type: 'supplier_performance',
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


export default SupplierLeadTime;
