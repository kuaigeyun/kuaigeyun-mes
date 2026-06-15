import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderMaterialUsage: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'order_code', width: 150 },
    { title: '子物料', dataIndex: 'material_name', width: 200 },
    { title: '应领数量', dataIndex: 'planned_qty', valueType: 'digit', width: 100 },
    { title: '实领数量', dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
    { title: '超领数量', dataIndex: 'excess_qty', valueType: 'digit', width: 100 },
  ];

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderMaterialUsage"
      title={t('app.kuaizhizao.menu.reports.work-order-material-usage')}
      reportType="wo_material_usage"
      columns={columns}
    />
  );
};

export default WorkOrderMaterialUsage;
