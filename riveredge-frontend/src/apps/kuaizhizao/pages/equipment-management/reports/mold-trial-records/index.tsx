import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';

const RESOURCE = 'kuaizhizao:mold-report-trial-records';

const MoldTrialRecordsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.trialNo'), dataIndex: 'trial_no', width: 140 },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.mold'), dataIndex: 'mold_name', width: 160 },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.trialDate'), dataIndex: 'trial_date', valueType: 'date', width: 110 },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.supplier'), dataIndex: 'supplier', width: 120 },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.result'), dataIndex: 'result', width: 100 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await moldReportsApi.trialRecords({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-trial-records')}
      reportType="mold-trial-records"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-trial-records"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldTrialRecordsReport;
