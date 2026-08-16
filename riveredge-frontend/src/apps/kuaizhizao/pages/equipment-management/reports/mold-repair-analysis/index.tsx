import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:mold-report-repair-analysis';

const request = createKuaizhizaoCustomReportRequest((query) =>
  moldReportsApi.repairAnalysis(mapLegacyReportDateQuery(query)),
);

const MoldRepairAnalysisReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.mold'), dataIndex: 'mold_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.faultCategory'), dataIndex: 'fault_category', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.repairCount'), dataIndex: 'repair_count', width: 100, hideInSearch: true, align: 'right' },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.avgDuration'), dataIndex: 'avg_duration_hours', width: 110, hideInSearch: true, align: 'right' },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-repair-analysis')}
      reportType="mold-repair-analysis"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-repair-analysis-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldRepairAnalysisReport;
