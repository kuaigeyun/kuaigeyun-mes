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
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, message, Card, Statistic, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 销售订单接口定义
interface SalesOrder {
  id: number;
  orderCode: string;
  customerId: number;
  customerName: string;
  orderType: 'MTO' | 'MTS';
  status: 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  totalQuantity: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  items: SalesOrderItem[];
}

interface SalesOrderItem {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDate: string;
}

const SalesOrdersPage: React.FC = () => {
  const { message: messageApi } = App.use;
  const actionRef = useRef<ActionType>();

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalesOrder | null>(null);

  // 模拟数据
  const mockData: SalesOrder[] = [
    {
      id: 1,
      orderCode: 'SO20251229001',
      customerId: 1,
      customerName: '客户A',
      orderType: 'MTO',
      status: 'confirmed',
      orderDate: '2025-12-29',
      deliveryDate: '2026-01-20',
      totalAmount: 15000,
      totalQuantity: 100,
      remarks: '紧急订单',
      createdAt: '2025-12-29 10:00:00',
      updatedAt: '2025-12-29 10:00:00',
      items: [
        {
          id: 1,
          productId: 1,
          productCode: 'P001',
          productName: '产品A',
          quantity: 100,
          unitPrice: 150,
          totalPrice: 15000,
          deliveryDate: '2026-01-20'
        }
      ]
    },
    {
      id: 2,
      orderCode: 'SO20251229002',
      customerId: 2,
      customerName: '客户B',
      orderType: 'MTS',
      status: 'processing',
      orderDate: '2025-12-29',
      deliveryDate: '2026-01-15',
      totalAmount: 7500,
      totalQuantity: 50,
      createdAt: '2025-12-29 11:00:00',
      updatedAt: '2025-12-29 11:00:00',
      items: [
        {
          id: 2,
          productId: 2,
          productCode: 'P002',
          productName: '产品B',
          quantity: 50,
          unitPrice: 150,
          totalPrice: 7500,
          deliveryDate: '2026-01-15'
        }
      ]
    }
  ];

  // 表格列定义
  const columns: ProColumns<SalesOrder>[] = [
    {
      title: '订单编号',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 150,
      fixed: 'left',
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
    },
    {
      title: '订单类型',
      dataIndex: 'orderType',
      key: 'orderType',
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
          draft: { text: '草稿', color: 'default' },
          confirmed: { text: '已确认', color: 'processing' },
          processing: { text: '进行中', color: 'processing' },
          completed: { text: '已完成', color: 'success' },
          cancelled: { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '订单日期',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '交货日期',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '总数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
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
          <Button
            size="small"
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 处理详情
  const handleDetail = (record: SalesOrder) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // 处理编辑
  const handleEdit = (record: SalesOrder) => {
    messageApi.info('编辑功能开发中...');
  };

  // 处理删除
  const handleDelete = (record: SalesOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除销售订单 ${record.orderCode} 吗？`,
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
    messageApi.info('创建功能开发中...');
  };

  // 处理Excel导入
  const handleExcelImport = () => {
    messageApi.info('Excel导入功能开发中...');
  };

  return (
    <>
      <div>
        {/* 统计卡片 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="今日订单数"
                  value={12}
                  prefix={<FileExcelOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="MTO订单数"
                  value={8}
                  prefix={<FileExcelOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总订单金额"
                  value={257500}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待交付订单"
                  value={15}
                  suffix="单"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* UniTable */}
        <UniTable<SalesOrder>
          headerTitle="销售订单管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟API调用
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
              新建订单
            </Button>,
            <Button
              key="import"
              icon={<FileExcelOutlined />}
              onClick={handleExcelImport}
            >
              Excel导入
            </Button>,
          ]}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title={`销售订单详情 - ${currentRecord?.orderCode}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {currentRecord && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>订单编号：</strong>{currentRecord.orderCode}
                </Col>
                <Col span={12}>
                  <strong>客户名称：</strong>{currentRecord.customerName}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>订单类型：</strong>
                  <Tag color={currentRecord.orderType === 'MTO' ? 'blue' : 'green'}>
                    {currentRecord.orderType === 'MTO' ? '按订单生产' : '按库存生产'}
                  </Tag>
                </Col>
                <Col span={12}>
                  <strong>订单状态：</strong>
                  <Tag color="processing">已确认</Tag>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>订单日期：</strong>{currentRecord.orderDate}
                </Col>
                <Col span={12}>
                  <strong>交货日期：</strong>{currentRecord.deliveryDate}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>总数量：</strong>{currentRecord.totalQuantity}
                </Col>
                <Col span={12}>
                  <strong>总金额：</strong>¥{currentRecord.totalAmount.toLocaleString()}
                </Col>
              </Row>
              {currentRecord.remarks && (
                <Row style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <strong>备注：</strong>{currentRecord.remarks}
                  </Col>
                </Row>
              )}
            </Card>

            <Card title="订单明细">
              {currentRecord.items.map((item, index) => (
                <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <strong>产品编码：</strong>{item.productCode}
                    </Col>
                    <Col span={12}>
                      <strong>产品名称：</strong>{item.productName}
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={8}>
                      <strong>数量：</strong>{item.quantity}
                    </Col>
                    <Col span={8}>
                      <strong>单价：</strong>¥{item.unitPrice}
                    </Col>
                    <Col span={8}>
                      <strong>金额：</strong>¥{item.totalPrice.toLocaleString()}
                    </Col>
                  </Row>
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>交货日期：</strong>{item.deliveryDate}
                    </Col>
                  </Row>
                </Card>
              ))}
            </Card>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default SalesOrdersPage;
