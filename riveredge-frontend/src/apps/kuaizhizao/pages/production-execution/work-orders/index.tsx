/**
 * 工单管理页面
 *
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持MTS/MTO模式工单管理。
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Row, Col, Table, Radio, InputNumber, Form, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { workOrderApi, reworkOrderApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { operationApi } from '../../../../master-data/services/process';
import { workshopApi } from '../../../../master-data/services/factory';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

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
  is_frozen?: boolean;
  freeze_reason?: string;
  frozen_at?: string;
  frozen_by?: number;
  frozen_by_name?: string;
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
  const [workOrderOperations, setWorkOrderOperations] = useState<any[]>([]);
  const [operationsModalVisible, setOperationsModalVisible] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<any>(null);
  const operationFormRef = useRef<any>();

  // 创建返工单相关状态
  const [reworkModalVisible, setReworkModalVisible] = useState(false);
  const [currentWorkOrderForRework, setCurrentWorkOrderForRework] = useState<WorkOrder | null>(null);
  const reworkFormRef = useRef<any>(null);

  // 冻结/解冻相关状态
  const [freezeModalVisible, setFreezeModalVisible] = useState(false);
  const [currentWorkOrderForFreeze, setCurrentWorkOrderForFreeze] = useState<WorkOrder | null>(null);
  const freezeFormRef = useRef<any>(null);

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

      // 加载工单工序列表
      try {
        const operations = await workOrderApi.getOperations(record.id!.toString());
        setWorkOrderOperations(operations);
      } catch (error) {
        console.error('获取工单工序列表失败:', error);
        setWorkOrderOperations([]);
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
   * 处理创建返工单
   */
  const handleCreateRework = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForRework(detail);
      setReworkModalVisible(true);
      setTimeout(() => {
        reworkFormRef.current?.setFieldsValue({
          original_work_order_id: detail.id,
          original_work_order_uuid: detail.uuid || detail.id?.toString(),
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          workshop_id: detail.workshop_id,
          workshop_name: detail.workshop_name,
          work_center_id: detail.work_center_id,
          work_center_name: detail.work_center_name,
          quantity: 1, // 默认返工数量为1
          rework_type: '返工',
          status: 'draft',
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理提交返工单表单
   */
  const handleSubmitRework = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForRework?.id) {
        throw new Error('原工单信息不存在');
      }
      await reworkOrderApi.createFromWorkOrder(currentWorkOrderForRework.id.toString(), values);
      messageApi.success('返工单创建成功');
      setReworkModalVisible(false);
      setCurrentWorkOrderForRework(null);
    } catch (error: any) {
      messageApi.error(error.message || '创建返工单失败');
      throw error;
    }
  };

  /**
   * 处理冻结工单
   */
  const handleFreeze = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForFreeze(detail);
      setFreezeModalVisible(true);
      freezeFormRef.current?.resetFields();
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理解冻工单
   */
  const handleUnfreeze = async (record: WorkOrder) => {
    Modal.confirm({
      title: '确认解冻',
      content: `确定要解冻工单"${record.code}"吗？`,
      onOk: async () => {
        try {
          await workOrderApi.unfreeze(record.id!.toString());
          messageApi.success('工单解冻成功');
          actionRef.current?.reload();
          // 如果详情页打开，刷新详情
          if (workOrderDetail?.id === record.id) {
            const detail = await workOrderApi.get(record.id!.toString());
            setWorkOrderDetail(detail);
          }
        } catch (error: any) {
          messageApi.error(error.message || '工单解冻失败');
        }
      },
    });
  };

  /**
   * 处理提交冻结表单
   */
  const handleSubmitFreeze = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForFreeze?.id) {
        throw new Error('工单信息不存在');
      }
      await workOrderApi.freeze(currentWorkOrderForFreeze.id.toString(), values);
      messageApi.success('工单冻结成功');
      setFreezeModalVisible(false);
      setCurrentWorkOrderForFreeze(null);
      freezeFormRef.current?.resetFields();
      actionRef.current?.reload();
      // 如果详情页打开，刷新详情
      if (workOrderDetail?.id === currentWorkOrderForFreeze.id) {
        const detail = await workOrderApi.get(currentWorkOrderForFreeze.id.toString());
        setWorkOrderDetail(detail);
      }
    } catch (error: any) {
      messageApi.error(error.message || '工单冻结失败');
      throw error;
    }
  };

  /**
   * 处理拆分工单
   */
  const handleSplit = async (record: WorkOrder) => {
    try {
      const detail = await workOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForSplit(detail);
      setSplitModalVisible(true);
      setSplitType('count');
      setSplitCount(2);
      setSplitQuantities([]);
    } catch (error) {
      messageApi.error('获取工单详情失败');
    }
  };

  /**
   * 处理提交拆分表单
   */
  const handleSubmitSplit = async (): Promise<void> => {
    try {
      if (!currentWorkOrderForSplit?.id) {
        throw new Error('原工单信息不存在');
      }

      let splitData: any = {
        split_type: 'quantity',
        remarks: '',
      };

      if (splitType === 'count') {
        // 等量拆分
        splitData.split_count = splitCount;
      } else {
        // 指定数量拆分
        if (splitQuantities.length === 0 || splitQuantities.some(q => q <= 0)) {
          messageApi.error('请输入有效的拆分数量');
          return;
        }
        splitData.split_quantities = splitQuantities;
      }

      const result = await workOrderApi.split(currentWorkOrderForSplit.id.toString(), splitData);
      messageApi.success(`工单拆分成功，已拆分为 ${result.total_count} 个工单`);
      setSplitModalVisible(false);
      setCurrentWorkOrderForSplit(null);
      setSplitQuantities([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '工单拆分失败');
    }
  };

  /**
   * 添加拆分数量输入框
   */
  const handleAddSplitQuantity = () => {
    setSplitQuantities([...splitQuantities, 0]);
  };

  /**
   * 移除拆分数量输入框
   */
  const handleRemoveSplitQuantity = (index: number) => {
    const newQuantities = [...splitQuantities];
    newQuantities.splice(index, 1);
    setSplitQuantities(newQuantities);
  };

  /**
   * 更新拆分数量
   */
  const handleUpdateSplitQuantity = (index: number, value: number | null) => {
    const newQuantities = [...splitQuantities];
    newQuantities[index] = value || 0;
    setSplitQuantities(newQuantities);
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
      width: 120,
      render: (text, record) => (
        <Space>
          <Tag
            color={
              text === '草稿' ? 'default' :
              text === '已下达' ? 'processing' :
              text === '生产中' ? 'processing' :
              text === '已完成' ? 'success' :
              'error'
            }
          >
            {text}
          </Tag>
          {record.is_frozen && (
            <Tag color="warning">已冻结</Tag>
          )}
        </Space>
      ),
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
                <Button
                  type="default"
                  onClick={() => handleSplit(workOrderDetail!)}
                  disabled={!workOrderDetail || !['draft', 'released'].includes(workOrderDetail.status || '')}
                >
                  拆分工单
                </Button>
                {workOrderDetail?.is_frozen ? (
                  <Button
                    type="default"
                    onClick={() => handleUnfreeze(workOrderDetail!)}
                  >
                    解冻工单
                  </Button>
                ) : (
                  <Button
                    type="default"
                    danger
                    onClick={() => handleFreeze(workOrderDetail!)}
                    disabled={!workOrderDetail || workOrderDetail.status === 'cancelled' || workOrderDetail.status === 'completed'}
                  >
                    冻结工单
                  </Button>
                )}
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

            {/* 工单工序管理 */}
            <div style={{ padding: '16px 0' }}>
              <Card 
                title="工单工序"
                extra={
                  workOrderDetail && ['draft', 'released'].includes(workOrderDetail.status || '') ? (
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setCurrentOperation(null);
                        setOperationsModalVisible(true);
                        operationFormRef.current?.resetFields();
                      }}
                    >
                      添加工序
                    </Button>
                  ) : null
                }
              >
                <WorkOrderOperationsList
                  workOrderId={workOrderDetail?.id}
                  operations={workOrderOperations}
                  workOrderStatus={workOrderDetail?.status}
                  onUpdate={async () => {
                    if (workOrderDetail?.id) {
                      const operations = await workOrderApi.getOperations(workOrderDetail.id.toString());
                      setWorkOrderOperations(operations);
                    }
                  }}
                  onEdit={(operation) => {
                    setCurrentOperation(operation);
                    setOperationsModalVisible(true);
                    operationFormRef.current?.setFieldsValue(operation);
                  }}
                />
              </Card>
            </div>
          </>
        }
      />

      {/* 创建返工单Modal */}
      <FormModalTemplate
        title="创建返工单"
        open={reworkModalVisible}
        onCancel={() => {
          setReworkModalVisible(false);
          setCurrentWorkOrderForRework(null);
          reworkFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitRework}
        formRef={reworkFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="original_work_order_id"
          label="原工单ID"
          disabled
        />
        <ProFormText
          name="product_code"
          label="产品编码"
          disabled
        />
        <ProFormText
          name="product_name"
          label="产品名称"
          disabled
        />
        <ProFormDigit
          name="quantity"
          label="返工数量"
          placeholder="请输入返工数量"
          rules={[{ required: true, message: '请输入返工数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="rework_type"
          label="返工类型"
          placeholder="请选择返工类型"
          rules={[{ required: true, message: '请选择返工类型' }]}
          options={[
            { label: '返工', value: '返工' },
            { label: '返修', value: '返修' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormTextArea
          name="rework_reason"
          label="返工原因"
          placeholder="请输入返工原因"
          rules={[{ required: true, message: '请输入返工原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 拆分工单Modal */}
      <Modal
        title="拆分工单"
        open={splitModalVisible}
        onCancel={() => {
          setSplitModalVisible(false);
          setCurrentWorkOrderForSplit(null);
          setSplitQuantities([]);
          setSplitCount(2);
          setSplitType('count');
        }}
        onOk={handleSubmitSplit}
        width={600}
        okText="确认拆分"
        cancelText="取消"
      >
        {currentWorkOrderForSplit && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div><strong>原工单编码：</strong>{currentWorkOrderForSplit.code}</div>
              <div><strong>原工单名称：</strong>{currentWorkOrderForSplit.name}</div>
              <div><strong>原工单数量：</strong>{currentWorkOrderForSplit.quantity}</div>
            </div>
            
            <Form layout="vertical">
              <Form.Item label="拆分方式">
                <Radio.Group
                  value={splitType}
                  onChange={(e) => {
                    setSplitType(e.target.value);
                    if (e.target.value === 'count') {
                      setSplitQuantities([]);
                    } else {
                      setSplitCount(2);
                    }
                  }}
                >
                  <Radio value="count">等量拆分</Radio>
                  <Radio value="quantity">指定数量拆分</Radio>
                </Radio.Group>
              </Form.Item>

              {splitType === 'count' ? (
                <Form.Item label="拆分成几个工单">
                  <InputNumber
                    min={2}
                    max={100}
                    value={splitCount}
                    onChange={(value) => setSplitCount(value || 2)}
                    style={{ width: '100%' }}
                    placeholder="请输入拆分数（2-100）"
                  />
                  <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    每个工单数量：{currentWorkOrderForSplit.quantity ? (Number(currentWorkOrderForSplit.quantity) / splitCount).toFixed(2) : 0}
                    {currentWorkOrderForSplit.quantity && Number(currentWorkOrderForSplit.quantity) % splitCount !== 0 && (
                      <span style={{ color: '#ff4d4f' }}>（不能整除，请使用指定数量拆分）</span>
                    )}
                  </div>
                </Form.Item>
              ) : (
                <Form.Item label="每个拆分工单的数量">
                  <div>
                    {splitQuantities.map((quantity, index) => (
                      <div key={index} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <InputNumber
                          min={0}
                          value={quantity}
                          onChange={(value) => handleUpdateSplitQuantity(index, value)}
                          style={{ flex: 1 }}
                          placeholder={`工单${index + 1}数量`}
                          precision={2}
                        />
                        <Button
                          type="link"
                          danger
                          onClick={() => handleRemoveSplitQuantity(index)}
                          disabled={splitQuantities.length <= 1}
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      onClick={handleAddSplitQuantity}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      + 添加工单
                    </Button>
                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                      总数量：{splitQuantities.reduce((sum, q) => sum + q, 0).toFixed(2)} / {currentWorkOrderForSplit.quantity}
                      {splitQuantities.reduce((sum, q) => sum + q, 0) !== Number(currentWorkOrderForSplit.quantity) && (
                        <span style={{ color: '#ff4d4f' }}>（数量总和必须等于原工单数量）</span>
                      )}
                    </div>
                  </div>
                </Form.Item>
              )}
            </Form>
          </div>
        )}
      </Modal>

      {/* 工单工序编辑Modal */}
      <FormModalTemplate
        title={currentOperation ? '编辑工序' : '添加工序'}
        open={operationsModalVisible}
        onClose={() => {
          setOperationsModalVisible(false);
          setCurrentOperation(null);
          operationFormRef.current?.resetFields();
        }}
        onFinish={async (values: any) => {
          try {
            if (!workOrderDetail?.id) {
              throw new Error('工单ID不存在');
            }

            // 获取当前工序列表
            const currentOperations = await workOrderApi.getOperations(workOrderDetail.id.toString());
            
            // 如果是编辑，更新对应工序；如果是新增，添加到列表
            let updatedOperations: any[];
            if (currentOperation) {
              // 编辑：更新对应sequence的工序
              updatedOperations = currentOperations.map((op: any) => {
                if (op.id === currentOperation.id) {
                  return {
                    ...op,
                    ...values,
                    sequence: op.sequence, // 保持sequence不变
                  };
                }
                return op;
              });
            } else {
              // 新增：计算新的sequence
              const maxSequence = currentOperations.length > 0 
                ? Math.max(...currentOperations.map((op: any) => op.sequence || 0))
                : 0;
              updatedOperations = [
                ...currentOperations,
                {
                  ...values,
                  sequence: maxSequence + 1,
                },
              ];
            }

            // 更新工序列表（重新排序sequence）
            const sortedOperations = updatedOperations.map((op, index) => ({
              ...op,
              sequence: index + 1,
            }));

            await workOrderApi.updateOperations(workOrderDetail.id.toString(), {
              operations: sortedOperations,
            });

            messageApi.success(currentOperation ? '工序更新成功' : '工序添加成功');
            setOperationsModalVisible(false);
            setCurrentOperation(null);
            operationFormRef.current?.resetFields();

            // 刷新工序列表
            const operations = await workOrderApi.getOperations(workOrderDetail.id.toString());
            setWorkOrderOperations(operations);
          } catch (error: any) {
            messageApi.error(error.message || '操作失败');
            throw error;
          }
        }}
        formRef={operationFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormSelect
          name="operation_id"
          label="工序"
          placeholder="请选择工序"
          rules={[{ required: true, message: '请选择工序' }]}
          request={async () => {
            try {
              const operations = await operationApi.list({ is_active: true, limit: 1000 });
              return operations.map((op: any) => ({
                label: `${op.code} - ${op.name}`,
                value: op.id,
                operation: op,
              }));
            } catch (error) {
              return [];
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.operation) {
                const op = option.operation;
                operationFormRef.current?.setFieldsValue({
                  operation_code: op.code,
                  operation_name: op.name,
                });
              }
            },
          }}
        />
        <ProFormText
          name="operation_code"
          label="工序编码"
          disabled
        />
        <ProFormText
          name="operation_name"
          label="工序名称"
          disabled
        />
        <ProFormSelect
          name="workshop_id"
          label="车间"
          placeholder="请选择车间"
          request={async () => {
            try {
              const workshops = await workshopApi.list({ limit: 1000 });
              return workshops.map((ws: any) => ({
                label: ws.name,
                value: ws.id,
                workshop: ws,
              }));
            } catch (error) {
              return [];
            }
          }}
          fieldProps={{
            onChange: async (value: number, option: any) => {
              if (option?.workshop) {
                const ws = option.workshop;
                operationFormRef.current?.setFieldsValue({
                  workshop_name: ws.name,
                });
              }
            },
          }}
        />
        <ProFormText
          name="workshop_name"
          label="车间名称"
          disabled
        />
        <ProFormDigit
          name="standard_time"
          label="标准工时（小时）"
          placeholder="请输入标准工时"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDigit
          name="setup_time"
          label="准备时间（小时）"
          placeholder="请输入准备时间"
          min={0}
          precision={2}
          initialValue={0}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 冻结工单Modal */}
      <FormModalTemplate
        title="冻结工单"
        open={freezeModalVisible}
        onClose={() => {
          setFreezeModalVisible(false);
          setCurrentWorkOrderForFreeze(null);
          freezeFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitFreeze}
        isEdit={false}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={freezeFormRef}
      >
        <ProFormTextArea
          name="freeze_reason"
          label="冻结原因"
          placeholder="请输入冻结原因（必填）"
          rules={[{ required: true, message: '请输入冻结原因' }]}
          fieldProps={{
            rows: 4,
          }}
        />
      </FormModalTemplate>
    </>
  );
};

/**
 * 工单工序列表组件
 */
interface WorkOrderOperationsListProps {
  workOrderId?: number;
  operations: any[];
  workOrderStatus?: string;
  onUpdate: () => Promise<void>;
  onEdit: (operation: any) => void;
}

const WorkOrderOperationsList: React.FC<WorkOrderOperationsListProps> = ({
  workOrderId,
  operations,
  workOrderStatus,
  onUpdate,
  onEdit,
}) => {
  const { message: messageApi } = App.useApp();
  const [localOperations, setLocalOperations] = useState<any[]>(operations);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setLocalOperations(operations);
  }, [operations]);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOperations.findIndex((op) => op.id === active.id);
      const newIndex = localOperations.findIndex((op) => op.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // 检查是否有已报工的工序
      const movedOperation = localOperations[oldIndex];
      if (movedOperation.status !== 'pending' && movedOperation.status !== 'in_progress') {
        messageApi.warning('已报工的工序不允许调整顺序');
        return;
      }

      const newOperations = arrayMove(localOperations, oldIndex, newIndex);
      // 重新计算sequence
      const sortedOperations = newOperations.map((op, index) => ({
        ...op,
        sequence: index + 1,
      }));

      setLocalOperations(sortedOperations);

      // 保存到后端
      if (workOrderId) {
        try {
          setSaving(true);
          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: sortedOperations,
          });
          messageApi.success('工序顺序已更新');
          await onUpdate();
        } catch (error: any) {
          messageApi.error(error.message || '更新失败');
          // 恢复原顺序
          setLocalOperations(operations);
        } finally {
          setSaving(false);
        }
      }
    }
  };

  /**
   * 删除工序
   */
  const handleDelete = async (operation: any) => {
    if (operation.status !== 'pending' && operation.status !== 'in_progress') {
      messageApi.warning('已报工的工序不允许删除');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工序"${operation.operation_name}"吗？`,
      onOk: async () => {
        try {
          if (!workOrderId) return;

          const updatedOperations = localOperations
            .filter((op) => op.id !== operation.id)
            .map((op, index) => ({
              ...op,
              sequence: index + 1,
            }));

          await workOrderApi.updateOperations(workOrderId.toString(), {
            operations: updatedOperations,
          });

          messageApi.success('工序删除成功');
          await onUpdate();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const canEdit = workOrderStatus && ['draft', 'released'].includes(workOrderStatus);

  if (localOperations.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#999' }}>
        暂无工序
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localOperations.map((op) => op.id)}
        strategy={verticalListSortingStrategy}
      >
        <div>
          {localOperations.map((operation) => {
            const isReported = operation.status !== 'pending' && operation.status !== 'in_progress';
            return (
              <SortableOperationItem
                key={operation.id}
                operation={operation}
                canEdit={canEdit && !isReported}
                isReported={isReported}
                onEdit={() => onEdit(operation)}
                onDelete={() => handleDelete(operation)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

/**
 * 可拖拽的工序项组件
 */
interface SortableOperationItemProps {
  operation: any;
  canEdit: boolean;
  isReported: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const SortableOperationItem: React.FC<SortableOperationItemProps> = ({
  operation,
  canEdit,
  isReported,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: operation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isReported ? '#f5f5f5' : '#fff',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '8px',
    cursor: canEdit ? 'grab' : 'not-allowed',
  };

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待开始', color: 'default' },
    in_progress: { text: '进行中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    cancelled: { text: '已取消', color: 'error' },
  };

  const statusConfig = statusMap[operation.status] || { text: operation.status, color: 'default' };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HolderOutlined style={{ color: '#999' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', color: isReported ? '#999' : '#000' }}>
              {operation.sequence}. {operation.operation_name || operation.name}
            </span>
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            {isReported && <Tag color="warning">已报工</Tag>}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <Space split={<span>|</span>}>
              <span>编码: {operation.operation_code || operation.code}</span>
              {operation.workshop_name && <span>车间: {operation.workshop_name}</span>}
              {operation.standard_time > 0 && <span>标准工时: {operation.standard_time}h</span>}
              {operation.planned_start_date && (
                <span>计划: {dayjs(operation.planned_start_date).format('YYYY-MM-DD HH:mm')}</span>
              )}
            </Space>
          </div>
        </div>
        {canEdit && (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={onEdit}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除"
              description={`确定要删除工序"${operation.operation_name || operation.name}"吗？`}
              onConfirm={onDelete}
            >
              <Button
                type="link"
                size="small"
                danger
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
    </div>
  );
};

export default WorkOrdersPage;
