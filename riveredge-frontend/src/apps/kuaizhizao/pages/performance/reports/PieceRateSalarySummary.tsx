import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PieceRateSalarySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '员工', dataIndex: 'employee_name', width: 120 },
    { title: '周期', dataIndex: 'period', width: 100 },
    { title: '总工时', dataIndex: 'total_hours', valueType: 'digit', width: 90, align: 'right' },
    { title: '总件数', dataIndex: 'total_pieces', valueType: 'digit', width: 90, align: 'right' },
    { title: '计时金额', dataIndex: 'time_amount', valueType: 'money', width: 110, align: 'right' },
    { title: '计件金额', dataIndex: 'piece_amount', valueType: 'money', width: 110, align: 'right' },
    { title: 'KPI系数', dataIndex: 'kpi_coefficient', width: 90, align: 'right' },
    { title: '应发总额', dataIndex: 'total_amount', valueType: 'money', width: 120, align: 'right' },
    { title: '状态', dataIndex: 'status', width: 90 },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.piece-rate-salary-summary')}
      reportType="piece-rate-salary-summary"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.PieceRateSalarySummary"
      columns={columns}
    />
  );
};

export default PieceRateSalarySummary;
