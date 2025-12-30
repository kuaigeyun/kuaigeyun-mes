/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, message, Table } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

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
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);

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
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              style={{ color: '#52c41a' }}
            >
              审核
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
      // 这里应该调用API获取详情
      setOrderDetail(record as PurchaseOrderDetail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  // 处理审核
  const handleApprove = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '审核采购订单',
      content: `确定要审核通过采购订单 "${record.order_code}" 吗？`,
      onOk: async () => {
        try {
          messageApi.success('采购订单审核成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('采购订单审核失败');
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
          messageApi.success('采购订单删除成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('采购订单删除失败');
        }
      },
    });
  };

  // 处理编辑
  const handleEdit = (record: PurchaseOrder) => {
    setCurrentOrder(record);
    setEditModalVisible(true);
  };

  // 处理创建
  const handleCreate = () => {
    setCurrentOrder(null);
    setCreateModalVisible(true);
  };

  return (
    <>
      <div>
        {/* 统计卡片 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card>
                <Statistic
                  title="总订单数"
                  value={25}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="待审核订单"
                  value={5}
                  suffix="个"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="已审核订单"
                  value={18}
                  suffix="个"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="订单总金额"
                  value={125000}
                  prefix="¥"
                  suffix="万"
                  precision={1}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="本月采购额"
                  value={45000}
                  prefix="¥"
                  suffix="万"
                  precision={1}
                  valueStyle={{ color: '#13c2c2' }}
                />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="准时交货率"
                  value={92.5}
                  suffix="%"
                  precision={1}
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* 采购订单表格 */}
        <UniTable
          headerTitle="采购订单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据 - 实际应该调用API
            const mockData: PurchaseOrder[] = [
              {
                id: 1,
                order_code: 'PO202501001',
                supplier_name: '供应商A',
                order_date: '2024-12-01',
                delivery_date: '2024-12-15',
                status: '已审核',
                review_status: '审核通过',
                total_amount: 50000,
                total_quantity: 100,
                items_count: 3,
                created_at: '2024-12-01 09:00:00',
              },
              {
                id: 2,
                order_code: 'PO202501002',
                supplier_name: '供应商B',
                order_date: '2024-12-02',
                delivery_date: '2024-12-20',
                status: '草稿',
                review_status: '待审核',
                total_amount: 25000,
                total_quantity: 50,
                items_count: 2,
                created_at: '2024-12-02 10:30:00',
              }
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
              新建采购订单
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </div>

      {/* 创建采购订单 Modal */}
      <Modal
        title="新建采购订单"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => {
          messageApi.success('采购订单创建成功');
          setCreateModalVisible(false);
          actionRef.current?.reload();
        }}
        width={800}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加采购订单创建表单组件 */}
          <p>采购订单创建表单开发中...</p>
        </div>
      </Modal>

      {/* 编辑采购订单 Modal */}
      <Modal
        title="编辑采购订单"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => {
          messageApi.success('采购订单更新成功');
          setEditModalVisible(false);
          actionRef.current?.reload();
        }}
        width={800}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 这里可以添加采购订单编辑表单组件 */}
          <p>采购订单编辑表单开发中...</p>
        </div>
      </Modal>

      {/* 采购订单详情 Drawer */}
      <Drawer
        title={`采购订单详情 - ${orderDetail?.order_code}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={900}
      >
        {orderDetail && (
          <div style={{ padding: '16px 0' }}>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <strong>订单编号：</strong>{orderDetail.order_code}
                </Col>
                <Col span={8}>
                  <strong>供应商：</strong>{orderDetail.supplier_name}
                </Col>
                <Col span={8}>
                  <strong>订单类型：</strong>{orderDetail.order_type}
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
                  <strong>订单金额：</strong>¥{orderDetail.total_amount?.toLocaleString()}
                </Col>
                <Col span={6}>
                  <strong>税率：</strong>{orderDetail.tax_rate}%
                </Col>
                <Col span={6}>
                  <strong>税额：</strong>¥{orderDetail.tax_amount?.toLocaleString()}
                </Col>
                <Col span={6}>
                  <strong>含税金额：</strong>¥{orderDetail.net_amount?.toLocaleString()}
                </Col>
              </Row>
            </Card>

            {/* 订单明细 */}
            {orderDetail.items && orderDetail.items.length > 0 && (
              <Card title="订单明细">
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
          </div>
        )}
      </Drawer>
    </>
  );
};

export default PurchaseOrdersPage;


