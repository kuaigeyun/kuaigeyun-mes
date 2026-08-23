/**
 * 出库明细表：一行一物料，按出库时间倒序
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildWarehouseMovementDetailColumns } from './inboundDetailColumns';

const OutboundDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildWarehouseMovementDetailColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.outbound-summary')}
      reportType="outbound_summary"
      templateId="queryTable"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.OutboundDetail-v1"
      permissionResource="kuaizhizao:warehouse-management-reports-outbound-summary"
      summaryFields={['quantity']}
    />
  );
};

export default OutboundDetail;
