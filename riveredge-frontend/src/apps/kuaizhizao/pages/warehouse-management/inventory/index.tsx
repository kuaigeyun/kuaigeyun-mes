/**
 * 库存查询页面
 *
 * 查询物料库存明细，支持按物料、批号筛选。
 * 使用批次库存 API 获取库存数据。
 */

import React, { useRef } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Tag, Space, App } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { WarningOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

interface InventoryItem {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  batch_no: string;
  production_date: string | null;
  expiry_date: string | null;
  quantity: number;
  supplier_batch_no: string | null;
  status: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
}

const InventoryPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<any>(null);

  const columns: ProColumns<InventoryItem>[] = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '批号',
      dataIndex: 'batch_no',
      width: 120,
      copyable: true,
    },
    {
      title: '生产日期',
      dataIndex: 'production_date',
      width: 120,
      valueType: 'date',
      render: (_, record) => record.production_date || '-',
    },
    {
      title: '有效期',
      dataIndex: 'expiry_date',
      width: 120,
      valueType: 'date',
      render: (_, record) => {
        if (!record.expiry_date) return '-';
        const isExpired = dayjs(record.expiry_date).isBefore(dayjs());
        const isNearExpiry = dayjs(record.expiry_date).diff(dayjs(), 'day') <= 30;

        return (
          <Space>
            {record.expiry_date}
            {isExpired && <Tag color="red">已过期</Tag>}
            {!isExpired && isNearExpiry && <WarningOutlined style={{ color: '#faad14' }} />}
          </Space>
        );
      },
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
      render: (_, record) => {
        const color = record.quantity <= 0 ? '#ff4d4f' : 'inherit';
        return <span style={{ color }}>{record.quantity}</span>;
      },
    },
    {
      title: '供应商批号',
      dataIndex: 'supplier_batch_no',
      width: 120,
      render: (_, record) => record.supplier_batch_no || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        let color = 'default';
        if (record.status === '已过期') color = 'red';
        else if (record.status === '无库存') color = 'orange';
        else if (record.status === '在库') color = 'green';

        return <Tag color={color}>{record.status}</Tag>;
      },
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      render: (_, record) => record.warehouse_name || '-',
    },
  ];

  const fetchInventory = async (params: any) => {
    try {
      const response = await apiRequest<{ total: number; items: InventoryItem[] }>(
        '/apps/kuaizhizao/reports/inventory/batch-query',
        {
          method: 'GET',
          params: {
            material_id: params.material_id,
            warehouse_id: params.warehouse_id,
            batch_number: params.batch_no,
            include_expired: params.include_expired ?? false,
          },
        }
      );

      return {
        data: response.items || [],
        total: response.total || 0,
        success: true,
      };
    } catch (error) {
      messageApi.error('查询失败');
      return {
        data: [],
        total: 0,
        success: false,
      };
    }
  };

  return (
    <ListPageTemplate>
      <UniTable<InventoryItem>
        headerTitle="库存查询"
        actionRef={actionRef}
        columns={columns}
        request={fetchInventory}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1100 }}
      />
    </ListPageTemplate>
  );
};

export default InventoryPage;
