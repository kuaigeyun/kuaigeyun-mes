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
import { financeApi } from '../../../services/production';

// 应付单接口定义
interface AccountsPayable {
  id?: number;
  tenant_id?: number;
  payable_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  total_amount?: number;
  paid_amount?: number;
  due_date?: string;
  status?: string;
  related_purchase_order_id?: number;
  related_purchase_receipt_id?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
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
      if (currentPayable?.id) {
        await financeApi.payable.recordPayment(currentPayable.id.toString(), {
          payment_amount: values.paymentAmount,
          payment_method: values.paymentMethod,
          payment_date: values.paymentDate,
          remarks: values.remarks,
        });
      }

      messageApi.success('付款记录成功');

      setPaymentModalVisible(false);
      paymentForm.resetFields();
      actionRef.current?.reload();

    } catch (error: any) {
      messageApi.error('付款记录失败');
    }
  };

  // 处理详情查看
  const handleDetail = async (record: AccountsPayable) => {
    try {
      const detail = await financeApi.payable.get(record.id!.toString());
      setPayableDetail(detail);
      setDetailVisible(true);
    } catch (error) {
      messageApi.error('获取应付单详情失败');
    }
  };

  // 表格列定义
  const columns: ProColumns<AccountsPayable>[] = [
    {
      title: '应付单号',
      dataIndex: 'payable_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '应付金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '已付金额',
      dataIndex: 'paid_amount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '剩余金额',
      dataIndex: ['total_amount', 'paid_amount'],
      width: 120,
      align: 'right',
      render: (_, record) => {
        const remaining = (record.total_amount || 0) - (record.paid_amount || 0);
        return `¥${remaining.toLocaleString()}`;
      },
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
          '草稿': { text: '草稿', color: 'default' },
          '已审核': { text: '已审核', color: 'processing' },
          '已结清': { text: '已结清', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['草稿'];
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
          {record.status === '已审核' && (
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
            try {
              const response = await financeApi.payable.list({
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
              messageApi.error('获取应付单列表失败');
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
