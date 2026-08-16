import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:tool-report-repair-analysis';

const request = createKuaizhizaoCustomReportRequest((query) =>
  toolReportsApi.repairAnalysis(mapLegacyReportDateQuery(query)),
);

const ToolRepairAnalysisReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.tool'), dataIndex: 'tool_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.faultCategory'), dataIndex: 'fault_category', width: 120, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.repairCount'), dataIndex: 'repair_count', width: 100, hideInSearch: true, align: 'right' },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.avgDuration'), dataIndex: 'avg_duration_hours', width: 110, hideInSearch: true, align: 'right' },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-repair-analysis')}
      reportType="tool-repair-analysis"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-repair-analysis-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolRepairAnalysisReport;
