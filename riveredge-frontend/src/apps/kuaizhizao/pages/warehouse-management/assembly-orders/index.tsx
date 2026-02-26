/**
 * 组装单管理页面
 *
 * 提供组装单的管理功能，支持创建组装单、添加明细、执行组装等。
 * 组装：多件原材料/半成品按 BOM 组装为成品，消耗组件库存、增加成品库存。
 *
 * 后端接口就绪后，将自动对接完整 CRUD 能力。
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Space } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { assemblyOrderApi } from '../../../services/assembly-order';

interface AssemblyOrder {
  id?: number;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  assembly_date?: string;
  status?: string;
  product_material_id?: number;
  product_material_code?: string;
  product_material_name?: string;
  total_quantity?: number;
  total_items?: number;
  remarks?: string;
  created_at?: string;
}

const AssemblyOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<AssemblyOrder>[] = [
    {
      title: '组装单号',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '组装日期',
      dataIndex: 'assembly_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '成品物料',
      dataIndex: 'product_material_name',
      width: 140,
      ellipsis: true,
    },
    {
      title: '组装数量',
      dataIndex: 'total_quantity',
      width: 110,
      align: 'right',
    },
    {
      title: '组件数',
      dataIndex: 'total_items',
      width: 90,
      align: 'right',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        in_progress: { text: '组装中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              // 详情：后端就绪后调用 assemblyOrderApi.get
            }}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<AssemblyOrder>
        headerTitle="组装单"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={false}
        showCreateButton={true}
        onCreate={() => {
          // 新建：后端就绪后打开创建弹窗
        }}
        request={async (params) => {
          const result = await assemblyOrderApi.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
          });
          return {
            data: result.items || result.data || [],
            success: true,
            total: result.total || 0,
          };
        }}
        locale={{
          emptyText: '暂无组装单数据。后端接口就绪后将支持完整功能。',
        }}
      />
    </ListPageTemplate>
  );
};

export default AssemblyOrdersPage;
