/**
 * 应付管理页面
 *
 * 提供采购入库后自动生成应付单的管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Form, Card, Row, Col, Statistic, Input, Select, DatePicker } from 'antd';
import { DollarOutlined, EyeOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';

// 应付单接口定义
interface AccountsPayable {
  id: number;
  payableCode: string;
  purchaseOrderCode: string;
  supplierName: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  dueDate: string;
  status: 'draft' | 'confirmed' | 'paid' | 'overdue';
  paymentMethod?: string;
  paymentDate?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

const AccountsPayablePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 付款Modal状态
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [currentPayable, setCurrentPayable] = useState<AccountsPayable | null>(null);
  const [paymentForm] = Form.useForm();

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [payableDetail, setPayableDetail] = useState<AccountsPayable | null>(null);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalPayable: 125680,
    paidAmount: 89650,
    pendingAmount: 36030,
    overdueAmount: 8500,
  });

  // 处理付款
  const handlePayment = (record: AccountsPayable) => {
    setCurrentPayable(record);
    setPaymentModalVisible(true);

    paymentForm.setFieldsValue({
      paymentMethod: 'bank_transfer',
      paymentDate: null,
      remarks: '',
    });
  };

  // 处理付款提交
  const handlePaymentSubmit = async (values: any) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      messageApi.success(`付款成功：¥${currentPayable?.totalAmount.toLocaleString()}`);

      setPaymentModalVisible(false);
      paymentForm.resetFields();
      actionRef.current?.reload();

      // 更新统计数据
      setStats(prev => ({
        ...prev,
        paidAmount: prev.paidAmount + currentPayable!.totalAmount,
        pendingAmount: Math.max(0, prev.pendingAmount - currentPayable!.totalAmount),
      }));

    } catch (error: any) {
      messageApi.error(error.message || '付款失败');
    }
  };

  // 处理详情查看
  const handleDetail = (record: AccountsPayable) => {
    setPayableDetail(record);
    setDetailVisible(true);
  };

  // 表格列定义
  const columns: ProColumns<AccountsPayable>[] = [
    {
      title: '应付单号',
      dataIndex: 'payableCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '采购订单',
      dataIndex: 'purchaseOrderCode',
      width: 120,
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
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
          confirmed: { text: '待付款', color: 'processing' },
          paid: { text: '已付款', color: 'success' },
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
              onClick={() => handlePayment(record)}
            >
              付款
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
                  title="总应付金额"
                  value={stats.totalPayable}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已付金额"
                  value={stats.paidAmount}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待付金额"
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
        <UniTable<AccountsPayable>
          headerTitle="应付管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: AccountsPayable[] = [
              {
                id: 1,
                payableCode: 'PAY20251229001',
                purchaseOrderCode: 'PO20251229001',
                supplierName: '供应商A',
                materialCode: 'RAW001',
                materialName: '螺丝A',
                quantity: 1000,
                unitPrice: 2.5,
                totalAmount: 2500,
                taxRate: 13,
                taxAmount: 325,
                netAmount: 2825,
                currency: 'CNY',
                dueDate: '2025-12-31',
                status: 'confirmed',
                createdAt: '2025-12-29 10:00:00',
                updatedAt: '2025-12-29 10:00:00',
              },
              {
                id: 2,
                payableCode: 'PAY20251229002',
                purchaseOrderCode: 'PO20251229002',
                supplierName: '供应商B',
                materialCode: 'RAW002',
                materialName: '螺母B',
                quantity: 500,
                unitPrice: 1.8,
                totalAmount: 900,
                taxRate: 13,
                taxAmount: 117,
                netAmount: 1017,
                currency: 'CNY',
                dueDate: '2025-12-25',
                status: 'overdue',
                createdAt: '2025-12-20 09:00:00',
                updatedAt: '2025-12-20 09:00:00',
              },
              {
                id: 3,
                payableCode: 'PAY20251229003',
                purchaseOrderCode: 'PO20251229003',
                supplierName: '供应商C',
                materialCode: 'RAW003',
                materialName: '垫片C',
                quantity: 200,
                unitPrice: 3.2,
                totalAmount: 640,
                taxRate: 13,
                taxAmount: 83.2,
                netAmount: 723.2,
                currency: 'CNY',
                dueDate: '2026-01-05',
                status: 'paid',
                paymentMethod: '银行转账',
                paymentDate: '2025-12-28',
                createdAt: '2025-12-25 14:00:00',
                updatedAt: '2025-12-28 11:00:00',
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
              key="batch-payment"
              type="primary"
              icon={<DollarOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={() => messageApi.info('批量付款功能开发中...')}
            >
              批量付款
            </Button>,
          ]}
          scroll={{ x: 1400 }}
        />
      </div>

      {/* 付款Modal */}
      <Modal
        title={`付款确认 - ${currentPayable?.payableCode}`}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={() => paymentForm.submit()}
        okText="确认付款"
        cancelText="取消"
        width={500}
      >
        {currentPayable && (
          <div style={{ marginBottom: 24 }}>
            <Card title="付款信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>供应商：</strong>{currentPayable.supplierName}
                </Col>
                <Col span={12}>
                  <strong>采购订单：</strong>{currentPayable.purchaseOrderCode}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>物料：</strong>{currentPayable.materialName}
                </Col>
                <Col span={12}>
                  <strong>应付金额：</strong>¥{currentPayable.totalAmount.toLocaleString()}
                </Col>
              </Row>
            </Card>

            <Form
              form={paymentForm}
              layout="vertical"
              onFinish={handlePaymentSubmit}
            >
              <Form.Item
                name="paymentMethod"
                label="付款方式"
                rules={[{ required: true, message: '请选择付款方式' }]}
              >
                <Select placeholder="请选择付款方式">
                  <Select.Option value="bank_transfer">银行转账</Select.Option>
                  <Select.Option value="check">支票</Select.Option>
                  <Select.Option value="cash">现金</Select.Option>
                  <Select.Option value="alipay">支付宝</Select.Option>
                  <Select.Option value="wechat">微信支付</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="paymentDate"
                label="付款日期"
                rules={[{ required: true, message: '请选择付款日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="选择付款日期"
                />
              </Form.Item>

              <Form.Item
                name="remarks"
                label="付款备注"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="请输入付款备注信息"
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        title={`应付单详情 - ${payableDetail?.payableCode}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {payableDetail && (
          <div>
            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <strong>应付单号：</strong>{payableDetail.payableCode}
                </Col>
                <Col span={12}>
                  <strong>采购订单：</strong>{payableDetail.purchaseOrderCode}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>供应商：</strong>{payableDetail.supplierName}
                </Col>
                <Col span={12}>
                  <strong>状态：</strong>
                  <Tag color={
                    payableDetail.status === 'paid' ? 'success' :
                    payableDetail.status === 'confirmed' ? 'processing' :
                    payableDetail.status === 'overdue' ? 'error' : 'default'
                  }>
                    {payableDetail.status === 'paid' ? '已付款' :
                     payableDetail.status === 'confirmed' ? '待付款' :
                     payableDetail.status === 'overdue' ? '逾期' : '草稿'}
                  </Tag>
                </Col>
              </Row>
            </Card>

            <Card title="财务信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <strong>数量：</strong>{payableDetail.quantity}
                </Col>
                <Col span={8}>
                  <strong>单价：</strong>¥{payableDetail.unitPrice.toFixed(2)}
                </Col>
                <Col span={8}>
                  <strong>总金额：</strong>¥{payableDetail.totalAmount.toLocaleString()}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <strong>税率：</strong>{payableDetail.taxRate}%
                </Col>
                <Col span={8}>
                  <strong>税额：</strong>¥{payableDetail.taxAmount.toFixed(2)}
                </Col>
                <Col span={8}>
                  <strong>净额：</strong>¥{payableDetail.netAmount.toFixed(2)}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <strong>到期日期：</strong>{payableDetail.dueDate}
                </Col>
                <Col span={12}>
                  <strong>货币：</strong>{payableDetail.currency}
                </Col>
              </Row>
            </Card>

            {payableDetail.status === 'paid' && (
              <Card title="付款信息">
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>付款方式：</strong>{payableDetail.paymentMethod}
                  </Col>
                  <Col span={12}>
                    <strong>付款日期：</strong>{payableDetail.paymentDate}
                  </Col>
                </Row>
                {payableDetail.remarks && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>备注：</strong>{payableDetail.remarks}
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

export default AccountsPayablePage;
