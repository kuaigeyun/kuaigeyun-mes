import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';

const RESOURCE = 'kuaizhizao:mold-report-maintenance-alerts';

const MoldMaintenanceAlertsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.mold'), dataIndex: 'mold_name', width: 160 },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.moldCode'), dataIndex: 'mold_code', width: 120 },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.alertType'), dataIndex: 'alert_type', width: 120 },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.dueValue'), dataIndex: 'due_value', width: 100 },
      { title: t('app.kuaizhizao.moldOps.report.maintenanceAlerts.col.currentValue'), dataIndex: 'current_value', width: 100 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await moldReportsApi.maintenanceAlerts({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-maintenance-alerts')}
      reportType="mold-maintenance-alerts"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-maintenance-alerts"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldMaintenanceAlertsReport;
