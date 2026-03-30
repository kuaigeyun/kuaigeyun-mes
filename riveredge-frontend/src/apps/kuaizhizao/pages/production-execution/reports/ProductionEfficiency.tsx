import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getProductionReport } from '../../../services/reports';

const ProductionEfficiency: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'code', width: 150 },
    { title: '产品名称', dataIndex: 'material_name', width: 200 },
    { title: '计划数量', dataIndex: 'planned_quantity', valueType: 'digit', width: 100 },
    { title: '实际数量', dataIndex: 'actual_quantity', valueType: 'digit', width: 100 },
    { title: '完工日期', dataIndex: 'actual_end_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.production-efficiency')}
      reportType="efficiency"
      columns={columns}
      request={async (params: any) => {
        const res = await getProductionReport({
          ...params,
          report_type: 'efficiency',
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


export default ProductionEfficiency;
