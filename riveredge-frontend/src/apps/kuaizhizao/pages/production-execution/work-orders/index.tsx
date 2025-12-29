/**
 * 工单管理页面
 *
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持MTS/MTO模式工单管理。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

interface WorkOrder {
  id: number;
  code: string;
  name: string;
  productName: string;
  quantity: number;
  status: 'draft' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  productionMode: 'MTS' | 'MTO';
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

const WorkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑工单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrder | null>(null);

  /**
   * 处理新建工单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setModalVisible(true);
  };

  /**
   * 处理编辑工单
   */
  const handleEdit = (record: WorkOrder) => {
    setIsEdit(true);
    setCurrentWorkOrder(record);
    setModalVisible(true);
  };

  /**
   * 处理查看详情
   */
  const handleDetail = (record: WorkOrder) => {
    setWorkOrderDetail(record);
    setDrawerVisible(true);
  };

  /**
   * 处理删除工单
   */
  const handleDelete = (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${keys.length} 个工单吗？`,
      onOk: async () => {
        // 这里添加删除逻辑
        messageApi.success('删除成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 处理下达工单
   */
  const handleRelease = (record: WorkOrder) => {
    Modal.confirm({
      title: '确认下达',
      content: `确定要下达工单 "${record.name}" 吗？下达后将进入生产执行阶段。`,
      onOk: async () => {
        // 这里添加下达逻辑
        messageApi.success('工单下达成功');
        actionRef.current?.reload();
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '生产模式',
      dataIndex: 'productionMode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        released: { text: '已下达', status: 'processing' },
        in_progress: { text: '生产中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'startDate',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'endDate',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
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
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleRelease(record)}
            >
              下达
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <UniTable
        headerTitle="工单管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          // 模拟数据
          const mockData: WorkOrder[] = [
            {
              id: 1,
              code: 'WO20241201001',
              name: '产品A生产工单',
              productName: '产品A',
              quantity: 100,
              status: 'released',
              productionMode: 'MTS',
              startDate: '2024-12-01 08:00:00',
              endDate: '2024-12-01 18:00:00',
              createdAt: '2024-12-01 10:00:00',
            },
            {
              id: 2,
              code: 'WO20241201002',
              name: '产品B定制工单',
              productName: '产品B',
              quantity: 50,
              status: 'in_progress',
              productionMode: 'MTO',
              startDate: '2024-12-02 08:00:00',
              endDate: '2024-12-03 18:00:00',
              createdAt: '2024-12-01 14:30:00',
            },
            {
              id: 3,
              code: 'WO20241201003',
              name: '产品C生产工单',
              productName: '产品C',
              quantity: 200,
              status: 'draft',
              productionMode: 'MTS',
              startDate: '2024-12-03 08:00:00',
              endDate: '2024-12-04 18:00:00',
              createdAt: '2024-12-01 16:00:00',
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
            新建工单
          </Button>,
        ]}
        onDelete={handleDelete}
      />

      {/* 创建/编辑工单 Modal */}
      <Modal
        title={isEdit ? '编辑工单' : '新建工单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => {
          messageApi.success(isEdit ? '工单更新成功' : '工单创建成功');
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        width={800}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加工单表单组件 */}
          <p>工单表单开发中...</p>
        </div>
      </Modal>

      {/* 工单详情 Drawer */}
      <Drawer
        title="工单详情"
        size="large"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {workOrderDetail && (
          <div>
            <p><strong>工单编号：</strong>{workOrderDetail.code}</p>
            <p><strong>工单名称：</strong>{workOrderDetail.name}</p>
            <p><strong>产品：</strong>{workOrderDetail.productName}</p>
            <p><strong>数量：</strong>{workOrderDetail.quantity}</p>
            <p><strong>状态：</strong>
              <Tag color={
                workOrderDetail.status === 'completed' ? 'success' :
                workOrderDetail.status === 'in_progress' ? 'processing' :
                workOrderDetail.status === 'cancelled' ? 'error' : 'default'
              }>
                {workOrderDetail.status === 'draft' ? '草稿' :
                 workOrderDetail.status === 'released' ? '已下达' :
                 workOrderDetail.status === 'in_progress' ? '生产中' :
                 workOrderDetail.status === 'completed' ? '已完成' : '已取消'}
              </Tag>
            </p>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default WorkOrdersPage;
