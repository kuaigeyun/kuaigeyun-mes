import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const WIPInventory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '工序', dataIndex: 'process_name', width: 120 },
    { title: '在制数量', dataIndex: 'wip_qty', valueType: 'digit', width: 100 },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.wip-inventory')}
      reportType="wip_inventory"
      columns={columns}
    />
  );
};

export default WIPInventory;
