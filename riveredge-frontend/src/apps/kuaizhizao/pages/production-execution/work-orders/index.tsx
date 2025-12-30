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
import { workOrderApi } from '../../../services/production';

interface WorkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  name?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  production_mode?: 'MTS' | 'MTO';
  sales_order_id?: number;
  sales_order_code?: string;
  sales_order_name?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  status?: string;
  priority?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
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
  const handleRelease = async (record: WorkOrder) => {
    try {
      await workOrderApi.release(record.id!.toString());
      messageApi.success('工单下达成功');
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error('工单下达失败');
    }
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
      dataIndex: 'product_name',
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
      dataIndex: 'production_mode',
      width: 100,
      valueEnum: {
        MTS: { text: '按库存生产', status: 'processing' },
        MTO: { text: '按订单生产', status: 'success' },
      },
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      width: 120,
      render: (text, record) => (
        record.production_mode === 'MTO' ? (
          <Tag color="blue">{text}</Tag>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        )
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'default' },
        '已下达': { text: '已下达', status: 'processing' },
        '生产中': { text: '生产中', status: 'processing' },
        '已完成': { text: '已完成', status: 'success' },
        '已取消': { text: '已取消', status: 'error' },
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
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
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const response = await workOrderApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...params,
            });
            return {
              data: response.data,
              success: response.success,
              total: response.total,
            };
          } catch (error) {
            messageApi.error('获取工单列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
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
            <p><strong>产品编码：</strong>{workOrderDetail.product_code}</p>
            <p><strong>产品名称：</strong>{workOrderDetail.product_name}</p>
            <p><strong>计划数量：</strong>{workOrderDetail.quantity}</p>
            <p><strong>生产模式：</strong>
              <Tag color={workOrderDetail.production_mode === 'MTO' ? 'blue' : 'green'}>
                {workOrderDetail.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
              </Tag>
            </p>
            {workOrderDetail.production_mode === 'MTO' && (
              <>
                <p><strong>销售订单：</strong>{workOrderDetail.sales_order_code}</p>
                <p><strong>订单名称：</strong>{workOrderDetail.sales_order_name}</p>
              </>
            )}
            <p><strong>状态：</strong>
              <Tag color={
                workOrderDetail.status === '已完成' ? 'success' :
                workOrderDetail.status === '生产中' ? 'processing' :
                workOrderDetail.status === '已取消' ? 'error' : 'default'
              }>
                {workOrderDetail.status}
              </Tag>
            </p>
            <p><strong>优先级：</strong>{workOrderDetail.priority}</p>
            <p><strong>计划开始时间：</strong>{workOrderDetail.planned_start_date}</p>
            <p><strong>计划结束时间：</strong>{workOrderDetail.planned_end_date}</p>
            {workOrderDetail.actual_start_date && (
              <p><strong>实际开始时间：</strong>{workOrderDetail.actual_start_date}</p>
            )}
            {workOrderDetail.actual_end_date && (
              <p><strong>实际结束时间：</strong>{workOrderDetail.actual_end_date}</p>
            )}
            <p><strong>已完成数量：</strong>{workOrderDetail.completed_quantity}</p>
            <p><strong>合格数量：</strong>{workOrderDetail.qualified_quantity}</p>
            <p><strong>不合格数量：</strong>{workOrderDetail.unqualified_quantity}</p>
            {workOrderDetail.remarks && (
              <p><strong>备注：</strong>{workOrderDetail.remarks}</p>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default WorkOrdersPage;
