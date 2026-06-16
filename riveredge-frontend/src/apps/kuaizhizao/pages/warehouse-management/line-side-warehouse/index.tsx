/**
 * 线边仓管理页面
 *
 * 查看线边仓列表及线边仓库存，支持从主仓库调拨物料至线边仓。
 */

import React, { useMemo, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { App, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { warehouseApi } from '../../../services/production';
import { UniTable } from '../../../../../components/uni-table';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getLineSideInventoryLifecycle } from '../../../utils/lineSideInventoryLifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';

interface LineSideWarehouse {
  id: number;
  code: string;
  name: string;
  workshop_id: number | null;
  workshop_name: string | null;
  work_center_id: number | null;
  work_center_name: string | null;
}

interface LineSideInventoryItem {
  id: number;
  warehouse_id: number;
  warehouse_name: string | null;
  material_id: number;
  material_code: string;
  material_name: string;
  material_spec: string | null;
  material_unit: string | null;
  batch_no: string | null;
  quantity: number;
  reserved_quantity: number;
  work_order_code: string | null;
  status: string;
}

const LineSideWarehousePage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<any>(null);
  const [warehouses, setWarehouses] = useState<LineSideWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | undefined>();

  React.useEffect(() => {
    warehouseApi.lineSideWarehouse.listWarehouses().then((res: any) => {
      setWarehouses(Array.isArray(res) ? res : []);
    }).catch(() => {
      message.error(t('app.kuaizhizao.lineSideWarehouse.loadWarehousesFailed'));
    });
  }, [message, t]);

  const columns: ProColumns<LineSideInventoryItem>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.lineSideWarehouse.colLineSideWarehouse'),
        dataIndex: 'warehouse_name',
        width: 140,
        render: (_, record) => record.warehouse_name || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
        key: 'material_name',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      { title: t('app.kuaizhizao.warehouseReports.colMaterialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.lineSideWarehouse.colSpec'),
        dataIndex: 'material_spec',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.batchInventoryQuery.colBatchNo'),
        dataIndex: 'batch_no',
        width: 100,
        render: (_, record) => record.batch_no || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colStockQty'),
        dataIndex: 'quantity',
        width: 100,
        valueType: 'digit',
        render: (_, record) => (
          <span style={{ color: record.quantity <= 0 ? '#ff4d4f' : 'inherit' }}>
            {record.quantity} {record.material_unit || ''}
          </span>
        ),
      },
      {
        title: t('app.kuaizhizao.lineSideWarehouse.colReservedQty'),
        dataIndex: 'reserved_quantity',
        width: 100,
        render: (_, record) => `${record.reserved_quantity} ${record.material_unit || ''}`,
      },
      {
        title: t('app.kuaizhizao.lineSideWarehouse.colAvailableQty'),
        width: 100,
        render: (_, record) => {
          const avail = Number(record.quantity) - Number(record.reserved_quantity);
          return (
            <span style={{ color: avail <= 0 ? '#ff4d4f' : '#52c41a' }}>
              {avail} {record.material_unit || ''}
            </span>
          );
        },
      },
      {
        title: t('app.kuaizhizao.lineSideWarehouse.colReservedWorkOrder'),
        dataIndex: 'work_order_code',
        width: 120,
        render: (_, record) => record.work_order_code || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getLineSideInventoryLifecycle(record as unknown as Record<string, unknown>);
          return (
            <UniLifecycle
              percent={lifecycle.percent}
              stageName={lifecycle.stageName}
              status={lifecycle.status}
              subStages={lifecycle.subStages}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
    ],
    [t]
  );

  const fetchInventory = async (params: any) => {
    try {
      const res = await warehouseApi.lineSideWarehouse.listInventory({
        warehouse_id: selectedWarehouseId || params?.warehouse_id,
        material_code: params?.material_code,
        material_name: params?.material_name,
        skip: ((params?.current || 1) - 1) * (params?.pageSize || 20),
        limit: params?.pageSize || 20,
      });
      return {
        data: res?.items || [],
        total: res?.total || 0,
        success: true,
      };
    } catch {
      message.error(t('app.kuaizhizao.warehouseCommon.queryFailed'));
      return { data: [], total: 0, success: false };
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<LineSideInventoryItem>
        headerTitle={t('app.kuaizhizao.lineSideWarehouse.headerTitle')}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.line-side-warehouse"
        request={fetchInventory}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        params={{ warehouse_id: selectedWarehouseId }}
        scroll={{ x: 1280 }}
        toolBarRender={() => [
          <Select
            key="warehouse-select"
            placeholder={t('app.kuaizhizao.lineSideWarehouse.filterPlaceholder')}
            allowClear
            style={{ width: 200 }}
            options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            value={selectedWarehouseId}
            onChange={(v) => {
              setSelectedWarehouseId(v);
            }}
          />,
        ]}
      />
    </ListPageTemplate>
  );
};

export default LineSideWarehousePage;
