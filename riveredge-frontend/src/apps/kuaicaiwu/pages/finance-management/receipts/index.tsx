/**
 * 收款单列表页
 *
 * 记录从客户收取的款项，可用于核销应收单。
 */
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Modal, Typography, Space, Dropdown, Input, Table, Tag } from 'antd';
import { ModalForm, ProFormDatePicker, ProFormMoney, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { EyeOutlined, CheckOutlined, StopOutlined, PlusOutlined, DownOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import dayjs from 'dayjs';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import { renderRowActionsOverflow } from '../../../utils/renderRowActionsOverflow';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';
import { buildKuaicaiwuPullCreateMenuItems, getKuaicaiwuDocumentAction } from '../../../constants/documentActionRegistry';

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

type PullReceivableCandidate = {
  id: number;
  receivable_code: string;
  customer_id: number;
  customer_name: string;
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

const ReceiptsPage: React.FC = () => {
  const actionRef = useRef<ActionType>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullVisible, setPullVisible] = useState(false);
  const [pullLoading, setPullLoading] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullKeyword, setPullKeyword] = useState('');
  const [pullCandidates, setPullCandidates] = useState<PullReceivableCandidate[]>([]);
  const [selectedPullReceivableId, setSelectedPullReceivableId] = useState<number | null>(null);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const pullFromReceivableAction = getKuaicaiwuDocumentAction('receipt.pull_from_receivable');

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

  const loadPullReceivableCandidates = async (keyword = '') => {
    setPullLoading(true);
    try {
      const kw = keyword.trim().toLowerCase();
      const res = await receivableService.listReceivables({ skip: 0, limit: 200 });
      const rows = (res?.items || [])
        .filter((r: any) => Number(r?.remaining_amount || 0) > 0)
        .map((r: any) => ({
          id: Number(r.id),
          receivable_code: String(r.receivable_code || ''),
          customer_id: Number(r.customer_id),
          customer_name: String(r.customer_name || ''),
          due_date: r.due_date,
          review_status: r.review_status,
          status: r.status,
          remaining_amount: Number(r.remaining_amount || 0),
        }))
        .filter((r: PullReceivableCandidate) => {
          if (!kw) return true;
          return `${r.receivable_code} ${r.customer_name}`.toLowerCase().includes(kw);
        });
      setPullCandidates(rows);
    } catch {
      setPullCandidates([]);
    } finally {
      setPullLoading(false);
    }
  };

  const handleOpenPullFromReceivable = async () => {
    setPullKeyword('');
    setSelectedPullReceivableId(null);
    setPullVisible(true);
    await loadPullReceivableCandidates('');
  };

  const handlePullConfirm = async () => {
    if (!selectedPullReceivableId) {
      messageApi.warning(`请选择${pullFromReceivableAction.sourceLabel}`);
      return;
    }
    const selected = pullCandidates.find((x) => x.id === selectedPullReceivableId);
    if (!selected) return;
    if (selected.remaining_amount <= 0) {
      messageApi.warning(`${pullFromReceivableAction.sourceLabel}剩余应收为 0，无法创建${pullFromReceivableAction.targetLabel}`);
      return;
    }
    setPullSubmitting(true);
    try {
      await apiRequest('/apps/kuaicaiwu/receipts', {
        method: 'POST',
        data: {
          customer_id: selected.customer_id,
          customer_name: selected.customer_name,
          total_amount: selected.remaining_amount,
          receipt_date: dayjs().format('YYYY-MM-DD'),
          payment_method: '银行转账',
          notes: `从${pullFromReceivableAction.sourceLabel} ${selected.receivable_code} 创建`,
        },
      });
      messageApi.success(`已创建${pullFromReceivableAction.targetLabel}`);
      setPullVisible(false);
      setSelectedPullReceivableId(null);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || '创建失败');
    } finally {
      setPullSubmitting(false);
    }
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
          await receiptService.cancelReceipt(record.id);
          messageApi.success('作废成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '操作失败');
        }
      },
    });
  };

  const handleDelete = async (record: ReceiptVoucher) => {
    Modal.confirm({
      title: '删除收款单',
      content: `确定删除收款单 ${record.receipt_code}？已确认的收款单不能删除，请使用作废。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await receiptService.deleteReceipt(record.id);
          messageApi.success('删除成功');
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
        renderRowActionsOverflow(
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
            record.status !== 'Confirmed' ? (
              <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                删除
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
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.receipts"
        scroll={{ x: 1680 }}
        showAdvancedSearch
        search={{ labelWidth: 120 }}
        showCreateButton={false}
        createButtonText="新建收款单"
        onCreate={() => setCreateModalVisible(true)}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-receipt-with-pull"
            createIcon={<PlusOutlined />}
            createLabel="新建收款单"
            onCreate={() => setCreateModalVisible(true)}
            menuItems={buildKuaicaiwuPullCreateMenuItems([
              {
                key: 'pull-from-receivable',
                actionKey: 'receipt.pull_from_receivable',
                onClick: () => {
                  void handleOpenPullFromReceivable();
                },
              },
            ])}
          />,
        ]}
        request={async (params, _sort, _filter, searchFormValues) => {
          const { current, pageSize, status, customer_id, start_date, end_date } = params;
          const res = await apiRequest<any>('/apps/kuaicaiwu/receipts', {
            params: {
              skip: ((current || 1) - 1) * (pageSize || 20),
              limit: pageSize || 20,
              status: searchFormValues?.status ?? status,
              customer_id: searchFormValues?.customer_id ?? customer_id,
              start_date: searchFormValues?.start_date ?? start_date,
              end_date: searchFormValues?.end_date ?? end_date,
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
        title={pullFromReceivableAction.label}
        open={pullVisible}
        width={1100}
        onCancel={() => {
          if (pullSubmitting) return;
          setPullVisible(false);
          setSelectedPullReceivableId(null);
        }}
        onOk={() => {
          void handlePullConfirm();
        }}
        okText={`创建${pullFromReceivableAction.targetLabel}`}
        confirmLoading={pullSubmitting}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按应收单号/客户搜索"
            value={pullKeyword}
            onChange={(e) => setPullKeyword(e.target.value)}
            onSearch={(value) => {
              setPullKeyword(value);
              void loadPullReceivableCandidates(value);
            }}
            enterButton="搜索"
          />
          <Table<PullReceivableCandidate>
            rowKey="id"
            loading={pullLoading}
            dataSource={pullCandidates}
            pagination={false}
            scroll={{ x: 980, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullReceivableId ? [selectedPullReceivableId] : [],
              onChange: (keys) => setSelectedPullReceivableId(Number(keys?.[0]) || null),
            }}
            onRow={(record) => ({
              onClick: () => setSelectedPullReceivableId(record.id),
            })}
            columns={[
              { title: '应收单号', dataIndex: 'receivable_code', width: 220, ellipsis: true },
              { title: '客户', dataIndex: 'customer_name', width: 220, ellipsis: true },
              { title: '业务状态', dataIndex: 'status', width: 120, align: 'center' },
              { title: '审核状态', dataIndex: 'review_status', width: 120, align: 'center' },
              { title: '到期日期', dataIndex: 'due_date', width: 120, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              {
                title: '剩余应收',
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
