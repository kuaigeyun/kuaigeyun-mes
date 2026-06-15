import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EmployeeEfficiencyRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '员工', dataIndex: 'worker_name', width: 140 },
    { title: '合格产量', dataIndex: 'total_qty', valueType: 'digit', width: 120, align: 'right' },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.employee-efficiency-ranking')}
      reportType="employee-efficiency-ranking"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.EmployeeEfficiencyRanking"
      columns={columns}
    />
  );
};

export default EmployeeEfficiencyRanking;
