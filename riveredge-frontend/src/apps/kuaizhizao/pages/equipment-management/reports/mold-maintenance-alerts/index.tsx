import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:mold-report-maintenance-alerts';

const request = createKuaizhizaoCustomReportRequest((query) =>
  moldReportsApi.maintenanceAlerts(mapLegacyReportDateQuery(query)),
);

const MoldMaintenanceAlertsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.mold'), dataIndex: 'mold_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.moldCode'), dataIndex: 'mold_code', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.alertType'), dataIndex: 'alert_type', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.dueValue'), dataIndex: 'due_value', width: 100, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.currentValue'), dataIndex: 'current_value', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-maintenance-alerts')}
      reportType="mold-maintenance-alerts"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-maintenance-alerts-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldMaintenanceAlertsReport;
