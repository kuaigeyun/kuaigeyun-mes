/**
 * 生产延期预警
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const ProductionDelayWarning: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.dateRange', '计划完工日期'),
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as ProColumns['search'],
    },
    copyableCodeColumn(t('app.kuaizhizao.reports.workOrderCode', '工单单号'), 'code', 150),
    {
      title: t('app.kuaizhizao.reports.productName', '产品名称'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 200,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.plannedEndDate', '计划完工'),
      dataIndex: 'planned_end_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.overdueDays', '逾期天数'),
      dataIndex: 'overdue_days',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.status', '状态'),
      dataIndex: 'status',
      width: 100,
      hideInSearch: true,
      render: (_, record) => {
        const overdue = Number(record.overdue_days || 0);
        if (overdue > 0) {
          return <Tag color="error">{t('app.kuaizhizao.reports.overdue', '已逾期')}</Tag>;
        }
        return <Tag>{String(record.status ?? '')}</Tag>;
      },
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.production-delay-warning', '生产延期预警')}
      reportType="production-delay-warning"
      dateRangeKeys={['date_range', 'dateRange']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ProductionDelayWarning"
      columns={columns}
    />
  );
};

export default ProductionDelayWarning;
