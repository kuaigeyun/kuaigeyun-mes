import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getProductionReport } from '../../../services/reports';

const ScrapDefectAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '报废单号', dataIndex: 'scrap_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '报废数量', dataIndex: 'scrap_quantity', valueType: 'digit', width: 100 },
    { title: '报废原因', dataIndex: 'scrap_reason', ellipsis: true },
    { title: '报废时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.scrap-defect-analysis')}
      reportType="scrap_analysis"
      columns={columns}
      request={async (params: any) => {
        const res = await getProductionReport({
          ...params,
          report_type: 'scrap_analysis',
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


export default ScrapDefectAnalysis;
