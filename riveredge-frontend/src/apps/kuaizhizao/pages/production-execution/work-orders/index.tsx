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
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Row, Col, Table } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi, reworkOrderApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { useNavigate } from 'react-router-dom';

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
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrder | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  /**
   * 处理新建工单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑工单
   */
  const handleEdit = async (record: WorkOrder) => {
    try {
      // 加载完整详情
      const detail = await workOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentWorkOrder(detail);
      setModalVisible(true);
      // 延迟设置表单值，确保表单已渲染
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          production_mode: detail.production_mode,
          sales_order_id: detail.sales_order_id,
          sales_order_code: detail.sales_order_code,
          sales_order_name: detail.sales_order_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          status: detail.status,
          priority: detail.priority,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: WorkOrder) => {
    try {
      // 加载完整详情数据
      const detail = await workOrderApi.get(record.id!.toString());
      setWorkOrderDetail(detail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('work_order', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
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
          // 批量删除
          await Promise.all(keys.map(key => workOrderApi.delete(key.toString())));
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      if (isEdit && currentWorkOrder?.id) {
        await workOrderApi.update(currentWorkOrder.id.toString(), values);
        messageApi.success('工单更新成功');
      } else {
        await workOrderApi.create(values);
        messageApi.success('工单创建成功');
      }
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
        onClose={() => {
          setModalVisible(false);
          setCurrentWorkOrder(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="name"
          label="工单名称"
          placeholder="请输入工单名称"
          rules={[{ required: true, message: '请输入工单名称' }]}
          disabled={isEdit}
        />
        <ProFormSelect
          name="production_mode"
          label="生产模式"
          placeholder="请选择生产模式"
          options={[
            { label: '按库存生产(MTS)', value: 'MTS' },
            { label: '按订单生产(MTO)', value: 'MTO' },
          ]}
          rules={[{ required: true, message: '请选择生产模式' }]}
          disabled={isEdit}
        />
        <ProFormText
          name="product_code"
          label="产品编码"
          placeholder="请输入产品编码"
          rules={[{ required: true, message: '请输入产品编码' }]}
          disabled={isEdit}
        />
        <ProFormText
          name="product_name"
          label="产品名称"
          placeholder="请输入产品名称"
          rules={[{ required: true, message: '请输入产品名称' }]}
          disabled={isEdit}
        />
        <ProFormDigit
          name="quantity"
          label="计划数量"
          placeholder="请输入计划生产数量"
          min={0}
          precision={2}
          rules={[{ required: true, message: '请输入计划数量' }]}
        />
        <ProFormSelect
          name="priority"
          label="优先级"
          placeholder="请选择优先级"
          options={[
            { label: '低', value: 'low' },
            { label: '正常', value: 'normal' },
            { label: '高', value: 'high' },
            { label: '紧急', value: 'urgent' },
          ]}
          initialValue="normal"
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          width="md"
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          width="md"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>

      {/* 工单详情 Drawer */}
      <DetailDrawerTemplate<WorkOrder>
        title={`工单详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setWorkOrderDetail(null);
          setDocumentRelations(null);
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        customContent={
          <>
            {/* 操作按钮区域 */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  onClick={() => handleCreateRework(workOrderDetail!)}
                  disabled={!workOrderDetail || workOrderDetail.status === 'cancelled'}
                >
                  创建返工单
                </Button>
              </Space>
            </div>
            {documentRelations ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="单据关联">
                {documentRelations.upstream_count > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                      上游单据 ({documentRelations.upstream_count})
                    </div>
                    <Table
                      size="small"
                      columns={[
                        { title: '单据类型', dataIndex: 'document_type', width: 120 },
                        { title: '单据编号', dataIndex: 'document_code', width: 150 },
                        { title: '单据名称', dataIndex: 'document_name', width: 150 },
                        { 
                          title: '状态', 
                          dataIndex: 'status', 
                          width: 100,
                          render: (status: string) => <Tag>{status}</Tag>
                        },
                      ]}
                      dataSource={documentRelations.upstream_documents}
                      pagination={false}
                      rowKey={(record) => `${record.document_type}-${record.document_id}`}
                      bordered
                    />
                  </div>
                )}
                {documentRelations.downstream_count > 0 && (
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                      下游单据 ({documentRelations.downstream_count})
                    </div>
                    <Table
                      size="small"
                      columns={[
                        { title: '单据类型', dataIndex: 'document_type', width: 120 },
                        { title: '单据编号', dataIndex: 'document_code', width: 150 },
                        { title: '单据名称', dataIndex: 'document_name', width: 150 },
                        { 
                          title: '状态', 
                          dataIndex: 'status', 
                          width: 100,
                          render: (status: string) => <Tag>{status}</Tag>
                        },
                      ]}
                      dataSource={documentRelations.downstream_documents}
                      pagination={false}
                      rowKey={(record) => `${record.document_type}-${record.document_id}`}
                      bordered
                    />
                  </div>
                )}
                {documentRelations.upstream_count === 0 && documentRelations.downstream_count === 0 && (
                  <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                    暂无关联单据
                  </div>
                )}
              </Card>
            </div>
            ) : null}
          </>
        }
      />
    </>
  );
};

export default WorkOrdersPage;
