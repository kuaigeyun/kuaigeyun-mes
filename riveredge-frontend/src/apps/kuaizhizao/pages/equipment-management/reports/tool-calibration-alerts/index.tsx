import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';

const RESOURCE = 'kuaizhizao:tool-report-calibration-alerts';

const ToolCalibrationAlertsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.tool'), dataIndex: 'tool_name', width: 160 },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.toolCode'), dataIndex: 'tool_code', width: 120 },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.alertType'), dataIndex: 'alert_type', width: 120 },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.dueValue'), dataIndex: 'due_value', width: 100 },
      { title: t('app.kuaizhizao.toolOps.report.calibrationAlerts.col.currentValue'), dataIndex: 'current_value', width: 100 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await toolReportsApi.calibrationAlerts({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-calibration-alerts')}
      reportType="tool-calibration-alerts"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-calibration-alerts"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolCalibrationAlertsReport;
