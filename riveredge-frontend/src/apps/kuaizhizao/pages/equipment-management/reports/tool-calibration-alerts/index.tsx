import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:tool-report-calibration-alerts';

const request = createKuaizhizaoCustomReportRequest((query) =>
  toolReportsApi.calibrationAlerts(mapLegacyReportDateQuery(query)),
);

const ToolCalibrationAlertsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.tool'), dataIndex: 'tool_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.toolCode'), dataIndex: 'tool_code', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.alertType'), dataIndex: 'alert_type', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.dueValue'), dataIndex: 'due_value', width: 100, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.currentValue'), dataIndex: 'current_value', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-calibration-alerts')}
      reportType="tool-calibration-alerts"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-calibration-alerts-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolCalibrationAlertsReport;
