import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:mold-report-trial-records';

const request = createKuaizhizaoCustomReportRequest((query) =>
  moldReportsApi.trialRecords(mapLegacyReportDateQuery(query)),
);

const MoldTrialRecordsReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.trialNo'), dataIndex: 'trial_no', width: 140, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.mold'), dataIndex: 'mold_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.trialDate'), dataIndex: 'trial_date', valueType: 'date', width: 110, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.supplier'), dataIndex: 'supplier', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.trialRecords.col.result'), dataIndex: 'result', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-trial-records')}
      reportType="mold-trial-records"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-trial-records-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldTrialRecordsReport;
