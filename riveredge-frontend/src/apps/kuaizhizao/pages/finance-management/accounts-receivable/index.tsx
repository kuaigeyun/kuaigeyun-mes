/**
 * 应收管理页面
 *
 * 提供销售出库后自动生成应收单的管理功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Row, Col, Table } from 'antd';
import { DollarOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { financeApi } from '../../../services/production';
import { getDocumentRelations } from '../../../services/document-relation';

// 应收单接口定义
interface AccountsReceivable {
  id?: number;
  tenant_id?: number;
  receivable_code?: string;
  source_type?: string;
  source_id?: number;
  source_code?: string;
  customer_id?: number;
  customer_name?: string;
  total_amount?: number;
  received_amount?: number;
  remaining_amount?: number;
  due_date?: string;
  payment_terms?: string;
  status?: string;
  business_date?: string;
  invoice_issued?: boolean;
  invoice_number?: string;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const AccountsReceivablePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 收款Modal状态
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [currentReceivable, setCurrentReceivable] = useState<AccountsReceivable | null>(null);
  const formRef = useRef<any>(null);

  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [receivableDetail, setReceivableDetail] = useState<AccountsReceivable | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelation | null>(null);

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
    formRef.current?.setFieldsValue({
      paymentMethod: 'bank_transfer',
      paymentDate: null,
      remarks: '',
    });
  };

  // 处理收款提交
  const handleReceiptSubmit = async (values: any) => {
    try {
      if (currentReceivable?.id) {
        await financeApi.receivable.recordReceipt(currentReceivable.id.toString(), {
          receipt_amount: currentReceivable.remaining_amount || currentReceivable.total_amount || 0,
          receipt_method: values.paymentMethod,
          receipt_date: values.paymentDate,
          remarks: values.remarks,
        });
      }

      messageApi.success('收款记录成功');
      setReceiptModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '收款失败');
      throw error;
    }
  };

  // 处理详情查看
  const handleDetail = async (record: AccountsReceivable) => {
    try {
      const detail = await financeApi.receivable.get(record.id!.toString());
      setReceivableDetail(detail);
      
      // 获取单据关联关系
      try {
        const relations = await getDocumentRelations('receivable', record.id!);
        setDocumentRelations(relations);
      } catch (error) {
        console.error('获取单据关联关系失败:', error);
        setDocumentRelations(null);
      }
      
      setDetailVisible(true);
    } catch (error) {
      messageApi.error('获取应收单详情失败');
    }
  };

  // 表格列定义
  const columns: ProColumns<AccountsReceivable>[] = [
    {
      title: '应收单号',
      dataIndex: 'receivable_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '来源单据',
      dataIndex: 'source_code',
      width: 120,
      render: (text) => text ? <Tag color="blue">{text}</Tag> : <span style={{ color: '#999' }}>无</span>,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '应收金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '已收金额',
      dataIndex: 'received_amount',
      width: 120,
      align: 'right',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '剩余金额',
      dataIndex: ['total_amount', 'received_amount'],
      width: 120,
      align: 'right',
      render: (_, record) => {
        const remaining = (record.total_amount || 0) - (record.received_amount || 0);
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
          '未收款': { text: '未收款', color: 'default' },
          '部分收款': { text: '部分收款', color: 'processing' },
          '已结清': { text: '已结清', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap['未收款'];
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
              onClick={() => handleReceipt(record)}
            >
              收款
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '总应收金额',
          value: stats.totalReceivable,
          prefix: '¥',
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '已收金额',
          value: stats.receivedAmount,
          prefix: '¥',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '待收金额',
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
      <UniTable<AccountsReceivable>
          headerTitle="应收管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await financeApi.receivable.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                customer_id: params.customer_id,
                ...params,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取应收单列表失败');
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

      <FormModalTemplate
        title={`收款确认 - ${currentReceivable?.receivable_code || ''}`}
        open={receiptModalVisible}
        onClose={() => setReceiptModalVisible(false)}
        onFinish={handleReceiptSubmit}
        isEdit={false}
        width={MODAL_CONFIG.SMALL_WIDTH}
        formRef={formRef}
      >
        {currentReceivable && (
          <Card title="收款信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>客户：</strong>{currentReceivable.customer_name}
              </Col>
              <Col span={12}>
                <strong>来源单据：</strong>{currentReceivable.source_code || '无'}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>应收金额：</strong>¥{(currentReceivable.total_amount || 0).toLocaleString()}
              </Col>
              <Col span={12}>
                <strong>剩余金额：</strong>¥{(currentReceivable.remaining_amount || 0).toLocaleString()}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormSelect
          name="paymentMethod"
          label="收款方式"
          placeholder="请选择收款方式"
          rules={[{ required: true, message: '请选择收款方式' }]}
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
          label="收款日期"
          placeholder="选择收款日期"
          rules={[{ required: true, message: '请选择收款日期' }]}
        />
        <ProFormTextArea
          name="remarks"
          label="收款备注"
          placeholder="请输入收款备注信息"
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`应收单详情 - ${receivableDetail?.receivable_code || ''}`}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setReceivableDetail(null);
          setDocumentRelations(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          receivableDetail ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>应收单号：</strong>{receivableDetail.receivable_code}
                  </Col>
                  <Col span={12}>
                    <strong>来源单据：</strong>{receivableDetail.source_code || '无'}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>客户：</strong>{receivableDetail.customer_name}
                  </Col>
                  <Col span={12}>
                    <strong>状态：</strong>
                    <Tag color={
                      receivableDetail.status === '已结清' ? 'success' :
                      receivableDetail.status === '部分收款' ? 'processing' :
                      receivableDetail.status === '已取消' ? 'error' : 'default'
                    }>
                      {receivableDetail.status || '未收款'}
                    </Tag>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <strong>到期日期：</strong>{receivableDetail.due_date || '-'}
                  </Col>
                  <Col span={12}>
                    <strong>业务日期：</strong>{receivableDetail.business_date || '-'}
                  </Col>
                </Row>
              </Card>

              <Card title="财务信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <strong>应收金额：</strong>¥{(receivableDetail.total_amount || 0).toLocaleString()}
                  </Col>
                  <Col span={12}>
                    <strong>已收金额：</strong>¥{(receivableDetail.received_amount || 0).toLocaleString()}
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={24}>
                    <strong>剩余金额：</strong>¥{(receivableDetail.remaining_amount || 0).toLocaleString()}
                  </Col>
                </Row>
                {receivableDetail.payment_terms && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>收款条件：</strong>{receivableDetail.payment_terms}
                    </Col>
                  </Row>
                )}
                {receivableDetail.notes && (
                  <Row style={{ marginTop: 8 }}>
                    <Col span={24}>
                      <strong>备注：</strong>{receivableDetail.notes}
                    </Col>
                  </Row>
                )}
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
    </ListPageTemplate>
  );
};

export default AccountsReceivablePage;
