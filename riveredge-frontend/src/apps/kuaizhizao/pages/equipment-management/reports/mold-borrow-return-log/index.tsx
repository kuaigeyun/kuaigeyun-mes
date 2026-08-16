import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { moldReportsApi } from '../../../../services/moldOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:mold-report-borrow-return-log';

const request = createKuaizhizaoCustomReportRequest((query) =>
  moldReportsApi.borrowReturnLog(mapLegacyReportDateQuery(query)),
);

const MoldBorrowReturnLogReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docNo'), dataIndex: 'doc_no', width: 140, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docType'), dataIndex: 'doc_type', width: 100, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.mold'), dataIndex: 'mold_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.docDate'), dataIndex: 'doc_date', valueType: 'date', width: 110, hideInSearch: true },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.usageCount'), dataIndex: 'usage_count', width: 90, hideInSearch: true, align: 'right' },
      { title: t('app.kuaizhizao.moldOps.report.borrowReturnLog.col.borrower'), dataIndex: 'borrower', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.mold-borrow-return-log')}
      reportType="mold-borrow-return-log"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.mold-borrow-return-log-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default MoldBorrowReturnLogReport;
