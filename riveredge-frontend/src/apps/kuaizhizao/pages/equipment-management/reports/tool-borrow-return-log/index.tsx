import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { toolReportsApi } from '../../../../services/toolOps';
import {
  createKuaizhizaoCustomReportRequest,
  mapLegacyReportDateQuery,
} from '../../../../utils/kuaizhizaoReportCore';

const RESOURCE = 'kuaizhizao:tool-report-borrow-return-log';

const request = createKuaizhizaoCustomReportRequest((query) =>
  toolReportsApi.borrowReturnLog(mapLegacyReportDateQuery(query)),
);

const ToolBorrowReturnLogReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.docNo'), dataIndex: 'doc_no', width: 140, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.docType'), dataIndex: 'doc_type', width: 100, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.tool'), dataIndex: 'tool_name', width: 160, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.docDate'), dataIndex: 'doc_date', valueType: 'date', width: 110, hideInSearch: true },
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.usageCount'), dataIndex: 'usage_count', width: 90, hideInSearch: true, align: 'right' },
      { title: t('app.kuaizhizao.toolOps.report.borrowReturnLog.col.borrower'), dataIndex: 'borrower', width: 100, hideInSearch: true },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.tool-borrow-return-log')}
      reportType="tool-borrow-return-log"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.tool-borrow-return-log-v2"
      permissionResource={RESOURCE}
      request={request}
    />
  );
};

export default ToolBorrowReturnLogReport;
