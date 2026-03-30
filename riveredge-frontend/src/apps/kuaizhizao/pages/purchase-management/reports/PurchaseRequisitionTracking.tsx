import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPurchaseReport } from '../../../services/reports';

const PurchaseRequisitionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '申购单号', dataIndex: 'requisition_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '申购数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '已订数量', dataIndex: 'ordered_quantity', valueType: 'digit', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-requisition-tracking')}
      reportType="requisition_tracking"
      columns={columns}
      request={async (params: any) => {
        const res = await getPurchaseReport({
          ...params,
          report_type: 'requisition_tracking',
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


export default PurchaseRequisitionTracking;
