/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、生产入库、退货入库、初始入库等。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Form } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface InboundOrder {
  id: number;
  code: string;
  type: 'purchase' | 'production' | 'return' | 'initial';
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled';
  supplierName?: string;
  workOrderCode?: string;
  totalQuantity: number;
  totalItems: number;
  warehouseName: string;
  operatorName: string;
  createdAt: string;
  completedAt?: string;
}

const InboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建入库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);

  /**
   * 处理创建入库单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = (record: InboundOrder) => {
    setCurrentOrder(record);
    setDetailDrawerVisible(true);
  };

  /**
   * 处理确认入库
   */
  const handleConfirm = (record: InboundOrder) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要确认入库单 "${record.code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        messageApi.success('入库确认成功，库存已更新');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InboundOrder>[] = [
    {
      title: '入库单号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '入库类型',
      dataIndex: 'type',
      width: 100,
      valueEnum: {
        purchase: { text: '采购入库', status: 'processing' },
        production: { text: '生产入库', status: 'success' },
        return: { text: '退货入库', status: 'warning' },
        initial: { text: '初始入库', status: 'default' },
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
      title: '供应商',
      dataIndex: 'supplierName',
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
      title: '入库数量',
      dataIndex: 'totalQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '入库品种',
      dataIndex: 'totalItems',
      width: 100,
      align: 'right',
    },
    {
      title: '入库仓库',
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
        headerTitle="入库管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          // 模拟数据
          const mockData: InboundOrder[] = [
            {
              id: 1,
              code: 'IN20241201001',
              type: 'initial',
              status: 'completed',
              totalQuantity: 10250,
              totalItems: 3,
              warehouseName: '原材料仓库',
              operatorName: '张三',
              createdAt: '2024-12-01 09:00:00',
              completedAt: '2024-12-01 09:30:00',
            },
            {
              id: 2,
              code: 'IN20241201002',
              type: 'production',
              status: 'confirmed',
              workOrderCode: 'WO20241201001',
              totalQuantity: 88,
              totalItems: 1,
              warehouseName: '成品仓库',
              operatorName: '李四',
              createdAt: '2024-12-01 16:00:00',
            },
            {
              id: 3,
              code: 'IN20241201003',
              type: 'purchase',
              status: 'draft',
              supplierName: '供应商A',
              totalQuantity: 2000,
              totalItems: 2,
              warehouseName: '原材料仓库',
              operatorName: '王五',
              createdAt: '2024-12-01 14:00:00',
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
            新建入库单
          </Button>,
        ]}
      />

      {/* 创建入库单 Modal */}
      <Modal
        title="新建入库单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          createForm.validateFields().then((values) => {
            messageApi.success('入库单创建成功');
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
            type: 'purchase',
          }}
        >
          <Form.Item
            name="type"
            label="入库类型"
            rules={[{ required: true, message: '请选择入库类型' }]}
          >
            <ProFormSelect
              options={[
                { label: '采购入库', value: 'purchase' },
                { label: '生产入库', value: 'production' },
                { label: '退货入库', value: 'return' },
                { label: '初始入库', value: 'initial' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="warehouse"
            label="入库仓库"
            rules={[{ required: true, message: '请选择入库仓库' }]}
          >
            <ProFormSelect
              options={[
                { label: '原材料仓库', value: 'raw-materials' },
                { label: '半成品仓库', value: 'semi-finished' },
                { label: '成品仓库', value: 'finished-goods' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="supplier"
            label="供应商"
          >
            <ProFormText placeholder="选择供应商" />
          </Form.Item>

          <Form.Item
            name="workOrder"
            label="关联工单"
          >
            <ProFormText placeholder="选择工单" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 入库单详情 Drawer */}
      <Drawer
        title="入库单详情"
        size="large"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {currentOrder && (
          <div>
            <p><strong>入库单号：</strong>{currentOrder.code}</p>
            <p><strong>入库类型：</strong>
              <Tag color={
                currentOrder.type === 'purchase' ? 'processing' :
                currentOrder.type === 'production' ? 'success' :
                currentOrder.type === 'return' ? 'warning' : 'default'
              }>
                {currentOrder.type === 'purchase' ? '采购入库' :
                 currentOrder.type === 'production' ? '生产入库' :
                 currentOrder.type === 'return' ? '退货入库' : '初始入库'}
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
            <p><strong>入库仓库：</strong>{currentOrder.warehouseName}</p>
            <p><strong>总数量：</strong>{currentOrder.totalQuantity}</p>
            <p><strong>总品种：</strong>{currentOrder.totalItems}</p>
            <p><strong>操作员：</strong>{currentOrder.operatorName}</p>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default InboundPage;
