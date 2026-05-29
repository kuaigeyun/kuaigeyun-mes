/**
 * 备品备件库存
 * 对齐 UI_Standard：UniTable + 生命周期列 + 列持久化
 */

import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Badge, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { sparePartApi } from '../../../services/equipment';
import { getSparePartInventoryLifecycle } from '../../../utils/equipmentLifecycle';
import { App } from 'antd';
import dayjs from 'dayjs';

interface SpareInventoryRow {
  id?: number | string;
  part_no?: string;
  part_name?: string;
  stock_quantity?: number;
  warehouse_location?: string;
  safety_stock?: number;
  min_stock?: number;
  updated_at?: string;
}

const SparePartsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();

  const columns: ProColumns<SpareInventoryRow>[] = useMemo(
    () => [
      {
        title: '备件编号',
        dataIndex: 'part_no',
        width: 140,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.part_no ?? '') }} ellipsis>
            {r.part_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: '备件名称',
        dataIndex: 'part_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: '当前库存',
        dataIndex: 'stock_quantity',
        width: 110,
        align: 'right',
        valueType: 'digit',
      },
      { title: '库位', dataIndex: 'warehouse_location', width: 140, ellipsis: true },
      {
        title: '库存快照',
        width: 120,
        hideInSearch: true,
        render: (_, record) =>
          (record.stock_quantity ?? 0) < (record.safety_stock ?? record.min_stock ?? 5) ? (
            <Badge status="error" text="低库存" />
          ) : (
            <Badge status="success" text="充足" />
          ),
      },
      {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '生命周期',
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getSparePartInventoryLifecycle(record as Record<string, unknown>);
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
    []
  );

  return (
    <ListPageTemplate>
      <UniTable<SpareInventoryRow>
        headerTitle="备件库存列表"
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts"
        rowKey={(r) => String(r.id ?? r.part_no ?? Math.random())}
        columns={columns}
        showAdvancedSearch
        search={{ labelWidth: 'auto' }}
        request={async () => {
          try {
            const data = await sparePartApi.listInventory();
            const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
            return { data: list, success: true, total: list.length };
          } catch (e) {
            messageApi.error('加载备件库存失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        scroll={{ x: 1200 }}
      />
    </ListPageTemplate>
  );
};

export default SparePartsPage;
