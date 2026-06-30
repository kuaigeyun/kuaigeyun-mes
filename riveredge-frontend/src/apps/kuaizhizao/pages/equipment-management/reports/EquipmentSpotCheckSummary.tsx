import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentSpotCheckSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentReports.dateRange'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
        dataIndex: 'equipment_code',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 180,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colTotalCount'),
        dataIndex: 'total_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colCompletedCount'),
        dataIndex: 'completed_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colAbnormalityCount'),
        dataIndex: 'abnormality_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colCompletionRate'),
        dataIndex: 'completion_rate',
        width: 110,
        hideInSearch: true,
        render: (_, record) => {
          const rate = Number(record.completion_rate ?? 0);
          return `${(rate * 100).toFixed(1)}%`;
        },
      },
    ],
    [t],
  );

  const statCards = useMemo(
    () => (summary: Record<string, number>) => [
      {
        title: t('app.kuaizhizao.equipmentReports.statTotalCount'),
        value: summary.total_count ?? 0,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.statCompletedCount'),
        value: summary.completed_count ?? 0,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.statAbnormalityCount'),
        value: summary.abnormality_count ?? 0,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.statCompletionRate'),
        value: `${((summary.completion_rate ?? 0) * 100).toFixed(1)}%`,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-spot-check-summary')}
      reportType="spot_check_summary"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentSpotCheckSummary"
      dateRangeKeys={['date_range', 'dateRange']}
      statCards={statCards}
    />
  );
};

export default EquipmentSpotCheckSummary;
