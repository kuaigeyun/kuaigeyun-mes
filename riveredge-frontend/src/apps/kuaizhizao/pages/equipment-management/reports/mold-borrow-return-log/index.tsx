import React, { useCallback, useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';

const RESOURCE = 'kuaizhizao:mold-report-borrow-return-log';

const MoldBorrowReturnLogReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docNo'), dataIndex: 'doc_no', width: 140 },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docType'), dataIndex: 'doc_type', width: 100 },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.mold'), dataIndex: 'mold_name', width: 160 },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docDate'), dataIndex: 'doc_date', valueType: 'date', width: 110 },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.usageCount'), dataIndex: 'usage_count', width: 90 },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.borrower'), dataIndex: 'borrower', width: 100 },
    ],
    [t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const res = await moldReportsApi.borrowReturnLog({
      skip: (((params.current as number) ?? 1) - 1) * ((params.pageSize as number) ?? 20),
      limit: params.pageSize ?? 20,
    });
    return { data: res.items ?? [], total: res.total ?? 0, success: true };
  }, []);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-borrow-return-log')}
      reportType="mold-borrow-return-log"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-borrow-return-log"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldBorrowReturnLogReport;
