/**
 * 应收管理页面
 *
 * 提供销售出库后自动生成应收单的管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Input, Select, DatePicker } from 'antd';
import { DollarOutlined, EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 应收单接口定义
interface AccountsReceivable {
  id: number;
  receivableCode: string;
  salesOrderCode?: string;
  customerName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  dueDate: string;
  status: 'draft' | 'confirmed' | 'received' | 'overdue';
  paymentMethod?: string;
  paymentDate?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

const AccountsReceivablePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 收款Modal状态
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [currentReceivable, setCurrentReceivable] = useState<AccountsReceivable | null>(null);
  const [receiptForm] = Form.useForm();

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [receivableDetail, setReceivableDetail] = useState<AccountsReceivable | null>(null);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalReceivable: 89250,
    receivedAmount: 45680,
    pendingAmount: 43570,
    overdueAmount: 12000,
  });

  // 处理收款
  const handleReceipt = (record: AccountsReceivable) => {
    setCurrentReceivable(record);
    setReceiptModalVisible(true);

    receiptForm.setFieldsValue({
      paymentMethod: 'bank_transfer',
      paymentDate: null,
      remarks: '',
    });
  };

  // 处理收款提交
  const handleReceiptSubmit = async (values: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      messageApi.success(`收款成功：¥${currentReceivable?.totalAmount.toLocaleString()}`);

      setReceiptModalVisible(false);
      receiptForm.resetFields();
      actionRef.current?.reload();

      // 更新统计数据
      setStats(prev => ({
        ...prev,
        receivedAmount: prev.receivedAmount + currentReceivable!.totalAmount,
        pendingAmount: Math.max(0, prev.pendingAmount - currentReceivable!.totalAmount),
      }));

    } catch (error: any) {
      messageApi.error(error.message || '收款失败');
    }
  };

  // 处理详情查看
  const handleDetail = (record: AccountsReceivable) => {
    setReceivableDetail(record);
    setDetailVisible(true);
  };

  // 表格列定义
  const columns: ProColumns<AccountsReceivable>[] = [
    {
      title: '应收单号',
      dataIndex: 'receivableCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '销售订单',
      dataIndex: 'salesOrderCode',
      width: 120,
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <span style={{ color: '#999' }}>无</span>,
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      width: 100,
      align: 'right',
      render: (price) => `¥${price.toFixed(2)}`,
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount.toLocaleString()}`,
    },
    {
      title: '税率',
      dataIndex: 'taxRate',
      width: 80,
      align: 'right',
      render: (rate) => `${rate}%`,
    },
    {
      title: '到期日期',
      dataIndex: 'dueDate',
      width: 120,
      valueType: 'date',
      render: (date) => {
        const dueDate = new Date(date);
        const today = new Date();
        const isOverdue = dueDate < today;

        return (
          <span style={{ color: isOverdue ? '#f5222d' : '#000' }}>
            {date}
            {isOverdue && ' (逾期)'}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          draft: { text: '草稿', color: 'default' },
          confirmed: { text: '待收款', color: 'processing' },
          received: { text: '已收款', color: 'success' },
          overdue: { text: '逾期', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
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
          {record.status === 'confirmed' && (
            <Button
              size="small"
              type="primary"
              onClick={() => handleReceipt(record)}
            >
              收款
            </Button>
          )}
          <Button
            size="small"
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => messageApi.info('打印功能开发中...')}
          >
            打印
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div>
        {/* 统计卡片 */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总应收金额"
                  value={stats.totalReceivable}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已收金额"
                  value={stats.receivedAmount}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待收金额"
                  value={stats.pendingAmount}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="逾期金额"
                  value={stats.overdueAmount}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* UniTable */}
        <UniTable<AccountsReceivable>
          headerTitle="应收管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: AccountsReceivable[] = [
              {
                id: 1,
                receivableCode: 'REC20251229001',
                salesOrderCode: 'SO20251229001',
                customerName: '客户A',
                productCode: 'FIN001',
                productName: '产品A',
                quantity: 100,
                unitPrice: 150,
                totalAmount: 15000,
                taxRate: 13,
                taxAmount: 1950,
                netAmount: 16950,
                currency: 'CNY',
                dueDate: '2026-01-10',
                status: 'confirmed',
                createdAt: '2025-12-29 12:00:00',
                updatedAt: '2025-12-29 12:00:00',
              },
              {
                id: 2,
                receivableCode: 'REC20251229002',
                customerName: '客户B',
                productCode: 'FIN002',
                productName: '产品B',
                quantity: 50,
                unitPrice: 180,
                totalAmount: 9000,
                taxRate: 13,
                taxAmount: 1170,
                netAmount: 10170,
                currency: 'CNY',
                dueDate: '2025-12-20',
                status: 'overdue',
                createdAt: '2025-12-15 10:00:00',
                updatedAt: '2025-12-15 10:00:00',
              },
              {
                id: 3,
                receivableCode: 'REC20251229003',
                customerName: '客户C',
                productCode: 'FIN003',
                productName: '产品C',
                quantity: 80,
                unitPrice: 120,
                totalAmount: 9600,
                taxRate: 13,
                taxAmount: 1248,
                netAmount: 10848,
                currency: 'CNY',
                dueDate: '2026-01-15',
                status: 'received',
                paymentMethod: '银行转账',
                paymentDate: '2025-12-28',
                createdAt: '2025-12-20 15:00:00',
                updatedAt: '2025-12-28 14:00:00',
              },
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
              key="batch-receipt"
              type="primary"
              icon={<DollarOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => messageApi.info('批量收款功能开发中...')}
            >
              批量收款
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </div>

      {/* 收款Modal */}
      <Modal
        title={`收款确认 - ${currentReceivable?.receivableCode}`}
        open={receiptModalVisible}
        onCancel={() => setReceiptModalVisible(false)}
        onOk={() => receiptForm.submit()}
        okText="确认收款"
        cancelText="取消"
        width={500}
      >
        {currentReceivable && (
          <div style={{ marginBottom: 24 }}>
            <Card title="收款信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>客户：</strong>{currentReceivable.customerName}
                </Col>
                <Col span={12}>
                  <strong>销售订单：</strong>{currentReceivable.salesOrderCode || '无'}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>产品：</strong>{currentReceivable.productName}
                </Col>
                <Col span={12}>
                  <strong>应收金额：</strong>¥{currentReceivable.totalAmount.toLocaleString()}
                </Col>
              </Row>
            </Card>

            <Form
              form={receiptForm}
              layout="vertical"
              onFinish={handleReceiptSubmit}
            >
              <Form.Item
                name="paymentMethod"
                label="收款方式"
                rules={[{ required: true, message: '请选择收款方式' }]}
              >
                <Select placeholder="请选择收款方式">
                  <Select.Option value="bank_transfer">银行转账</Select.Option>
                  <Select.Option value="check">支票</Select.Option>
                  <Select.Option value="cash">现金</Select.Option>
                  <Select.Option value="alipay">支付宝</Select.Option>
                  <Select.Option value="wechat">微信支付</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="paymentDate"
                label="收款日期"
                rules={[{ required: true, message: '请选择收款日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="选择收款日期"
                />
              </Form.Item>

              <Form.Item
                name="remarks"
                label="收款备注"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="请输入收款备注信息"
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        title={`应收单详情 - ${receivableDetail?.receivableCode}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {receivableDetail && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>应收单号：</strong>{receivableDetail.receivableCode}
                </Col>
                <Col span={12}>
                  <strong>销售订单：</strong>{receivableDetail.salesOrderCode || '无'}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>客户：</strong>{receivableDetail.customerName}
                </Col>
                <Col span={12}>
                  <strong>状态：</strong>
                  <Tag color={
                    receivableDetail.status === 'received' ? 'success' :
                    receivableDetail.status === 'confirmed' ? 'processing' :
                    receivableDetail.status === 'overdue' ? 'error' : 'default'
                  }>
                    {receivableDetail.status === 'received' ? '已收款' :
                     receivableDetail.status === 'confirmed' ? '待收款' :
                     receivableDetail.status === 'overdue' ? '逾期' : '草稿'}
                  </Tag>
                </Col>
              </Row>
            </Card>

            <Card title="财务信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <strong>数量：</strong>{receivableDetail.quantity}
                </Col>
                <Col span={8}>
                  <strong>单价：</strong>¥{receivableDetail.unitPrice.toFixed(2)}
                </Col>
                <Col span={8}>
                  <strong>总金额：</strong>¥{receivableDetail.totalAmount.toLocaleString()}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <strong>税率：</strong>{receivableDetail.taxRate}%
                </Col>
                <Col span={8}>
                  <strong>税额：</strong>¥{receivableDetail.taxAmount.toFixed(2)}
                </Col>
                <Col span={8}>
                  <strong>净额：</strong>¥{receivableDetail.netAmount.toFixed(2)}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>到期日期：</strong>{receivableDetail.dueDate}
                </Col>
                <Col span={12}>
                  <strong>货币：</strong>{receivableDetail.currency}
                </Col>
              </Row>
            </Card>

            {receivableDetail.status === 'received' && (
              <Card title="收款信息">
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>收款方式：</strong>{receivableDetail.paymentMethod}
                  </Col>
                  <Col span={12}>
                    <strong>收款日期：</strong>{receivableDetail.paymentDate}
                  </Col>
                </Row>
                {receivableDetail.remarks && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>备注：</strong>{receivableDetail.remarks}
                    </Col>
                  </Row>
                )}
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default AccountsReceivablePage;
