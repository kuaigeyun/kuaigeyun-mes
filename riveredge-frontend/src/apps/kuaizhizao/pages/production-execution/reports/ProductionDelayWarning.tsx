/**
 * 生产延期预警
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { Tag } from 'antd';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const ProductionDelayWarning: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.plannedEndDateRange'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as ProColumns['search'],
      },
      copyableCodeColumn(
        t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        'code',
        150,
      ),
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 200,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedEndDate'),
        dataIndex: 'planned_end_date',
        valueType: 'date',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOverdueDays'),
        dataIndex: 'overdue_days',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        hideInSearch: true,
        render: (_, record) => {
          const overdue = Number(record.overdue_days || 0);
          if (overdue > 0) {
            return <Tag color="error">{t('app.kuaizhizao.reports.overdueYes')}</Tag>;
          }
          return <Tag>{String(record.status ?? '')}</Tag>;
        },
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.production-delay-warning')}
      reportType="production-delay-warning"
      dateRangeKeys={['date_range', 'dateRange']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ProductionDelayWarning"
      columns={columns}
    />
  );
};

export default ProductionDelayWarning;
