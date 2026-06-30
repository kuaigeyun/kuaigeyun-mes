import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';

const RESOURCE = 'kuaizhizao:tool-report-repair-analysis';

const ToolRepairAnalysisReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.tool'), dataIndex: 'tool_name', width: 160 },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.faultCategory'), dataIndex: 'fault_category', width: 120 },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.repairCount'), dataIndex: 'repair_count', width: 100 },
      { title: t('app.kuaizhizao.toolOps.report.repairAnalysis.col.avgDuration'), dataIndex: 'avg_duration_hours', width: 110 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await toolReportsApi.repairAnalysis({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-repair-analysis')}
      reportType="tool-repair-analysis"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-repair-analysis"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolRepairAnalysisReport;
