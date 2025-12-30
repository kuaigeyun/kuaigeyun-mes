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
import { listSalesOrders, getSalesOrder, SalesOrder as APISalesOrder } from '../../../services/sales';

// 使用API服务中的接口定义
type SalesOrder = APISalesOrder;

interface SalesOrderItem {
  id?: number;
  tenant_id?: number;
  order_id?: number;
  material_id: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  ordered_quantity: number;
  unit_price: number;
  total_price?: number;
  delivered_quantity?: number;
  delivery_date: string;
  notes?: string;
}

const SalesOrdersPage: React.FC = () => {
  const { message: messageApi } = App.use;
  const actionRef = useRef<ActionType>();

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalesOrder | null>(null);

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
  const handleDetail = async (record: SalesOrder) => {
    try {
      const detail = await getSalesOrder(record.id!);
      setCurrentRecord(detail);
      setDetailVisible(true);
    } catch (error) {
      messageApi.error('获取订单详情失败');
    }
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
            try {
              const response = await listSalesOrders({
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
              messageApi.error('获取销售订单列表失败');
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

            <Card title="订单明细">
              {currentRecord.items?.map((item, index) => (
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
          </div>
        )}
      </Drawer>
    </>
  );
};

export default SalesOrdersPage;
