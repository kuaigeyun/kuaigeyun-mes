import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const MaterialShortageAlert: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.planReports.colWarehouseName'), dataIndex: 'warehouse_name', width: 150 },
      { title: t('app.kuaizhizao.planReports.colCurrentStock'), dataIndex: 'current_quantity', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.planReports.colMinStock'), dataIndex: 'threshold_value', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.planReports.colAlertTime'), dataIndex: 'triggered_at', valueType: 'dateTime', width: 180 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.MaterialShortageAlert"
      title={t('app.kuaizhizao.menu.reports.material-shortage-alert')}
      reportType="material_shortage"
      columns={columns}
    />
  );
};

export default MaterialShortageAlert;
