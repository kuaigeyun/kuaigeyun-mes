import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const MaterialShortageAlert: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '仓库名称', dataIndex: 'warehouse_name', width: 150 },
    { title: '当前库存', dataIndex: 'current_quantity', valueType: 'digit', width: 100 },
    { title: '最小库存', dataIndex: 'min_quantity', valueType: 'digit', width: 100 },
    { title: '预警时间', dataIndex: 'alert_time', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.material-shortage-alert')}
      reportType="material_shortage"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'material_shortage',
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


export default MaterialShortageAlert;
