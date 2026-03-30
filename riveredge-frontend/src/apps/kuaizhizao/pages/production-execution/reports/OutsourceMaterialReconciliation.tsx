import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const OutsourceMaterialReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '委外单号', dataIndex: 'order_code', width: 150 },
    { title: '发料数量', dataIndex: 'issue_qty', valueType: 'digit', width: 100 },
    { title: '应收数量', dataIndex: 'expect_qty', valueType: 'digit', width: 100 },
    { title: '实收数量', dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
    { title: '差额', dataIndex: 'diff_qty', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.outsource-material-reconciliation')}
      reportType="outsource_recon"
      columns={columns}
    />
  );
};

export default OutsourceMaterialReconciliation;
