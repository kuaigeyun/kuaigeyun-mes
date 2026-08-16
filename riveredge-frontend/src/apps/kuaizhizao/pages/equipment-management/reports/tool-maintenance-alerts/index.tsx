import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:tool-report-maintenance-alerts';

const request = createKuaizhizaoCustomReportRequest((query) =>
  toolReportsApi.maintenanceAlerts(mapLegacyReportDateQuery(query)),
);

const ToolMaintenanceAlertsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.maintenanceAlerts.col.tool'), dataIndex: 'tool_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.maintenanceAlerts.col.toolCode'), dataIndex: 'tool_code', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.maintenanceAlerts.col.alertType'), dataIndex: 'alert_type', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.maintenanceAlerts.col.dueValue'), dataIndex: 'due_value', width: 100, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.maintenanceAlerts.col.currentValue'), dataIndex: 'current_value', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-maintenance-alerts')}
      reportType="tool-maintenance-alerts"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-maintenance-alerts-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolMaintenanceAlertsReport;
