/**
 * 物料短缺预警
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  inventoryAlertLevelEnum,
  inventoryAlertStatusEnum,
  reportInventoryAlertLevelText,
  reportInventoryAlertStatusText,
} from '../../../utils/reportPresentation';

const MaterialShortageAlert: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.materialCode'),
        dataIndex: 'material_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 160,
      },
      {
        title: t('app.kuaizhizao.reports.warehouse'),
        dataIndex: 'warehouse_name',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.planReports.colCurrentStock'),
        dataIndex: 'current_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.planReports.colMinStock'),
        dataIndex: 'threshold_value',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.shortageQuantity'),
        dataIndex: 'shortage_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.alertLevel'),
        dataIndex: 'alert_level',
        width: 90,
        hideInSearch: true,
        valueEnum: inventoryAlertLevelEnum(t),
        render: (_, record) => reportInventoryAlertLevelText(t, record.alert_level),
      },
      {
        title: t('app.kuaizhizao.reports.alertStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: inventoryAlertStatusEnum(t),
        render: (_, record) => reportInventoryAlertStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.planReports.colAlertTime'),
        dataIndex: 'triggered_at',
        valueType: 'dateTime',
        width: 170,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.material-shortage-alert')}
      reportType="material_shortage"
      summaryFields={['current_quantity', 'threshold_value', 'shortage_quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.MaterialShortageAlert-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default MaterialShortageAlert;
