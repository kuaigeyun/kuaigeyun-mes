/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Form } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface OutboundOrder {
  id: number;
  code: string;
  type: 'production' | 'sales' | 'return';
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
  customerName?: string;
  workOrderCode?: string;
  totalQuantity: number;
  totalItems: number;
  warehouseName: string;
  operatorName: string;
  createdAt: string;
  completedAt?: string;
}

const OutboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建出库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);

  /**
   * 处理创建出库单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = (record: OutboundOrder) => {
    setCurrentOrder(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理确认出库
   */
  const handleConfirm = (record: OutboundOrder) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 "${record.code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        messageApi.success('出库确认成功，库存已更新');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<OutboundOrder>[] = [
    {
      title: '出库单号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '出库类型',
      dataIndex: 'type',
      width: 100,
      valueEnum: {
        production: { text: '生产领料', status: 'processing' },
        sales: { text: '销售出库', status: 'success' },
        return: { text: '退货出库', status: 'warning' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        confirmed: { text: '已确认', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '工单号',
      dataIndex: 'workOrderCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '出库数量',
      dataIndex: 'totalQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '出库品种',
      dataIndex: 'totalItems',
      width: 100,
      align: 'right',
    },
    {
      title: '出库仓库',
      dataIndex: 'warehouseName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'operatorName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <UniTable
        headerTitle="出库管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          // 模拟数据
          const mockData: OutboundOrder[] = [
            {
              id: 1,
              code: 'OUT20241201001',
              type: 'production',
              status: 'completed',
              workOrderCode: 'WO20241201001',
              totalQuantity: 190,
              totalItems: 3,
              warehouseName: '原材料仓库',
              operatorName: '张三',
              createdAt: '2024-12-01 13:00:00',
              completedAt: '2024-12-01 13:30:00',
            },
            {
              id: 2,
              code: 'OUT20241201002',
              type: 'sales',
              status: 'confirmed',
              customerName: '客户A',
              totalQuantity: 50,
              totalItems: 1,
              warehouseName: '成品仓库',
              operatorName: '李四',
              createdAt: '2024-12-01 16:30:00',
            },
            {
              id: 3,
              code: 'OUT20241201003',
              type: 'production',
              status: 'draft',
              workOrderCode: 'WO20241201002',
              totalQuantity: 105,
              totalItems: 3,
              warehouseName: '原材料仓库',
              operatorName: '王五',
              createdAt: '2024-12-01 15:00:00',
            },
          ];

          return {
            data: mockData,
            success: true,
            total: mockData.length,
          };
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建出库单
          </Button>,
        ]}
      />

      {/* 创建出库单 Modal */}
      <Modal
        title="新建出库单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          createForm.validateFields().then((values) => {
            messageApi.success('出库单创建成功');
            setCreateModalVisible(false);
            createForm.resetFields();
            actionRef.current?.reload();
          });
        }}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            type: 'production',
          }}
        >
          <Form.Item
            name="type"
            label="出库类型"
            rules={[{ required: true, message: '请选择出库类型' }]}
          >
            <select style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
              <option value="production">生产领料</option>
              <option value="sales">销售出库</option>
              <option value="return">退货出库</option>
            </select>
          </Form.Item>

          <Form.Item
            name="warehouse"
            label="出库仓库"
            rules={[{ required: true, message: '请选择出库仓库' }]}
          >
            <select style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
              <option value="raw-materials">原材料仓库</option>
              <option value="semi-finished">半成品仓库</option>
              <option value="finished-goods">成品仓库</option>
            </select>
          </Form.Item>

          <Form.Item
            name="customer"
            label="客户"
          >
            <input type="text" placeholder="选择客户" style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }} />
          </Form.Item>

          <Form.Item
            name="workOrder"
            label="关联工单"
          >
            <input type="text" placeholder="选择工单" style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 出库单详情 Drawer */}
      <Drawer
        title="出库单详情"
        size="large"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {currentOrder && (
          <div>
            <p><strong>出库单号：</strong>{currentOrder.code}</p>
            <p><strong>出库类型：</strong>
              <Tag color={
                currentOrder.type === 'production' ? 'processing' :
                currentOrder.type === 'sales' ? 'success' : 'warning'
              }>
                {currentOrder.type === 'production' ? '生产领料' :
                 currentOrder.type === 'sales' ? '销售出库' : '退货出库'}
              </Tag>
            </p>
            <p><strong>状态：</strong>
              <Tag color={
                currentOrder.status === 'completed' ? 'success' :
                currentOrder.status === 'confirmed' ? 'processing' :
                currentOrder.status === 'cancelled' ? 'error' : 'default'
              }>
                {currentOrder.status === 'draft' ? '草稿' :
                 currentOrder.status === 'confirmed' ? '已确认' :
                 currentOrder.status === 'completed' ? '已完成' : '已取消'}
              </Tag>
            </p>
            <p><strong>出库仓库：</strong>{currentOrder.warehouseName}</p>
            <p><strong>总数量：</strong>{currentOrder.totalQuantity}</p>
            <p><strong>总品种：</strong>{currentOrder.totalItems}</p>
            <p><strong>操作员：</strong>{currentOrder.operatorName}</p>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default OutboundPage;
