import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';

const RESOURCE = 'kuaizhizao:mold-report-repair-analysis';

const MoldRepairAnalysisReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.mold'), dataIndex: 'mold_name', width: 160 },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.faultCategory'), dataIndex: 'fault_category', width: 120 },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.repairCount'), dataIndex: 'repair_count', width: 100 },
      { title: t('app.kuaizhizao.moldOps.report.repairAnalysis.col.avgDuration'), dataIndex: 'avg_duration_hours', width: 110 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await moldReportsApi.repairAnalysis({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-repair-analysis')}
      reportType="mold-repair-analysis"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-repair-analysis"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldRepairAnalysisReport;
