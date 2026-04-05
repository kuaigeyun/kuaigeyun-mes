import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getEquipmentReport } from '../../../services/reports';

const EquipmentFaultAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: '故障单号',
      dataIndex: 'failure_code',
      width: 150,
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r?.failure_code ?? '') }} ellipsis>
          {r?.failure_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '设备名称', dataIndex: 'equipment_name', width: 150 },
    { title: '故障等级', dataIndex: 'failure_level', width: 100 },
    { title: '开始时间', dataIndex: 'start_time', valueType: 'dateTime', width: 180 },
    { title: '结束时间', dataIndex: 'end_time', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.equipment-fault-analysis')}
      reportType="failure_analysis"
      columns={columns}
      columnPersistenceId="kuaizhizao-em-report-equipment-fault-analysis"
      request={async (params: any) => {
        const res = await getEquipmentReport({
          ...params,
          report_type: 'failure_analysis',
          keyword: params.keyword,
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


export default EquipmentFaultAnalysis;
