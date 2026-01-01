/**
 * 应付管理页面
 *
 * 提供采购入库后自动生成应付单的管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col } from 'antd';
import { DollarOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
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
  const formRef = useRef<any>(null);

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
    formRef.current?.setFieldsValue({
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
          payment_amount: currentPayable.total_amount || 0,
          payment_method: values.paymentMethod,
          payment_date: values.paymentDate,
          remarks: values.remarks,
        });
      }

      messageApi.success('付款记录成功');
      setPaymentModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error('付款记录失败');
      throw error;
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
      dataIndex: 'due_date',
      width: 120,
      valueType: 'date',
      render: (date) => {
        if (!date) return '-';
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
    <ListPageTemplate
      statCards={[
        {
          title: '总应付金额',
          value: stats.totalPayable,
          prefix: '¥',
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '已付金额',
          value: stats.paidAmount,
          prefix: '¥',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '待付金额',
          value: stats.pendingAmount,
          prefix: '¥',
          valueStyle: { color: '#faad14' },
        },
        {
          title: '逾期金额',
          value: stats.overdueAmount,
          prefix: '¥',
          valueStyle: { color: '#f5222d' },
        },
      ]}
    >
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

      <FormModalTemplate
        title={`付款确认 - ${currentPayable?.payable_code || ''}`}
        open={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        onFinish={handlePaymentSubmit}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentPayable && (
          <Card title="付款信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>供应商：</strong>{currentPayable.supplier_name}
              </Col>
              <Col span={12}>
                <strong>应付金额：</strong>¥{currentPayable.total_amount?.toLocaleString() || 0}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormSelect
          name="paymentMethod"
          label="付款方式"
          placeholder="请选择付款方式"
          rules={[{ required: true, message: '请选择付款方式' }]}
          options={[
            { label: '银行转账', value: 'bank_transfer' },
            { label: '支票', value: 'check' },
            { label: '现金', value: 'cash' },
            { label: '支付宝', value: 'alipay' },
            { label: '微信支付', value: 'wechat' },
          ]}
        />
        <ProFormDatePicker
          name="paymentDate"
          label="付款日期"
          placeholder="选择付款日期"
          rules={[{ required: true, message: '请选择付款日期' }]}
        />
        <ProFormTextArea
          name="remarks"
          label="付款备注"
          placeholder="请输入付款备注信息"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`应付单详情 - ${payableDetail?.payable_code || ''}`}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={DRAWER_CONFIG.SMALL_WIDTH}
        columns={[]}
        customContent={
          payableDetail ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>应付单号：</strong>{payableDetail.payable_code}
                  </Col>
                  <Col span={12}>
                    <strong>供应商：</strong>{payableDetail.supplier_name}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>状态：</strong>
                    <Tag color={
                      payableDetail.status === '已结清' ? 'success' :
                      payableDetail.status === '已审核' ? 'processing' :
                      payableDetail.status === '已取消' ? 'error' : 'default'
                    }>
                      {payableDetail.status}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <strong>到期日期：</strong>{payableDetail.due_date || '-'}
                  </Col>
                </Row>
              </Card>

              <Card title="财务信息">
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>应付金额：</strong>¥{payableDetail.total_amount?.toLocaleString() || 0}
                  </Col>
                  <Col span={12}>
                    <strong>已付金额：</strong>¥{payableDetail.paid_amount?.toLocaleString() || 0}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <strong>剩余金额：</strong>¥{((payableDetail.total_amount || 0) - (payableDetail.paid_amount || 0)).toLocaleString()}
                  </Col>
                </Row>
                {payableDetail.notes && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>备注：</strong>{payableDetail.notes}
                    </Col>
                  </Row>
                )}
              </Card>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default AccountsPayablePage;
