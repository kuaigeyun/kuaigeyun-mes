/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, message, Table, Steps, Empty, Timeline, Divider } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, approvePurchaseOrder, confirmPurchaseOrder, submitPurchaseOrder, pushPurchaseOrderToReceipt, getPurchaseOrderApprovalStatus, getPurchaseOrderApprovalRecords, PurchaseOrder, ApprovalStatus, ApprovalRecord } from '../../../services/purchase';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';

// 采购订单接口定义
interface PurchaseOrder {
  id?: number;
  tenant_id?: number;
  order_code?: string;
  supplier_name?: string;
  order_date?: string;
  delivery_date?: string;
  status?: string;
  total_amount?: number;
  total_quantity?: number;
  review_status?: string;
  items_count?: number;
  created_at?: string;
}

interface PurchaseOrderDetail extends PurchaseOrder {
  supplier_contact?: string;
  supplier_phone?: string;
  order_type?: string;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  currency?: string;
  reviewer_name?: string;
  review_time?: string;
  review_remarks?: string;
  notes?: string;
  items?: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  ordered_quantity?: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  received_quantity?: number;
  outstanding_quantity?: number;
  required_date?: string;
  actual_delivery_date?: string;
  quality_requirements?: string;
  inspection_required?: boolean;
}

const PurchaseOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);
  
  // 审批流程相关状态
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [approvalRecords, setApprovalRecords] = useState<ApprovalRecord[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // 表格列定义
  const columns: ProColumns<PurchaseOrder>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已确认': { text: '已确认', color: 'success' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '待审核': { text: '待审核', color: 'default' },
          '审核通过': { text: '审核通过', color: 'success' },
          '审核驳回': { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待审核'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '明细数量',
      dataIndex: 'items_count',
      width: 100,
      align: 'center',
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
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleSubmitOrder(record)}
              style={{ color: '#1890ff' }}
            >
              提交
            </Button>
          )}
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              style={{ color: '#52c41a' }}
            >
              审核
            </Button>
          )}
          {(record.status === '已审核' || record.status === '已确认') && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePushToReceipt(record)}
              style={{ color: '#722ed1' }}
            >
              下推入库
            </Button>
          )}
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setOrderDetail(detail as PurchaseOrderDetail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('purchase_order', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      // 获取审批流程状态和记录（采购审批流程增强）
      await loadApprovalData(record.id!);
      
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  // 加载审批流程数据
  const loadApprovalData = async (orderId: number) => {
    setApprovalLoading(true);
    try {
      // 获取审批流程状态
      const status = await getPurchaseOrderApprovalStatus(orderId);
      setApprovalStatus(status);
      
      // 如果启动了审批流程，获取审批记录
      if (status.has_flow) {
        const recordsResult = await getPurchaseOrderApprovalRecords(orderId);
        setApprovalRecords(recordsResult.data || []);
      } else {
        setApprovalRecords([]);
      }
    } catch (error) {
      console.error('获取审批流程数据失败:', error);
      setApprovalStatus(null);
      setApprovalRecords([]);
    } finally {
      setApprovalLoading(false);
    }
  };

  // 处理提交订单审核
  const handleSubmitOrder = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '提交采购订单',
      content: `确定要提交采购订单 "${record.order_code}" 吗？提交后将变为待审核状态。`,
      onOk: async () => {
        try {
          await submitPurchaseOrder(record.id!);
          messageApi.success('采购订单提交成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购订单提交失败');
        }
      },
    });
  };

  // 处理下推到采购入库
  const handlePushToReceipt = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '下推到采购入库',
      content: `确定要从采购订单 "${record.order_code}" 下推生成采购入库单吗？`,
      onOk: async () => {
        try {
          const result = await pushPurchaseOrderToReceipt(record.id!);
          messageApi.success(`成功生成采购入库单：${result.receipt_code || '已创建'}`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推采购入库失败');
        }
      },
    });
  };

  // 处理审核
  const handleApprove = async (record: PurchaseOrder, approved: boolean = true) => {
    Modal.confirm({
      title: approved ? '审核通过采购订单' : '审核驳回采购订单',
      content: `确定要${approved ? '审核通过' : '审核驳回'}采购订单 "${record.order_code}" 吗？`,
      onOk: async () => {
        try {
          await approvePurchaseOrder(record.id!, {
            approved,
            review_remarks: '',
          });
          messageApi.success(`采购订单${approved ? '审核通过' : '审核驳回'}成功`);
          actionRef.current?.reload();
          // 如果详情页已打开，刷新审批数据
          if (detailDrawerVisible && orderDetail?.id === record.id) {
            await loadApprovalData(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error.message || '采购订单审核失败');
        }
      },
    });
  };

  // 处理删除
  const handleDelete = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '删除采购订单',
      content: `确定要删除采购订单 "${record.order_code}" 吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePurchaseOrder(record.id!);
          messageApi.success('采购订单删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购订单删除失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setIsEdit(true);
      setCurrentOrder(detail);
      setModalVisible(true);
      // 延迟设置表单值
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          supplier_id: detail.supplier_id,
          supplier_name: detail.supplier_name,
          supplier_contact: detail.supplier_contact,
          supplier_phone: detail.supplier_phone,
          order_date: detail.order_date,
          delivery_date: detail.delivery_date,
          order_type: detail.order_type || '标准采购',
          tax_rate: detail.tax_rate,
          currency: detail.currency || 'CNY',
          notes: detail.notes,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  // 处理创建
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  // 处理表单提交（创建/更新）
  const handleFormSubmit = async (values: any): Promise<void> => {
    try {
      if (isEdit && currentOrder?.id) {
        await updatePurchaseOrder(currentOrder.id, values);
        messageApi.success('采购订单更新成功');
      } else {
        // 创建时需要提供明细项，这里先创建一个空的明细数组
        // TODO: 后续需要实现明细项的编辑功能
        await createPurchaseOrder({
          ...values,
          items: [],
        });
        messageApi.success('采购订单创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<PurchaseOrderDetail>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
    },
    {
      title: '订单类型',
      dataIndex: 'order_type',
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已确认': { text: '已确认', color: 'success' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待审核': { text: '待审核', color: 'default' },
          '审核通过': { text: '审核通过', color: 'success' },
          '审核驳回': { text: '审核驳回', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '税率',
      dataIndex: 'tax_rate',
      render: (text) => text ? `${text}%` : '-',
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      render: (text) => text ? `¥${text.toLocaleString()}` : '-',
    },
    {
      title: '含税金额',
      dataIndex: 'net_amount',
      render: (text) => text ? `¥${text.toLocaleString()}` : '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: '总订单数',
            value: 25,
            prefix: <CheckCircleOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: '待审核订单',
            value: 5,
            suffix: '个',
            valueStyle: { color: '#faad14' },
          },
          {
            title: '已审核订单',
            value: 18,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
          {
            title: '订单总金额',
            value: 125000,
            prefix: '¥',
            suffix: '万',
            valueStyle: { color: '#722ed1' },
          },
          {
            title: '本月采购额',
            value: 45000,
            prefix: '¥',
            suffix: '万',
            valueStyle: { color: '#13c2c2' },
          },
          {
            title: '准时交货率',
            value: 92.5,
            suffix: '%',
            valueStyle: { color: '#eb2f96' },
          },
        ]}
      >
        <UniTable<PurchaseOrder>
          headerTitle="采购订单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await listPurchaseOrders({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                review_status: params.review_status,
                keyword: params.keyword,
              });
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取采购订单列表失败');
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
              新建采购订单
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑采购订单 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑采购订单' : '新建采购订单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentOrder(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleFormSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <CodeField
          pageCode="kuaizhizao-purchase-order"
          name="order_code"
          label="采购订单编码"
          required={true}
          autoGenerateOnCreate={!isEdit}
          context={{}}
        />
        <ProFormText
          name="supplier_name"
          label="供应商名称"
          placeholder="请输入供应商名称"
          rules={[{ required: true, message: '请输入供应商名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplier_contact"
          label="联系人"
          placeholder="请输入联系人"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="supplier_phone"
          label="联系电话"
          placeholder="请输入联系电话"
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="order_date"
          label="订单日期"
          placeholder="请选择订单日期"
          rules={[{ required: true, message: '请选择订单日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="delivery_date"
          label="要求到货日期"
          placeholder="请选择要求到货日期"
          rules={[{ required: true, message: '请选择要求到货日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="order_type"
          label="订单类型"
          placeholder="请选择订单类型"
          options={[
            { label: '标准采购', value: '标准采购' },
            { label: '紧急采购', value: '紧急采购' },
            { label: '框架协议', value: '框架协议' },
          ]}
          initialValue="标准采购"
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="currency"
          label="币种"
          placeholder="请选择币种"
          options={[
            { label: '人民币(CNY)', value: 'CNY' },
            { label: '美元(USD)', value: 'USD' },
            { label: '欧元(EUR)', value: 'EUR' },
          ]}
          initialValue="CNY"
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="tax_rate"
          label="税率(%)"
          placeholder="请输入税率"
          min={0}
          max={100}
          precision={2}
          initialValue={0}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="notes"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px' }}>
          <p style={{ margin: 0, color: '#999' }}>
            注意：采购订单明细项功能开发中，当前版本仅支持基本信息的创建和编辑。
          </p>
        </div>
      </FormModalTemplate>

      {/* 采购订单详情 Drawer */}
      <DetailDrawerTemplate<PurchaseOrderDetail>
        title={`采购订单详情 - ${orderDetail?.order_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOrderDetail(null);
          setDocumentRelations(null);
          setApprovalStatus(null);
          setApprovalRecords([]);
        }}
        dataSource={orderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        customContent={
          orderDetail && (
            <div>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <strong>订单编号：</strong>{orderDetail.order_code}
                  </Col>
                  <Col span={8}>
                    <strong>供应商：</strong>{orderDetail.supplier_name}
                  </Col>
                  <Col span={8}>
                    <strong>订单类型：</strong>{orderDetail.order_type || '-'}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={6}>
                    <strong>订单日期：</strong>{orderDetail.order_date}
                  </Col>
                  <Col span={6}>
                    <strong>交货日期：</strong>{orderDetail.delivery_date}
                  </Col>
                  <Col span={6}>
                    <strong>状态：</strong>
                    <Tag color={orderDetail.status === '已审核' ? 'success' : 'default'}>
                      {orderDetail.status}
                    </Tag>
                  </Col>
                  <Col span={6}>
                    <strong>审核状态：</strong>
                    <Tag color={orderDetail.review_status === '审核通过' ? 'success' : 'default'}>
                      {orderDetail.review_status}
                    </Tag>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={6}>
                    <strong>订单金额：</strong>¥{orderDetail.total_amount?.toLocaleString() || 0}
                  </Col>
                  <Col span={6}>
                    <strong>税率：</strong>{orderDetail.tax_rate ? `${orderDetail.tax_rate}%` : '-'}
                  </Col>
                  <Col span={6}>
                    <strong>税额：</strong>¥{orderDetail.tax_amount?.toLocaleString() || 0}
                  </Col>
                  <Col span={6}>
                    <strong>含税金额：</strong>¥{orderDetail.net_amount?.toLocaleString() || 0}
                  </Col>
                </Row>
              </Card>

              {/* 订单明细 */}
              {orderDetail.items && orderDetail.items.length > 0 && (
                <Card title="订单明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                      { title: '单位', dataIndex: 'unit', width: 60 },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text}` },
                      { title: '总价', dataIndex: 'total_price', width: 120, align: 'right', render: (text) => `¥${text?.toLocaleString()}` },
                      { title: '已到货', dataIndex: 'received_quantity', width: 100, align: 'right' },
                      { title: '未到货', dataIndex: 'outstanding_quantity', width: 100, align: 'right' },
                      { title: '要求到货日期', dataIndex: 'required_date', width: 120 },
                      { title: '是否检验', dataIndex: 'inspection_required', width: 100, render: (val) => val ? '是' : '否' },
                    ]}
                    dataSource={orderDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                    scroll={{ x: 1000 }}
                  />
                </Card>
              )}

              {/* 审批流程（采购审批流程增强） */}
              {approvalStatus && approvalStatus.has_flow && (
                <Card 
                  title="审批流程" 
                  style={{ marginBottom: 16 }}
                  loading={approvalLoading}
                  extra={
                    <Tag color={approvalStatus.is_completed ? 'success' : approvalStatus.is_rejected ? 'error' : 'processing'}>
                      {approvalStatus.flow_status || '进行中'}
                    </Tag>
                  }
                >
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>流程名称：</strong>{approvalStatus.flow_name || '-'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>流程编码：</strong>{approvalStatus.flow_code || '-'}
                    </div>
                    {approvalStatus.current_step && (
                      <div>
                        <strong>当前步骤：</strong>
                        <Tag color="blue">
                          第{approvalStatus.current_step}步 - {approvalStatus.current_step_name || '-'}
                        </Tag>
                      </div>
                    )}
                  </div>
                  
                  {/* 审批记录时间线 */}
                  {approvalRecords.length > 0 && (
                    <div>
                      <Divider orientation="left">审批记录</Divider>
                      <Timeline
                        items={approvalRecords.map((record) => {
                          const isPassed = record.approval_result === '通过';
                          const isRejected = record.approval_result === '驳回';
                          
                          return {
                            dot: isPassed ? (
                              <CheckCircleTwoTone twoToneColor="#52c41a" />
                            ) : isRejected ? (
                              <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                            ) : (
                              <ClockCircleOutlined style={{ color: '#1890ff' }} />
                            ),
                            color: isPassed ? 'green' : isRejected ? 'red' : 'blue',
                            children: (
                              <div>
                                <div style={{ marginBottom: 4 }}>
                                  <strong>{record.step_name || `第${record.step_order}步`}</strong>
                                  <Tag 
                                    color={isPassed ? 'success' : isRejected ? 'error' : 'processing'}
                                    style={{ marginLeft: 8 }}
                                  >
                                    {record.approval_result}
                                  </Tag>
                                </div>
                                <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                  审核人：{record.approver_name}
                                  {record.approval_time && ` | 审核时间：${record.approval_time}`}
                                </div>
                                {record.approval_comment && (
                                  <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                    审核意见：{record.approval_comment}
                                  </div>
                                )}
                              </div>
                            ),
                          };
                        })}
                      />
                    </div>
                  )}
                  
                  {approvalRecords.length === 0 && (
                    <Empty 
                      description="暂无审批记录"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '20px 0' }}
                    />
                  )}
                </Card>
              )}

              {/* 单据关联 */}
              {documentRelations && (
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
              )}
            </div>
          )
        }
      />
    </>
  );
};

export default PurchaseOrdersPage;




