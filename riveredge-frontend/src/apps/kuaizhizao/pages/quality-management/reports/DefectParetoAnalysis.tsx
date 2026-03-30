import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getQualityReport } from '../../../services/reports';

const DefectParetoAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '缺陷单号', dataIndex: 'defect_code', width: 150 },
    { title: '产品名称', dataIndex: 'material_name', width: 200 },
    { title: '缺陷类型', dataIndex: 'defect_type', width: 150 },
    { title: '缺陷数量', dataIndex: 'defect_quantity', valueType: 'digit', width: 100 },
    { title: '记录时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.defect-pareto-analysis')}
      reportType="analysis"
      columns={columns}
      request={async (params: any) => {
        const res = await getQualityReport({
          ...params,
          report_type: 'analysis',
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


export default DefectParetoAnalysis;
