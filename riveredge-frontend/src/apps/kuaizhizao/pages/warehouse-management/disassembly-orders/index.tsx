/**
 * 拆卸单管理页面
 *
 * 提供拆卸单的管理功能，支持创建拆卸单、添加明细、执行拆卸等。
 * 拆卸：成品按 BOM 拆卸为原材料/半成品，消耗成品库存、增加组件库存。
 *
 * 后端接口就绪后，将自动对接完整 CRUD 能力。
 */

import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Space } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { disassemblyOrderApi } from '../../../services/disassembly-order';
import { getDisassemblyOrderLifecycle } from '../../../utils/disassemblyOrderLifecycle';

interface DisassemblyOrder {
  id?: number;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  disassembly_date?: string;
  status?: string;
  product_material_id?: number;
  product_material_code?: string;
  product_material_name?: string;
  total_quantity?: number;
  total_items?: number;
  remarks?: string;
  created_at?: string;
}

const DisassemblyOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<DisassemblyOrder>[] = [
    {
      title: '拆卸单号',
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
      title: '拆卸日期',
      dataIndex: 'disassembly_date',
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
      title: '拆卸数量',
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
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        in_progress: { text: '拆卸中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
      render: (_, record) => {
        const lifecycle = getDisassemblyOrderLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = { 草稿: 'default', 拆卸中: 'processing', 已完成: 'success', 已取消: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
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
              // 详情：后端就绪后调用 disassemblyOrderApi.get
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
      <UniTable<DisassemblyOrder>
        headerTitle="拆卸单"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={false}
        showCreateButton={true}
        onCreate={() => {
          // 新建：后端就绪后打开创建弹窗
        }}
        request={async (params) => {
          const result = await disassemblyOrderApi.list({
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
          emptyText: '暂无拆卸单数据。后端接口就绪后将支持完整功能。',
        }}
      />
    </ListPageTemplate>
  );
};

export default DisassemblyOrdersPage;
