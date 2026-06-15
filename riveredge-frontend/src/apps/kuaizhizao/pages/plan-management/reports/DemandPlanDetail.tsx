import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const DemandPlanDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.planReports.colDemandSource'), dataIndex: 'source', width: 120 },
      { title: t('app.kuaizhizao.planReports.colSourceCode'), dataIndex: 'source_code', width: 150 },
      { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.planReports.colRequirementDate'), dataIndex: 'requirement_date', valueType: 'date', width: 120 },
      { title: t('app.kuaizhizao.planReports.colRequirementQty'), dataIndex: 'quantity', valueType: 'digit', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.DemandPlanDetail"
      title={t('app.kuaizhizao.menu.reports.demand-plan-detail')}
      reportType="demand_detail"
      columns={columns}
    />
  );
};

export default DemandPlanDetail;
