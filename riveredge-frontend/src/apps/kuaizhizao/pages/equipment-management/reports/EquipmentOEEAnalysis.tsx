import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getEquipmentReport } from '../../../services/reports';

const EquipmentOEEAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '设备编码', dataIndex: 'code', width: 120 },
    { title: '设备名称', dataIndex: 'name', width: 150 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '分类', dataIndex: 'category', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.equipment-oee-analysis')}
      reportType="oee"
      columns={columns}
      request={async (params: any) => {
        const res = await getEquipmentReport({
          ...params,
          report_type: 'oee',
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


export default EquipmentOEEAnalysis;
