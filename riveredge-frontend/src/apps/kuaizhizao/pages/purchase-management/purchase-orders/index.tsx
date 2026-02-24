/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormUploadButton } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table, Empty, Timeline, Divider } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file';
import { UniTable } from '../../../../../components/uni-table';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, approvePurchaseOrder, submitPurchaseOrder, pushPurchaseOrderToReceipt, PurchaseOrder } from '../../../services/purchase';
import { getApprovalStatus, ApprovalStatusResponse } from '../../../../../services/approvalInstance';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import {
  getStatusDisplay,
  getReviewStatusDisplay,
  isDraftStatus,
  isAuditedStatus,
} from '../../../constants/documentStatus';

// 使用从服务文件导入的接口
type PurchaseOrderDetail = PurchaseOrder;
// PurchaseOrderItem 已在导入中定义

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
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusResponse | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);

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
        const config = getStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      render: (status) => {
        const config = getReviewStatusDisplay(status);
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
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <UniWorkflowActions
            record={record}
            entityName="采购订单"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={['草稿', 'draft']}
            pendingStatuses={['待审核', 'pending_review']}
            approvedStatuses={['已审核', 'audited', '审核通过']}
            rejectedStatuses={['已驳回', 'rejected']}
            theme="link"
            size="small"
            actions={{
              submit: (id) => submitPurchaseOrder(id),
              approve: (id) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
              reject: (id, reason) => approvePurchaseOrder(id, { approved: false, review_remarks: reason || '' }),
            }}
            onSuccess={() => actionRef.current?.reload()}
          />
          {isAuditedStatus(record.status) && (
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
          {isDraftStatus(record.status) && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
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
      const status = await getApprovalStatus('purchase_order', orderId);
      setApprovalStatus(status);
    } catch (error) {
      console.error('获取审批流程数据失败:', error);
      setApprovalStatus(null);
    } finally {
      setApprovalLoading(false);
    }
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

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条采购订单吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          for (const k of keys) {
            await deletePurchaseOrder(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条采购订单`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<PurchaseOrder> = {
          order_date: row.order_date || row.orderDate,
          delivery_date: row.delivery_date || row.deliveryDate,
          supplier_id: row.supplier_id ?? row.supplierId,
          supplier_name: row.supplier_name || row.supplierName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createPurchaseOrder(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条采购订单`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
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
          attachments: (detail as any).attachments || [],
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
      const data = { ...values };
      
      // 处理附件
      const formAttachments = data.attachments || [];
      data.attachments = formAttachments.map((f: any) => {
        if (f.response) {
          if (Array.isArray(f.response) && f.response.length > 0) {
            return { uid: f.response[0].uuid, name: f.response[0].original_name, status: 'done', url: getFileDownloadUrl(f.response[0].uuid) };
          }
          if (f.response.uuid) {
            return { uid: f.response.uuid, name: f.response.original_name, status: 'done', url: getFileDownloadUrl(f.response.uuid) };
          }
        }
        return { uid: f.uid, name: f.name, status: 'done', url: f.url };
      });

      if (isEdit && currentOrder?.id) {
        await updatePurchaseOrder(currentOrder.id, data);
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
  const detailColumns: ProDescriptionsItemProps<PurchaseOrderDetail>[] = [
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
        const config = getStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status) => {
        const config = getReviewStatusDisplay(status);
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
          headerTitle="采购订单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建采购订单"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listPurchaseOrders({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
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
        <ProFormUploadButton
          name="attachments"
          label="附件"
          max={10}
          colProps={{ span: 24 }}
          fieldProps={{
            multiple: true,
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], { category: 'purchase_order_attachments' });
                if (options.onSuccess) {
                  options.onSuccess(res[0], options.file as any);
                }
              } catch (err) {
                if (options.onError) {
                  options.onError(err as any);
                }
              }
            }
          }}
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
                    {(() => {
                      const config = getStatusDisplay(orderDetail.status);
                      return <Tag color={config.color}>{config.text}</Tag>;
                    })()}
                  </Col>
                  <Col span={6}>
                    <strong>审核状态：</strong>
                    {(() => {
                      const config = getReviewStatusDisplay(orderDetail.review_status);
                      return <Tag color={config.color}>{config.text}</Tag>;
                    })()}
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

              {/* 审批流程 */}
              {approvalStatus && approvalStatus.has_flow && (
                <Card
                  title="审批流程"
                  style={{ marginBottom: 16 }}
                  loading={approvalLoading}
                  extra={
                    <Tag color={approvalStatus.status === 'approved' ? 'success' : approvalStatus.status === 'rejected' ? 'error' : 'processing'}>
                      {approvalStatus.status === 'approved' ? '已通过' : approvalStatus.status === 'rejected' ? '已驳回' : '进行中'}
                    </Tag>
                  }
                >
                  <div style={{ marginBottom: 16 }}>
                    {approvalStatus.current_node && (
                      <div>
                        <strong>当前节点：</strong>
                        <Tag color="blue">{approvalStatus.current_node}</Tag>
                      </div>
                    )}
                  </div>

                  {/* 审批记录时间线 */}
                  {approvalStatus?.history && approvalStatus.history.length > 0 && (
                    <div>
                      <Divider titlePlacement="left">审批记录</Divider>
                      <Timeline
                        items={approvalStatus.history.map((h) => {
                          const isPassed = h.action === 'approve';
                          const isRejected = h.action === 'reject';

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
                                  <Tag
                                    color={isPassed ? 'success' : isRejected ? 'error' : 'processing'}
                                  >
                                    {isPassed ? '通过' : isRejected ? '驳回' : h.action || '-'}
                                  </Tag>
                                </div>
                                <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                  {h.action_at && `审核时间：${h.action_at}`}
                                </div>
                                {h.comment && (
                                  <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                    审核意见：{h.comment}
                                  </div>
                                )}
                              </div>
                            ),
                          };
                        })}
                      />
                    </div>
                  )}

                  {(!approvalStatus?.history || approvalStatus.history.length === 0) && approvalStatus?.has_flow && (
                    <Empty
                      description="暂无审批记录"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ margin: '20px 0' }}
                    />
                  )}
                </Card>
              )}

              {/* 操作记录与上下游 */}
              {orderDetail?.id && (
                <div style={{ marginBottom: 16 }}>
                  <DocumentTrackingPanel
                    documentType="purchase_order"
                    documentId={orderDetail.id}
                    onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                  />
                </div>
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

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步采购订单"
      />
    </>
  );
};

export default PurchaseOrdersPage;




