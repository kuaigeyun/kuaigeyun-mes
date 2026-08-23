/**
 * 入库明细表：一行一物料，按入库时间倒序
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildWarehouseMovementDetailColumns } from './inboundDetailColumns';

const InboundDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildWarehouseMovementDetailColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.inbound-summary')}
      reportType="inbound_summary"
      templateId="queryTable"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InboundDetail-v1"
      permissionResource="kuaizhizao:warehouse-management-reports-inbound-summary"
      summaryFields={['quantity']}
    />
  );
};

export default InboundDetail;
