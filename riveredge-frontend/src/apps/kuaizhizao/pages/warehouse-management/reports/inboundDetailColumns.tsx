import type { ProColumns } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';

export function buildWarehouseMovementDetailColumns(t: TFunction): ProColumns[] {
  return [
    {
      title: t('app.kuaizhizao.warehouseReports.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: t('app.kuaizhizao.warehouseReports.keywordPlaceholder'),
      },
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colEventDate'),
      dataIndex: 'event_at',
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colOrderCode'),
      dataIndex: 'order_code',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colType'),
      dataIndex: 'doc_type',
      width: 110,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
      dataIndex: 'material_code',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 160,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.materialSpec'),
      dataIndex: 'material_spec',
      ellipsis: true,
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('common.unit'),
      dataIndex: 'material_unit',
      width: 80,
      minWidth: 80,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
      dataIndex: 'batch_number',
      width: 110,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
      dataIndex: 'warehouse_name',
      ellipsis: true,
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colOperator'),
      dataIndex: 'operator',
      width: 100,
      hideInSearch: true,
    },
  ];
}
