/**
 * 付款单列表页
 *
 * 记录向供应商支付的款项，可用于核销应付单。
 */
import React, { useRef, useState, useEffect } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Space, Dropdown, Input, Table, Tag, Drawer, Descriptions, Spin } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { CheckOutlined, EyeOutlined, StopOutlined, PlusOutlined, DownOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import { payableService } from '../../../services/finance/payable';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import { paymentService } from '../../../services/finance/payment';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';
import { getStatusDisplay } from '../../../../kuaizhizao/constants/documentStatus';

interface PaymentVoucher {
  id: number;
  payment_code: string;
  supplier_id: number;
  supplier_name: string;
  total_amount: number;
  settled_amount: number;
  unsettled_amount: number;
  payment_date: string;
  payment_method: string;
  bank_account?: string;
  bank_account_id?: number;
  settlement_type?: string;
  status: string;
  notes?: string;
  created_at: string;
}

type PullPayableCandidate = {
  id: number;
  payable_code: string;
  supplier_id: number;
  supplier_name: string;
  due_date?: string;
  review_status?: string;
  status?: string;
  remaining_amount: number;
};

const PAYMENT_METHOD_OPTIONS = [
  { label: '银行转账', value: '银行转账' },
  { label: '现金', value: '现金' },
  { label: '承兑汇票', value: '承兑汇票' },
  { label: '支票', value: '支票' },
  { label: '在线支付', value: '在线支付' },
  { label: '其他', value: '其他' },
];

const PaymentsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullVisible, setPullVisible] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullKeyword, setPullKeyword] = useState('');
  const [pullCandidates, setPullCandidates] = useState<PullPayableCandidate[]>([]);
  const [selectedPullPayableId, setSelectedPullPayableId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pullFormVisible, setPullFormVisible] = useState(false);
  const [pullSelectedPayable, setPullSelectedPayable] = useState<PullPayableCandidate | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<PaymentVoucher | null>(null);
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const pullFromPayableAction = getKuaicaiwuDocumentAction('payment.pull_from_payable');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setSupplierOptions((Array.isArray(list) ? list : []).map((s: any) => ({
          label: s.name || s.supplier_name || s.code || String(s.id),
          value: s.id,
        })));
      } catch {
        setSupplierOptions([]);
      }
    };
    load();
    bankAccountService.list({ limit: 200, is_active: true }).then(setBankAccounts).catch(() => setBankAccounts([]));
  }, []);

  const bankAccountOptions = bankAccounts.map((a) => ({
    label: `${a.account_name} (${a.account_number})`,
    value: a.id,
    account_number: a.account_number,
  }));

  const resolveBankLabel = (id?: number) => {
    if (!id) return '—';
    const acc = bankAccounts.find((a) => a.id === id);
    return acc ? `${acc.account_name} (${acc.account_number})` : `#${id}`;
  };

  const openDetail = async (record: PaymentVoucher) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await paymentService.getPayment(record.id);
      setDetailRecord(detail);
    } catch (error: any) {
      messageApi.error(error.message || '加载详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    const bank = bankAccountOptions.find((o) => o.value === values.bank_account_id);
    const data = {
      supplier_id: values.supplier_id,
      supplier_name: supplierOptions.find(o => o.value === values.supplier_id)?.label || '',
      total_amount: values.total_amount,
      payment_date: values.payment_date?.format ? values.payment_date.format('YYYY-MM-DD') : values.payment_date || dayjs().format('YYYY-MM-DD'),
      payment_method: values.payment_method,
      bank_account_id: values.bank_account_id,
      bank_account: bank?.account_number || values.bank_account,
      settlement_type: values.settlement_type || 'normal',
      notes: values.notes,
    };
    await apiRequest('/apps/kuaicaiwu/payments', { method: 'POST', data });
    messageApi.success('付款单创建成功');
    setCreateModalVisible(false);
    actionRef.current?.reload();
  };

  const loadPullPayableCandidates = async (keyword = '') => {
    setPullLoading(true);
    try {
      const kw = keyword.trim().toLowerCase();
      const res = await payableService.listPayables({ skip: 0, limit: 200, pending_settlement: true });
      const rows = (res?.items || [])
        .map((r: any) => ({
          id: Number(r.id),
          payable_code: String(r.payable_code || ''),
          supplier_id: Number(r.supplier_id),
          supplier_name: String(r.supplier_name || ''),
          due_date: r.due_date,
          review_status: r.review_status,
          status: r.status,
          remaining_amount: Number(r.remaining_amount || 0),
        }))
        .filter((r: PullPayableCandidate) => {
          if (!kw) return true;
          return `${r.payable_code} ${r.supplier_name}`.toLowerCase().includes(kw);
        });
      setPullCandidates(rows);
    } catch (e: any) {
      setPullCandidates([]);
      messageApi.error(e?.response?.data?.detail || e?.message || '加载应付单失败');
    } finally {
      setPullLoading(false);
    }
  };

  const handleOpenPullFromPayable = async () => {
    setPullKeyword('');
    setSelectedPullPayableId(null);
    setPullVisible(true);
    await loadPullPayableCandidates('');
  };

  const handlePullNext = () => {
    if (!selectedPullPayableId) {
      messageApi.warning(`请选择${pullFromPayableAction.sourceLabel}`);
      return;
    }
    const selected = pullCandidates.find((x) => x.id === selectedPullPayableId);
    if (!selected) return;
    if (selected.remaining_amount <= 0) {
      messageApi.warning(`${pullFromPayableAction.sourceLabel}剩余应付为 0，无法创建${pullFromPayableAction.targetLabel}`);
      return;
    }
    setPullSelectedPayable(selected);
    setPullVisible(false);
    setPullFormVisible(true);
  };

  const handlePullCreateSubmit = async (values: any) => {
    if (!pullSelectedPayable) return false;
    const totalAmount = Number(values.total_amount) || 0;
    if (totalAmount <= 0) {
      messageApi.warning('付款金额必须大于 0');
      return false;
    }
    setPullSubmitting(true);
    try {
      await apiRequest('/apps/kuaicaiwu/payments', {
        method: 'POST',
        data: {
          supplier_id: pullSelectedPayable.supplier_id,
          supplier_name: pullSelectedPayable.supplier_name,
          total_amount: totalAmount,
          payment_date: values.payment_date?.format
            ? values.payment_date.format('YYYY-MM-DD')
            : (values.payment_date || dayjs().format('YYYY-MM-DD')),
          payment_method: values.payment_method || '银行转账',
          bank_account_id: values.bank_account_id,
          bank_account: bankAccountOptions.find((o) => o.value === values.bank_account_id)?.account_number || values.bank_account,
          settlement_type: values.settlement_type || 'normal',
          notes: String(values.notes ?? '').trim() || `从${pullFromPayableAction.sourceLabel} ${pullSelectedPayable.payable_code} 创建`,
        },
      });
      messageApi.success(`已创建${pullFromPayableAction.targetLabel}`);
      setPullFormVisible(false);
      setPullSelectedPayable(null);
      setSelectedPullPayableId(null);
      actionRef.current?.reload();
      return true;
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || '创建失败');
      return false;
    } finally {
      setPullSubmitting(false);
    }
  };

  const handleConfirm = async (record: PaymentVoucher) => {
    Modal.confirm({
      title: '确认付款单',
      content: `确定要确认付款单 ${record.payment_code} 吗？确认后不可修改。`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/payments/${record.id}/confirm`, { method: 'POST' });
          messageApi.success('确认成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const handleCancelVoucher = async (record: PaymentVoucher) => {
    Modal.confirm({
      title: '作废付款单',
      content: `确定要作废付款单 ${record.payment_code} 吗？已核销的付款单不能作废。`,
      onOk: async () => {
        try {
          await apiRequest(`/apps/kuaicaiwu/payments/${record.id}/cancel`, { method: 'POST' });
          messageApi.success('作废成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const handleBatchConfirm = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await apiRequest(`/apps/kuaicaiwu/payments/${key}/confirm`, { method: 'POST' });
      }
      messageApi.success(`已确认 ${keys.length} 条付款单`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '批量确认失败');
    }
  };

  const handleBatchCancel = async (keys: React.Key[]) => {
    try {
      for (const key of keys) {
        await apiRequest(`/apps/kuaicaiwu/payments/${key}/cancel`, { method: 'POST' });
      }
      messageApi.success(`已作废 ${keys.length} 条付款单`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '批量作废失败');
    }
  };

  const columns: ProColumns<PaymentVoucher>[] = [
    {
      title: '付款单号',
      dataIndex: 'payment_code',
      width: 168,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.payment_code ?? '') }} ellipsis>
          {r.payment_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '供应商名称',
      dataIndex: 'supplier_name',
      width: 200,
    },
    {
      title: '付款总额',
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
      title: '付款日期',
      dataIndex: 'payment_date',
      valueType: 'date',
      width: 110,
    },
    {
      title: '付款方式',
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
      dataIndex: 'lifecycle_stage',
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
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="det" onClick={() => openDetail(record)}>
              详情
            </Button>,
            record.status === 'Draft' ? (
              <Button {...rowActionKind('audit')} key="cf" onClick={() => handleConfirm(record)}>
                确认
              </Button>
            ) : null,
            record.status === 'Confirmed' ? (
              <Button {...rowActionKind('submit')} key="st" onClick={() => navigate(`/apps/kuaicaiwu/finance-management/settlement`)}>
                核销
              </Button>
            ) : null,
            record.status !== 'Cancelled' && record.settled_amount === 0 ? (
              <Button {...rowActionKind('revoke')} key="ca" onClick={() => handleCancelVoucher(record)}>
                作废
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<PaymentVoucher>
        headerTitle="付款单管理"
        actionRef={actionRef}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.payments"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText="新建付款单"
        onCreate={() => setCreateModalVisible(true)}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="payment-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText="批量操作"
            menuItems={[
              {
                key: 'batch-confirm',
                label: '批量确认',
                requireConfirm: true,
                confirmTitle: (count) => `确认批量确认 ${count} 条付款单`,
                confirmDescription: '仅草稿付款单可确认，不满足条件的记录会由后端拒绝。',
                onClick: handleBatchConfirm,
              },
              {
                key: 'batch-cancel',
                label: '批量作废',
                requireConfirm: true,
                confirmTitle: (count) => `确认批量作废 ${count} 条付款单`,
                confirmDescription: '已核销的付款单不能作废，不满足条件的记录会由后端拒绝。',
                onClick: handleBatchCancel,
              },
            ]}
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-payment-with-pull"
            createIcon={<PlusOutlined />}
            createLabel="新建付款单"
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-payable',
                actionKey: 'payment.pull_from_payable',
                onClick: () => {
                  void handleOpenPullFromPayable();
                },
              },
            ])}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/payments', {
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

      <Modal
        title={pullFromPayableAction.label}
        open={pullVisible}
        width={1100}
        onCancel={() => {
          if (pullSubmitting) return;
          setPullVisible(false);
          setSelectedPullPayableId(null);
        }}
        onOk={() => {
          void handlePullNext();
        }}
        okText="下一步"
        confirmLoading={false}
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按应付单号/供应商搜索"
            value={pullKeyword}
            onChange={(e) => setPullKeyword(e.target.value)}
            onSearch={(value) => {
              setPullKeyword(value);
              void loadPullPayableCandidates(value);
            }}
            enterButton="搜索"
          />
          <Table<PullPayableCandidate>
            rowKey="id"
            loading={pullLoading}
            dataSource={pullCandidates}
            pagination={false}
            scroll={{ x: 980, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullPayableId ? [selectedPullPayableId] : [],
              onChange: (keys) => setSelectedPullPayableId(Number(keys?.[0]) || null),
            }}
            onRow={(record) => ({
              onClick: () => setSelectedPullPayableId(record.id),
            })}
            columns={[
              { title: '应付单号', dataIndex: 'payable_code', width: 220, ellipsis: true },
              { title: '供应商', dataIndex: 'supplier_name', width: 220, ellipsis: true },
              {
                title: '业务状态',
                dataIndex: 'status',
                width: 120,
                align: 'center',
                render: (v) => {
                  const { text, color } = getStatusDisplay(v);
                  return text === '-' ? '-' : <Tag color={color}>{text}</Tag>;
                },
              },
              { title: '审核状态', dataIndex: 'review_status', width: 120, align: 'center' },
              { title: '到期日期', dataIndex: 'due_date', width: 120, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              {
                title: '剩余应付',
                dataIndex: 'remaining_amount',
                width: 140,
                align: 'right',
                render: (v) => `¥${Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
              },
              {
                title: '可转单',
                key: 'can_create',
                width: 100,
                align: 'center',
                render: (_, r) => (Number(r.remaining_amount || 0) > 0 ? <Tag color="success">可创建</Tag> : <Tag>不可创建</Tag>),
              },
            ]}
          />
        </Space>
      </Modal>

      <ModalForm
        title="填写付款单信息"
        open={pullFormVisible}
        onOpenChange={(open) => {
          if (pullSubmitting) return;
          setPullFormVisible(open);
          if (!open) {
            setPullSelectedPayable(null);
            setSelectedPullPayableId(null);
          }
        }}
        onFinish={handlePullCreateSubmit}
        width={480}
        modalProps={{ destroyOnHidden: true }}
        submitter={{ submitButtonProps: { loading: pullSubmitting } }}
        initialValues={
          pullSelectedPayable
            ? {
                payable_code: pullSelectedPayable.payable_code,
                supplier_name: pullSelectedPayable.supplier_name,
                total_amount: pullSelectedPayable.remaining_amount,
                payment_date: dayjs(),
                payment_method: '银行转账',
                notes: `从${pullFromPayableAction.sourceLabel} ${pullSelectedPayable.payable_code} 创建`,
              }
            : undefined
        }
      >
        <ProFormText name="payable_code" label="来源应付单" readonly />
        <ProFormText name="supplier_name" label="供应商" readonly />
        <ProFormMoney
          name="total_amount"
          label="付款金额"
          min={0.01}
          rules={[{ required: true }]}
          fieldProps={{ max: pullSelectedPayable?.remaining_amount }}
        />
        <ProFormDatePicker name="payment_date" label="付款日期" rules={[{ required: true }]} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label="付款方式"
          options={PAYMENT_METHOD_OPTIONS}
          rules={[{ required: true, message: '请选择付款方式' }]}
        />
        <ProFormSelect
          name="settlement_type"
          label="结算类型"
          initialValue="normal"
          options={[
            { label: '普通付款', value: 'normal' },
            { label: '预付款', value: 'prepayment' },
          ]}
        />
        <ProFormSelect
          name="bank_account_id"
          label="出账银行账户"
          options={bankAccountOptions}
          placeholder="选择后确认付款将自动记银行流水"
          showSearch
          allowClear
        />
        <ProFormText name="bank_account" label="出款账号（备注）" placeholder="未选银行账户时可手工填写" />
        <ProFormTextArea name="notes" label="备注" />
      </ModalForm>

      <ModalForm
        title="新建付款单"
        open={createModalVisible}
        onOpenChange={setCreateModalVisible}
        onFinish={handleCreate}
        width={480}
      >
        <ProFormSelect
          name="supplier_id"
          label="供应商"
          options={supplierOptions}
          rules={[{ required: true, message: '请选择供应商' }]}
          placeholder="请选择供应商"
          showSearch
        />
        <ProFormMoney name="total_amount" label="付款金额" min={0.01} rules={[{ required: true }]} />
        <ProFormDatePicker name="payment_date" label="付款日期" rules={[{ required: true }]} initialValue={dayjs()} fieldProps={{ style: { width: '100%' } }} />
        <ProFormSelect
          name="payment_method"
          label="付款方式"
          options={PAYMENT_METHOD_OPTIONS}
          rules={[{ required: true, message: '请选择付款方式' }]}
          placeholder="请选择付款方式"
        />
        <ProFormSelect
          name="settlement_type"
          label="结算类型"
          initialValue="normal"
          options={[
            { label: '普通付款', value: 'normal' },
            { label: '预付款', value: 'prepayment' },
          ]}
        />
        <ProFormSelect
          name="bank_account_id"
          label="出账银行账户"
          options={bankAccountOptions}
          placeholder="选择后确认付款将自动记银行流水"
          showSearch
          allowClear
        />
        <ProFormText name="bank_account" label="出款账号（备注）" placeholder="未选银行账户时可手工填写" />
        <ProFormTextArea name="notes" label="备注" />
      </ModalForm>

      <Drawer
        title={detailRecord ? `付款单 · ${detailRecord.payment_code}` : '付款单详情'}
        open={detailOpen}
        size={520}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          {detailRecord ? (
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="单号">{detailRecord.payment_code}</Descriptions.Item>
              <Descriptions.Item label="供应商">{detailRecord.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="状态">{detailRecord.status}</Descriptions.Item>
              <Descriptions.Item label="付款日期">{detailRecord.payment_date}</Descriptions.Item>
              <Descriptions.Item label="付款方式">{detailRecord.payment_method}</Descriptions.Item>
              <Descriptions.Item label="结算类型">
                {detailRecord.settlement_type === 'prepayment' ? '预付款' : '普通付款'}
              </Descriptions.Item>
              <Descriptions.Item label="付款金额">¥{Number(detailRecord.total_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="已核销">¥{Number(detailRecord.settled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="未核销">¥{Number(detailRecord.unsettled_amount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="银行账户">{resolveBankLabel(detailRecord.bank_account_id)}</Descriptions.Item>
              <Descriptions.Item label="账号备注">{detailRecord.bank_account || '—'}</Descriptions.Item>
              <Descriptions.Item label="备注">{detailRecord.notes || '—'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detailRecord.created_at ? dayjs(detailRecord.created_at).format('YYYY-MM-DD HH:mm') : '—'}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Spin>
      </Drawer>
    </ListPageTemplate>
  );
};

export default PaymentsPage;
