/**
 * 收款单列表页
 *
 * 记录从客户收取的款项，可用于核销应收单。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsMax3 } from '../../../utils/renderRowActionsMax3';

interface ReceiptVoucher {
  id: number;
  receipt_code: string;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  receipt_date: string;
  payment_method: string;
  bank_account?: string;
  status: string;
  notes?: string;
  created_at: string;
}

const PAYMENT_METHOD_OPTIONS = [
  { label: '银行转账', value: '银行转账' },
  { label: '现金', value: '现金' },
  { label: '承兑汇票', value: '承兑汇票' },
  { label: '支票', value: '支票' },
  { label: '在线支付', value: '在线支付' },
  { label: '其他', value: '其他' },
];

const ReceiptsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setCustomerOptions((Array.isArray(list) ? list : []).map((c: any) => ({
          label: c.name || c.customer_name || c.code || String(c.id),
          value: c.id,
        })));
      } catch {
        setCustomerOptions([]);
      }
    };
    load();
  }, []);

  const handleCreate = async (values: any) => {
    const data = {
      customer_id: values.customer_id,
      customer_name: customerOptions.find(o => o.value === values.customer_id)?.label || '',
      total_amount: values.total_amount,
      receipt_date: values.receipt_date?.format ? values.receipt_date.format('YYYY-MM-DD') : values.receipt_date || dayjs().format('YYYY-MM-DD'),
      payment_method: values.payment_method,
      bank_account: values.bank_account,
      notes: values.notes,
    };
    await apiRequest('/apps/kuaicaiwu/receipts', { method: 'POST', data });
    messageApi.success('收款单创建成功');
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const handleConfirm = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: '确认收款单',
      content: `确定要确认收款单 ${record.receipt_code} 吗？确认后不可修改。`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/receipts/${record.id}/confirm`, { method: 'POST' });
          messageApi.success('确认成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const handleCancel = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: '作废收款单',
      content: `确定要作废收款单 ${record.receipt_code} 吗？已核销的收款单不能作废。`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/receipts/${record.id}/cancel`, { method: 'POST' });
          messageApi.success('作废成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const columns: ProColumns<ReceiptVoucher>[] = [
    {
      title: '收款单号',
      dataIndex: 'receipt_code',
      width: 168,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.receipt_code ?? '') }} ellipsis>
          {r.receipt_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 200,
    },
    {
      title: '收款总额',
      dataIndex: 'total_amount',
      valueType: 'money',
      align: 'right',
      width: 130,
    },
    {
      title: '已核销金额',
      dataIndex: 'settled_amount',
      valueType: 'money',
      align: 'right',
      width: 120,
    },
    {
      title: '待核销金额',
      dataIndex: 'unsettled_amount',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <span style={{ color: record.unsettled_amount > 0 ? '#1677ff' : 'inherit', fontWeight: 'bold' }}>
          ¥{Number(record.unsettled_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '收款日期',
      dataIndex: 'receipt_date',
      valueType: 'date',
      width: 110,
    },
    {
      title: '收款方式',
      dataIndex: 'payment_method',
      width: 110,
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        Draft: { text: '草稿' },
        Confirmed: { text: '已确认' },
        Cancelled: { text: '已作废' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      fixed: 'right',
      align: 'left',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        const lc = getFinanceVoucherLifecycle(record as unknown as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lc.percent}
            stageName={lc.stageName}
            status={lc.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, record) =>
        renderRowActionsMax3(
          [
            <Button key="det" type="link" size="small" icon={<EyeOutlined />} onClick={() => messageApi.info('收款单详情功能开发中')}>
              详情
            </Button>,
            record.status === 'Draft' ? (
              <Button key="cf" type="link" size="small" icon={<CheckOutlined />} onClick={() => handleConfirm(record)}>
                确认
              </Button>
            ) : null,
            record.status === 'Confirmed' ? (
              <Button key="st" type="link" size="small" onClick={() => navigate(`/apps/kuaicaiwu/finance-management/settlement`)}>
                核销
              </Button>
            ) : null,
            record.status !== 'Cancelled' && record.settled_amount === 0 ? (
              <Button key="ca" type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleCancel(record)}>
                作废
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
          `rcv-${record.id}`,
        ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ReceiptVoucher>
        headerTitle="收款单管理"
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="kuaicaiwu-finance-receipts"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton
        createButtonText="新建收款单"
        onCreate={() => setCreateModalVisible(true)}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/receipts', {
            params: {
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              ...rest,
            },
          });
          return {
            data: res?.items || [],
            total: res?.total || 0,
            success: true,
          };
        }}
        columns={columns}
      />

      <ModalForm
        title="新建收款单"
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={480}
      >
        <ProFormSelect
          name="customer_id"
          label="客户"
          options={customerOptions}
          rules={[{ required: true, message: '请选择客户' }]}
          placeholder="请选择客户"
          showSearch
        />
        <ProFormMoney name="total_amount" label="收款金额" min={0.01} rules={[{ required: true }]} />
        <ProFormDatePicker name="receipt_date" label="收款日期" rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label="收款方式"
          options={PAYMENT_METHOD_OPTIONS}
          rules={[{ required: true, message: '请选择收款方式' }]}
          placeholder="请选择收款方式"
        />
        <ProFormText name="bank_account" label="收款账号" placeholder="如：工商银行 622588****" />
        <ProFormTextArea name="notes" label="备注" />
      </ModalForm>
    </ListPageTemplate>
  );
};

export default ReceiptsPage;
