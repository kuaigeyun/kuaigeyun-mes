import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PlanFulfillmentRate: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.planReports.colPlanCode'), dataIndex: 'plan_code', width: 150 },
      { title: t('app.kuaizhizao.planReports.colProductName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.planReports.colPlannedQty'), dataIndex: 'planned_quantity', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.planReports.colCompletedQty'), dataIndex: 'completed_quantity', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.planReports.colFulfillmentRate'), dataIndex: 'fulfillment_rate', valueType: 'percent', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.PlanFulfillmentRate"
      title={t('app.kuaizhizao.menu.reports.plan-fulfillment-rate')}
      reportType="fulfillment"
      columns={columns}
    />
  );
};

export default PlanFulfillmentRate;
