/**
 * 线边仓管理页面
 *
 * 查看线边仓列表及线边仓库存，支持从主仓库调拨物料至线边仓。
 */

import React, { useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Tag, App, Select } from 'antd';
import { warehouseApi } from '../../../services/production';
import { UniTable } from '../../../../../components/uni-table';
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
  const { message } = App.useApp();
  const actionRef = useRef<any>(null);
  const [warehouses, setWarehouses] = useState<LineSideWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | undefined>();

  React.useEffect(() => {
    warehouseApi.lineSideWarehouse.listWarehouses().then((res: any) => {
      setWarehouses(Array.isArray(res) ? res : []);
    }).catch(() => {
      message.error('获取线边仓列表失败');
    });
  }, []);

  const columns: ProColumns<LineSideInventoryItem>[] = [
    {
      title: '线边仓',
      dataIndex: 'warehouse_name',
      width: 140,
      render: (_, record) => record.warehouse_name || '-',
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
    },
    {
      title: '规格型号',
      dataIndex: 'material_spec',
      width: 120,
      render: (_, record) => record.material_spec || '-',
    },
    {
      title: '批号',
      dataIndex: 'batch_no',
      width: 100,
      render: (_, record) => record.batch_no || '-',
    },
    {
      title: '库存数量',
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
      title: '预留数量',
      dataIndex: 'reserved_quantity',
      width: 100,
      render: (_, record) => `${record.reserved_quantity} ${record.material_unit || ''}`,
    },
    {
      title: '可用数量',
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
      title: '预留工单',
      dataIndex: 'work_order_code',
      width: 120,
      render: (_, record) => record.work_order_code || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          available: { color: 'green', text: '可用' },
          reserved: { color: 'blue', text: '已预留' },
          consumed: { color: 'default', text: '已消耗' },
        };
        const s = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
  ];

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
      message.error('查询失败');
      return { data: [], total: 0, success: false };
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<LineSideInventoryItem>
        headerTitle="线边仓库存"
        actionRef={actionRef}
        columns={columns}
        request={fetchInventory}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        params={{ warehouse_id: selectedWarehouseId }}
        scroll={{ x: 1100 }}
        toolBarRender={() => [
          <Select
            key="warehouse-select"
            placeholder="筛选线边仓"
            allowClear
            style={{ width: 200 }}
            options={warehouses.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            value={selectedWarehouseId}
            onChange={(v) => {
              setSelectedWarehouseId(v);
              // reset to first page is handled by UniTable/ProTable when params change usually, 
              // but explicit reload is good. params prop change triggers reload.
            }}
          />
        ]}
      />
    </ListPageTemplate>
  );
};

export default LineSideWarehousePage;
