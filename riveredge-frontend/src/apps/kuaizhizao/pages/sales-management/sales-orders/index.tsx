/**
 * 销售订单管理页面
 *
 * 提供销售订单的创建、编辑、删除和查询功能
 * 支持MTO模式订单管理
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined, UploadOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniImport } from '../../../../../components/uni-import';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { listSalesOrders, getSalesOrder, createSalesOrder, updateSalesOrder, pushSalesOrderToDelivery, submitSalesOrder, importSalesOrders, exportSalesOrders, SalesOrder as APISalesOrder } from '../../../services/sales';
import { getDocumentRelations, DocumentRelation } from '../../../services/sales-forecast';
import { downloadFile } from '../../../services/common';

// 使用API服务中的接口定义
type SalesOrder = APISalesOrder;

const SalesOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalesOrder | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);
  
  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<SalesOrder | null>(null);
  const formRef = useRef<any>(null);

  // 导入导出相关状态
  const [importVisible, setImportVisible] = useState(false);

  // 移除模拟数据，使用真实API

  // 表格列定义
  const columns: ProColumns<SalesOrder>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
      key: 'order_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120,
    },
    {
      title: '订单类型',
      dataIndex: 'order_type',
      key: 'order_type',
      width: 100,
      render: (text) => (
        <Tag color={text === 'MTO' ? 'blue' : 'green'}>
          {text === 'MTO' ? '按订单生产' : '按库存生产'}
        </Tag>
      ),
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已确认': { text: '已确认', color: 'processing' },
          '进行中': { text: '进行中', color: 'processing' },
          '已完成': { text: '已完成', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      valueType: 'date',
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      key: 'delivery_date',
      width: 120,
      valueType: 'date',
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === '草稿' && (
            <Button
              size="small"
              type="link"
              icon={<SendOutlined />}
              onClick={() => handleSubmit(record)}
              style={{ color: '#1890ff' }}
            >
              提交
            </Button>
          )}
          <Button
            size="small"
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
          {(record.status === '已审核' || record.status === '已确认' || record.status === '进行中') && (
            <Button
              size="small"
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePushToDelivery(record)}
              style={{ color: '#722ed1' }}
            >
              下推出库
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理详情
  const handleDetail = async (record: SalesOrder) => {
    try {
      const detail = await getSalesOrder(record.id!);
      setCurrentRecord(detail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('sales_order', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      setDetailVisible(true);
    } catch (error) {
      messageApi.error('获取订单详情失败');
    }
  };

  // 处理下推到销售出库
  const handlePushToDelivery = async (record: SalesOrder) => {
    Modal.confirm({
      title: '下推到销售出库',
      content: `确定要从销售订单 "${record.order_code}" 下推生成销售出库单吗？`,
      onOk: async () => {
        try {
          const result = await pushSalesOrderToDelivery(record.id!);
          messageApi.success(`成功生成销售出库单：${result.delivery_code || '已创建'}`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推销售出库失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = async (record: SalesOrder) => {
    try {
      const detail = await getSalesOrder(record.id!);
      setIsEdit(true);
      setCurrentOrder(detail);
      setModalVisible(true);
      // 延迟设置表单值
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          customer_id: detail.customer_id,
          customer_name: detail.customer_name,
          customer_contact: detail.customer_contact,
          customer_phone: detail.customer_phone,
          order_date: detail.order_date,
          delivery_date: detail.delivery_date,
          order_type: detail.order_type || 'MTO',
          shipping_address: detail.shipping_address,
          shipping_method: detail.shipping_method,
          payment_terms: detail.payment_terms,
          salesman_name: detail.salesman_name,
          notes: detail.notes,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取销售订单详情失败');
    }
  };

  // 处理删除
  const handleDelete = async (_record: SalesOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除销售订单吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        messageApi.success('删除成功');
        actionRef.current?.reload();
      },
    });
  };

  // 处理创建
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  // 处理提交表单（创建/更新）
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      if (isEdit && currentOrder?.id) {
        await updateSalesOrder(currentOrder.id, values);
        messageApi.success('销售订单更新成功');
      } else {
        // 创建时需要提供明细项，这里先创建一个空的明细数组
        // TODO: 后续需要实现明细项的编辑功能
        await createSalesOrder({
          ...values,
          items: [],
          order_type: values.order_type || 'MTO',
          delivery_date: values.delivery_date || new Date().toISOString().split('T')[0],
        });
        messageApi.success('销售订单创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  // 处理提交订单（从草稿提交为待审核）
  const handleSubmit = async (record: SalesOrder) => {
    Modal.confirm({
      title: '提交销售订单',
      content: `确定要提交销售订单 "${record.order_code}" 吗？提交后将变为待审核状态。`,
      onOk: async () => {
        try {
          await submitSalesOrder(record.id!);
          messageApi.success('销售订单提交成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交失败');
        }
      },
    });
  };

  // 处理批量导入
  const handleImport = async (data: any[][]) => {
    try {
      const result = await importSalesOrders(data);
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
      const blob = await exportSalesOrders();
      const filename = `销售订单_${new Date().toISOString().slice(0, 10)}.csv`;
      downloadFile(blob, filename);
      messageApi.success('导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '导出失败');
    }
  };


  return (
    <>
      <ListPageTemplate
        statCards={[
          {
            title: '今日订单数',
            value: 12,
            prefix: <FileExcelOutlined />,
            valueStyle: { color: '#1890ff' },
          },
          {
            title: 'MTO订单数',
            value: 8,
            prefix: <FileExcelOutlined />,
            valueStyle: { color: '#722ed1' },
          },
          {
            title: '总订单金额',
            value: 257500,
            prefix: '¥',
            suffix: '',
            valueStyle: { color: '#52c41a' },
          },
          {
            title: '待交付订单',
            value: 15,
            suffix: '单',
            valueStyle: { color: '#faad14' },
          },
        ]}
      >
        <UniTable<SalesOrder>
          headerTitle="销售订单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await listSalesOrders({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              console.log('销售订单列表响应:', response);
              // 检查响应格式
              if (!response || typeof response !== 'object') {
                console.error('响应格式错误:', response);
                messageApi.error('获取销售订单列表失败：响应格式错误');
                return {
                  data: [],
                  success: false,
                  total: 0,
                };
              }
              // 确保响应包含必要的字段
              if (!('data' in response) || !('total' in response)) {
                console.error('响应缺少必要字段:', response);
                messageApi.error('获取销售订单列表失败：响应格式不完整');
                return {
                  data: [],
                  success: false,
                  total: 0,
                };
              }
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              console.error('获取销售订单列表失败:', error);
              const errorMessage = error?.message || error?.response?.data?.detail || '获取销售订单列表失败';
              messageApi.error(errorMessage);
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
              新建订单
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

      {/* 详情抽屉 */}
      <DetailDrawerTemplate
        title={`销售订单详情 - ${currentRecord?.order_code || ''}`}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setCurrentRecord(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>订单编号：</strong>{currentRecord.order_code}
                  </Col>
                  <Col span={12}>
                    <strong>客户名称：</strong>{currentRecord.customer_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>订单类型：</strong>
                    <Tag color={currentRecord.order_type === 'MTO' ? 'blue' : 'green'}>
                      {currentRecord.order_type === 'MTO' ? '按订单生产' : '按库存生产'}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <strong>订单状态：</strong>
                    <Tag color={
                      currentRecord.status === '已完成' ? 'success' :
                      currentRecord.status === '已取消' ? 'error' :
                      currentRecord.status === '进行中' ? 'processing' : 'default'
                    }>
                      {currentRecord.status}
                    </Tag>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>订单日期：</strong>{currentRecord.order_date}
                  </Col>
                  <Col span={12}>
                    <strong>交货日期：</strong>{currentRecord.delivery_date}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>总数量：</strong>{currentRecord.total_quantity}
                  </Col>
                  <Col span={12}>
                    <strong>总金额：</strong>¥{currentRecord.total_amount?.toLocaleString() || 0}
                  </Col>
                </Row>
                {currentRecord.customer_contact && (
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <strong>联系人：</strong>{currentRecord.customer_contact}
                    </Col>
                    <Col span={12}>
                      <strong>联系电话：</strong>{currentRecord.customer_phone}
                    </Col>
                  </Row>
                )}
                {currentRecord.notes && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>备注：</strong>{currentRecord.notes}
                    </Col>
                  </Row>
                )}
              </Card>

              <Card title="订单明细" style={{ marginBottom: 16 }}>
                {currentRecord.items?.map((item) => (
                  <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <strong>物料编码：</strong>{item.material_code}
                      </Col>
                      <Col span={12}>
                        <strong>物料名称：</strong>{item.material_name}
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 8 }}>
                      <Col span={12}>
                        <strong>规格：</strong>{item.material_spec || '-'}
                      </Col>
                      <Col span={12}>
                        <strong>单位：</strong>{item.material_unit || '-'}
                      </Col>
                    </Row>
                    <Row gutter={16} style={{ marginTop: 8 }}>
                      <Col span={6}>
                        <strong>订单数量：</strong>{item.ordered_quantity}
                      </Col>
                      <Col span={6}>
                        <strong>已交数量：</strong>{item.delivered_quantity || 0}
                      </Col>
                      <Col span={6}>
                        <strong>单价：</strong>¥{item.unit_price}
                      </Col>
                      <Col span={6}>
                        <strong>金额：</strong>¥{item.total_price?.toLocaleString() || 0}
                      </Col>
                    </Row>
                    <Row style={{ marginTop: 8 }}>
                      <Col span={24}>
                        <strong>交货日期：</strong>{item.delivery_date}
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Card>

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

      {/* 批量导入弹窗 */}
      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImport}
        title="批量导入销售订单"
        headers={[
          '客户名称',
          '订单日期',
          '交货日期',
          '订单类型',
          '发货方式',
          '收货地址',
          '付款条件',
          '备注',
        ]}
        sampleData={[
          ['客户A', '2025-01-15', '2025-02-15', 'MTO', '快递', '北京市朝阳区xxx', '货到付款', '备注信息'],
        ]}
      />
    </>
  );
};

export default SalesOrdersPage;
