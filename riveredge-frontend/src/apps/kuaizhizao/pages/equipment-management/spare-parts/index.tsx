/**
 * 备品备件库存
 * 对齐 UI_Standard：UniTable + 生命周期列 + 列持久化
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProColumns } from '@ant-design/pro-components';
import { Badge, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { sparePartApi } from '../../../services/equipment';
import { getSparePartInventoryLifecycle } from '../../../utils/equipmentLifecycle';
import { App } from 'antd';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

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

const P = 'app.kuaizhizao.sparePart';

const SparePartsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);

  const columns: ProColumns<SpareInventoryRow>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.partNo`),
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
        title: t(`${P}.col.partName`),
        dataIndex: 'part_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: t(`${P}.col.stockQuantity`),
        dataIndex: 'stock_quantity',
        width: 110,
        align: 'right',
        valueType: 'digit',
      },
      { title: t(`${P}.col.warehouseLocation`), dataIndex: 'warehouse_location', width: 140, ellipsis: true },
      {
        title: t(`${P}.col.stockSnapshot`),
        width: 120,
        hideInSearch: true,
        render: (_, record) =>
          (record.stock_quantity ?? 0) < (record.safety_stock ?? record.min_stock ?? 5) ? (
            <Badge status="error" text={t(`${P}.stockLow`)} />
          ) : (
            <Badge status="success" text={t(`${P}.stockSufficient`)} />
          ),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t(`${P}.col.lifecycle`),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getSparePartInventoryLifecycle(record as Record<string, unknown>, t)} />
        ),
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<SpareInventoryRow>
        headerTitle={t(`${P}.title`)}
        columnPersistenceId="apps.kuaizhizao.pages.equipment-management.spare-parts"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
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
            messageApi.error(t(`${P}.listFailed`));
            return { data: [], success: false, total: 0 };
          }
        }}
        scroll={{ x: 1200 }}
      />
    </ListPageTemplate>
  );
};

export default SparePartsPage;
