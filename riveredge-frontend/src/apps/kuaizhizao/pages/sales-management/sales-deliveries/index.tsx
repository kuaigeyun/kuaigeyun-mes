/**
 * 销售出库单管理页面
 *
 * 提供销售出库单的创建、编辑、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col, Table, Input, InputNumber } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, PrinterOutlined, SwapOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniImport } from '../../../../../components/uni-import';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { warehouseApi } from '../../../services/production';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { downloadFile } from '../../../services/common';

// 销售出库单接口定义
interface SalesDelivery {
  id?: number;
  tenant_id?: number;
  delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  delivery_time?: string;
  deliverer_id?: number;
  deliverer_name?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  review_status?: string;
  reviewer_name?: string;
  review_time?: string;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
}

interface SalesDeliveryDetail extends SalesDelivery {
  items?: SalesDeliveryItem[];
}

interface SalesDeliveryItem {
  id?: number;
  material_code?: string;
  material_name?: string;
  delivery_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  notes?: string;
}

const SalesDeliveriesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [deliveryDetail, setDeliveryDetail] = useState<SalesDeliveryDetail | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDelivery, setCurrentDelivery] = useState<SalesDelivery | null>(null);
  const formRef = useRef<any>(null);

  // 从订单/预测上拉相关状态
  const [pullFromOrderVisible, setPullFromOrderVisible] = useState(false);
  const [pullFromForecastVisible, setPullFromForecastVisible] = useState(false);
  const pullFormRef = useRef<any>(null);

  // 导入导出相关状态
  const [importVisible, setImportVisible] = useState(false);

  // 表格列定义
  const columns: ProColumns<SalesDelivery>[] = [
    {
      title: '出库单编号',
      dataIndex: 'delivery_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '出库状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['待出库'];
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
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '出库时间',
      dataIndex: 'delivery_time',
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
      width: 150,
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
          {record.status === '待出库' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setCurrentDelivery(record);
                  setIsEdit(true);
                  setModalVisible(true);
                }}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                style={{ color: '#52c41a' }}
              >
                确认出库
              </Button>
            </>
          )}
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
          >
            打印
          </Button>
        </Space>
      ),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesDelivery) => {
    try {
      const detail = await warehouseApi.salesDelivery.get(record.id!.toString());
      setDeliveryDetail(detail as SalesDeliveryDetail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('sales_delivery', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取销售出库单详情失败');
    }
  };

  // 处理确认出库
  const handleConfirm = async (record: SalesDelivery) => {
    Modal.confirm({
      title: '确认销售出库',
      content: `确定要确认销售出库单 "${record.delivery_code}" 吗？确认后将自动更新库存并生成应收单。`,
      onOk: async () => {
        try {
          await warehouseApi.salesDelivery.confirm(record.id!.toString());
          messageApi.success('销售出库确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售出库确认失败');
        }
      },
    });
  };

  // 处理打印
  const handlePrint = async (record: SalesDelivery) => {
    try {
      const result = await warehouseApi.salesDelivery.print(record.id!.toString());
      
      if (result.success) {
        // 如果有渲染后的内容，使用新窗口打印
        if (result.content) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(result.content);
            printWindow.document.close();
            printWindow.onload = () => {
              printWindow.print();
            };
          }
        } else {
          // 如果没有模板内容，使用默认打印方式
          // 打开详情页面并打印
          await handleDetail(record);
          setTimeout(() => {
            window.print();
          }, 500);
        }
      } else {
        messageApi.warning(result.message || '打印功能暂未配置模板');
      }
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
    }
  };

  // 处理批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await warehouseApi.salesDelivery.import(data);
      if (result.success) {
        const resultData = result.data || {};
        messageApi.success(`导入成功：成功 ${resultData.success_count || 0} 条，失败 ${resultData.failure_count || 0} 条`);
        setImportVisible(false);
        actionRef.current?.reload();
      } else {
        const resultData = result.data || {};
        messageApi.warning(`导入完成：成功 ${resultData.success_count || 0} 条，失败 ${resultData.failure_count || 0} 条`);
      }
    } catch (error: any) {
      messageApi.error(error.message || '导入失败');
    }
  };

  // 处理批量导出
  const handleExport = async () => {
    try {
      const blob = await warehouseApi.salesDelivery.export();
      const filename = `销售出库单_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };

  // 处理创建/编辑表单提交
  const handleFormSubmit = async (values: any): Promise<void> => {
    try {
      if (isEdit && currentDelivery?.id) {
        await warehouseApi.salesDelivery.update(currentDelivery.id.toString(), values);
        messageApi.success('销售出库单更新成功');
      } else {
        await warehouseApi.salesDelivery.create({
          ...values,
          items: [], // TODO: 后续需要实现明细项的编辑功能
        });
        messageApi.success('销售出库单创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  // 处理从订单上拉
  const handlePullFromOrder = async (values: any): Promise<void> => {
    try {
      await warehouseApi.salesDelivery.pullFromSalesOrder(values);
      messageApi.success('从销售订单上拉成功');
      setPullFromOrderVisible(false);
      pullFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '从销售订单上拉失败');
      throw error;
    }
  };

  // 处理从预测上拉
  const handlePullFromForecast = async (values: any): Promise<void> => {
    try {
      await warehouseApi.salesDelivery.pullFromSalesForecast(values);
      messageApi.success('从销售预测上拉成功');
      setPullFromForecastVisible(false);
      pullFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '从销售预测上拉失败');
      throw error;
    }
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemType<SalesDeliveryDetail>[] = [
    {
      title: '出库单编号',
      dataIndex: 'delivery_code',
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
    },
    {
      title: '出库状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
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
      title: '总数量',
      dataIndex: 'total_quantity',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '出库时间',
      dataIndex: 'delivery_time',
      valueType: 'dateTime',
    },
    {
      title: '出库人',
      dataIndex: 'deliverer_name',
    },
    {
      title: '发货方式',
      dataIndex: 'shipping_method',
    },
    {
      title: '物流单号',
      dataIndex: 'tracking_number',
    },
    {
      title: '收货地址',
      dataIndex: 'shipping_address',
      span: 2,
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
            title: '总出库单数',
            value: 0,
            prefix: <CheckCircleOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: '待出库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#faad14' },
          },
          {
            title: '已出库',
            value: 0,
            suffix: '个',
            valueStyle: { color: '#52c41a' },
          },
        ]}
      >
        <UniTable
          headerTitle="销售出库单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await warehouseApi.salesDelivery.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                sales_order_id: params.sales_order_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取销售出库单列表失败');
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
              onClick={() => {
                setIsEdit(false);
                setCurrentDelivery(null);
                setModalVisible(true);
              }}
            >
              新建出库单
            </Button>,
            <Button
              key="pullFromOrder"
              icon={<PlusOutlined />}
              onClick={() => setPullFromOrderVisible(true)}
            >
              从订单上拉
            </Button>,
            <Button
              key="pullFromForecast"
              icon={<PlusOutlined />}
              onClick={() => setPullFromForecastVisible(true)}
            >
              从预测上拉
            </Button>,
            <Button
              key="import"
              icon={<UploadOutlined />}
              onClick={() => setImportVisible(true)}
            >
              批量导入
            </Button>,
            <Button
              key="export"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              批量导出
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`销售出库单详情${deliveryDetail?.delivery_code ? ` - ${deliveryDetail.delivery_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDeliveryDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={deliveryDetail}
        customContent={
          deliveryDetail ? (
            <div style={{ padding: '16px 0' }}>
              {/* 明细表格 */}
              {deliveryDetail.items && deliveryDetail.items.length > 0 && (
                <Card title="出库明细" style={{ marginBottom: 16 }}>
                  <Table
                    size="small"
                    columns={[
                      { title: '物料编码', dataIndex: 'material_code', width: 120 },
                      { title: '物料名称', dataIndex: 'material_name', width: 150 },
                      { title: '出库数量', dataIndex: 'delivery_quantity', width: 100, align: 'right' },
                      { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                      { title: '批次号', dataIndex: 'batch_number', width: 120 },
                      { title: '库位', dataIndex: 'location_code', width: 100 },
                    ]}
                    dataSource={deliveryDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
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
          ) : null
        }
      />

      {/* 创建/编辑Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑销售出库单' : '新建销售出库单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentDelivery(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleFormSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={true}
      >
        <CodeField
          pageCode="kuaizhizao-sales-delivery"
          name="delivery_code"
          label="销售发货单编码"
          required={true}
          autoGenerateOnCreate={!isEdit}
          context={{}}
        />
        <ProFormText
          name="sales_order_code"
          label="销售订单编号"
          placeholder="请输入销售订单编号（可选）"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="customer_name"
          label="客户名称"
          placeholder="请输入客户名称"
          rules={[{ required: true, message: '请输入客户名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="warehouse_name"
          label="仓库名称"
          placeholder="请输入仓库名称"
          rules={[{ required: true, message: '请输入仓库名称' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="delivery_time"
          label="出库时间"
          placeholder="请选择出库时间"
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="shipping_method"
          label="发货方式"
          placeholder="请选择发货方式"
          options={[
            { label: '快递', value: '快递' },
            { label: '物流', value: '物流' },
            { label: '自提', value: '自提' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="tracking_number"
          label="物流单号"
          placeholder="请输入物流单号"
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="shipping_address"
          label="收货地址"
          placeholder="请输入收货地址"
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
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
            注意：销售出库单明细项功能开发中，当前版本仅支持基本信息的创建和编辑。建议使用"从订单上拉"或"从预测上拉"功能来生成带明细的出库单。
          </p>
        </div>
      </FormModalTemplate>

      {/* 从订单上拉Modal */}
      <FormModalTemplate
        title="从销售订单上拉生成销售出库单"
        open={pullFromOrderVisible}
        onClose={() => {
          setPullFromOrderVisible(false);
          pullFormRef.current?.resetFields();
        }}
        onFinish={handlePullFromOrder}
        isEdit={false}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={pullFormRef}
      >
        <ProFormDigit
          name="sales_order_id"
          label="销售订单ID"
          placeholder="请输入销售订单ID"
          rules={[{ required: true, message: '请输入销售订单ID' }]}
        />
        <ProFormDigit
          name="warehouse_id"
          label="出库仓库ID"
          placeholder="请输入出库仓库ID"
          rules={[{ required: true, message: '请输入出库仓库ID' }]}
        />
        <ProFormText
          name="warehouse_name"
          label="出库仓库名称"
          placeholder="请输入出库仓库名称（可选）"
        />
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px' }}>
          <p style={{ margin: 0, color: '#999' }}>
            说明：系统将根据销售订单自动生成销售出库单，包含订单中的所有明细项。如需自定义出库数量，请在生成后编辑出库单。
          </p>
        </div>
      </FormModalTemplate>

      {/* 从预测上拉Modal */}
      <FormModalTemplate
        title="从销售预测上拉生成销售出库单（MTS模式）"
        open={pullFromForecastVisible}
        onClose={() => {
          setPullFromForecastVisible(false);
          pullFormRef.current?.resetFields();
        }}
        onFinish={handlePullFromForecast}
        isEdit={false}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        formRef={pullFormRef}
      >
        <ProFormDigit
          name="sales_forecast_id"
          label="销售预测ID"
          placeholder="请输入销售预测ID"
          rules={[{ required: true, message: '请输入销售预测ID' }]}
        />
        <ProFormDigit
          name="warehouse_id"
          label="出库仓库ID"
          placeholder="请输入出库仓库ID"
          rules={[{ required: true, message: '请输入出库仓库ID' }]}
        />
        <ProFormText
          name="warehouse_name"
          label="出库仓库名称"
          placeholder="请输入出库仓库名称（可选）"
        />
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', marginTop: '16px' }}>
          <p style={{ margin: 0, color: '#999' }}>
            说明：系统将根据销售预测（MTS模式）自动生成销售出库单，包含预测中的所有明细项。适用于按库存生产（MTS）场景。
          </p>
        </div>
      </FormModalTemplate>

      {/* 批量导入弹窗 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImport}
        title="批量导入销售出库单"
        headers={[
          '销售订单编号',
          '客户名称',
          '仓库名称',
          '出库时间',
          '发货方式',
          '物流单号',
          '收货地址',
          '备注',
        ]}
        sampleData={[
          ['SO20250115001', '客户A', '主仓库', '2025-01-15 10:00:00', '快递', 'SF1234567890', '北京市朝阳区xxx', '备注信息'],
        ]}
      />
    </>
  );
};

export default SalesDeliveriesPage;

