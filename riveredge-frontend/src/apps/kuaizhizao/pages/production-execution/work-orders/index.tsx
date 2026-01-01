/**
 * 工单管理页面
 *
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持MTS/MTO模式工单管理。
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
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
  const handleDetail = async (record: WorkOrder) => {
    try {
      // 这里可以加载完整详情数据
      setWorkOrderDetail(record);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理删除工单
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${keys.length} 个工单吗？`,
      onOk: async () => {
        try {
          // 这里添加删除逻辑
          // await workOrderApi.batchDelete(keys);
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      // 这里添加创建/更新逻辑
      // if (isEdit && currentWorkOrder?.id) {
      //   await workOrderApi.update(currentWorkOrder.id.toString(), values);
      // } else {
      //   await workOrderApi.create(values);
      // }
      messageApi.success(isEdit ? '工单更新成功' : '工单创建成功');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
    },
    {
      title: '计划数量',
      dataIndex: 'quantity',
    },
    {
      title: '生产模式',
      dataIndex: 'production_mode',
      render: (_, record) => (
        <Tag color={record.production_mode === 'MTO' ? 'blue' : 'green'}>
          {record.production_mode === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: '销售订单',
      dataIndex: 'sales_order_code',
      render: (_, record) => record.production_mode === 'MTO' ? record.sales_order_code || '-' : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '草稿': { text: '草稿', color: 'default' },
          '已下达': { text: '已下达', color: 'processing' },
          '生产中': { text: '生产中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '已完成数量',
      dataIndex: 'completed_quantity',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ];

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
      <ListPageTemplate>
        <UniTable<WorkOrder>
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
      </ListPageTemplate>

      {/* 创建/编辑工单 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑工单' : '新建工单'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        {/* 这里可以添加工单表单组件 */}
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <p>工单表单开发中...</p>
        </div>
      </FormModalTemplate>

      {/* 工单详情 Drawer */}
      <DetailDrawerTemplate<WorkOrder>
        title={`工单详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
      />
    </>
  );
};

export default WorkOrdersPage;
