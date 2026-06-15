/**
 * 往来对账列表页
 */
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Modal,
  Typography,
  Space,
  Table,
  Tag,
  DatePicker,
  Select,
  Descriptions,
  Divider,
} from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import {
  partnerStatementService,
  PartnerStatement,
  PartnerStatementPreview,
  PARTNER_STATEMENT_STATUS_MAP,
} from '../../../services/finance/partnerStatement';
import { apiRequest } from '../../../../../services/api';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';

const money = (v: number | string | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PartnerStatementsPage: React.FC = () => {
  const customerActionRef = useRef<ActionType>();
  const supplierActionRef = useRef<ActionType>();
  const [activeTab, setActiveTab] = useState<'Customer' | 'Supplier'>('Customer');
  const [customerSelectedRowKeys, setCustomerSelectedRowKeys] = useState<React.Key[]>([]);
  const [supplierSelectedRowKeys, setSupplierSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PartnerStatementPreview | null>(null);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [period, setPeriod] = useState<Dayjs>(() => dayjs().subtract(1, 'month').startOf('month'));
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const [createForm] = ProForm.useForm();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();

  const partnerType = activeTab;

  useEffect(() => {
    const load = async () => {
      try {
        const path =
          partnerType === 'Customer'
            ? '/apps/master-data/supply-chain/customers'
            : '/apps/master-data/supply-chain/suppliers';
        const res = await apiRequest<unknown>(path, { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setPartnerOptions(
          (Array.isArray(list) ? list : []).map((c: any) => ({
            label: c.name || c.code || String(c.id),
            value: c.id,
          })),
        );
      } catch {
        setPartnerOptions([]);
      }
    };
    load();
  }, [partnerType]);

  const periodRange = useMemo(() => {
    const start = period.startOf('month');
    const end = period.endOf('month');
    return { start, end, label: period.format('YYYY-MM') };
  }, [period]);

  const resetCreate = () => {
    setPreview(null);
    setPartnerId(null);
    setPeriod(dayjs().subtract(1, 'month').startOf('month'));
    createForm.resetFields();
  };

  const handlePreview = async () => {
    if (!partnerId) {
      messageApi.warning('请选择往来单位');
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await partnerStatementService.preview({
        partner_id: partnerId,
        partner_type: partnerType,
        start_date: periodRange.start.format('YYYY-MM-DD'),
        end_date: periodRange.end.format('YYYY-MM-DD'),
      });
      setPreview(data);
    } catch (e: any) {
      messageApi.error(e?.message || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!partnerId || !preview) {
      messageApi.warning('请先预览对账数据');
      return;
    }
    setSubmitting(true);
    try {
      const created = await partnerStatementService.create({
        partner_id: partnerId,
        partner_type: partnerType,
        statement_period: periodRange.label,
        start_date: periodRange.start.format('YYYY-MM-DD'),
        end_date: periodRange.end.format('YYYY-MM-DD'),
        attachments: normalizeDocumentAttachments(createForm.getFieldValue('attachments')),
      });
      messageApi.success('对账单已生成');
      setCreateOpen(false);
      resetCreate();
      if (partnerType === 'Customer') customerActionRef.current?.reload();
      else supplierActionRef.current?.reload();
      navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${created.id}`);
    } catch (e: any) {
      messageApi.error(e?.message || '生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: PartnerStatement) => {
    Modal.confirm({
      title: '删除对账单',
      content: `确定删除对账单 ${record.statement_code}？仅草稿可删除。`,
      okType: 'danger',
      onOk: async () => {
        await partnerStatementService.delete(record.id);
        messageApi.success('已删除');
        if (record.partner_type === 'Customer') customerActionRef.current?.reload();
        else supplierActionRef.current?.reload();
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[], type: 'Customer' | 'Supplier') => {
    try {
      for (const id of keys) {
        await partnerStatementService.delete(Number(id));
      }
      messageApi.success(`成功删除 ${keys.length} 条对账单`);
      if (type === 'Customer') {
        setCustomerSelectedRowKeys([]);
        customerActionRef.current?.reload();
      } else {
        setSupplierSelectedRowKeys([]);
        supplierActionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '批量删除失败');
    }
  };

  const handleBatchConfirm = async (keys: React.Key[], type: 'Customer' | 'Supplier') => {
    try {
      for (const id of keys) {
        await partnerStatementService.confirm(Number(id));
      }
      messageApi.success(`成功确认 ${keys.length} 条对账单`);
      if (type === 'Customer') {
        setCustomerSelectedRowKeys([]);
        customerActionRef.current?.reload();
      } else {
        setSupplierSelectedRowKeys([]);
        supplierActionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '批量确认失败');
    }
  };

  const buildColumns = (type: 'Customer' | 'Supplier'): ProColumns<PartnerStatement>[] => [
    {
      title: '对账单号',
      dataIndex: 'statement_code',
      width: 160,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: r.statement_code }} ellipsis>
          <a onClick={() => navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${r.id}`)}>
            {r.statement_code}
          </a>
        </Typography.Text>
      ),
    },
    {
      title: type === 'Customer' ? '客户名称' : '供应商名称',
      dataIndex: 'partner_name',
      width: 200,
    },
    {
      title: '对账期间',
      dataIndex: 'statement_period',
      width: 110,
    },
    {
      title: '期初余额',
      dataIndex: 'opening_balance',
      width: 120,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => money(r.opening_balance),
    },
    {
      title: '期末余额',
      dataIndex: 'closing_balance',
      width: 120,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => (
        <Typography.Text strong type={Number(r.closing_balance) > 0 ? 'danger' : undefined}>
          {money(r.closing_balance)}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: Object.fromEntries(
        Object.entries(PARTNER_STATEMENT_STATUS_MAP).map(([k, v]) => [k, { text: v.text }]),
      ),
      render: (_, r) => {
        const m = PARTNER_STATEMENT_STATUS_MAP[r.status] || { text: r.status, color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, record) => [
            <Button {...rowActionKind('read')}
              key="det"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${record.id}`)}
            >
              详情
            </Button>,
            record.status === 'Draft' ? (
              <Button {...rowActionKind('delete')}
                key="del"
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                删除
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ];

  const tableRequest = (type: 'Customer' | 'Supplier') => async (params: any) => {
    const { current, pageSize, status, statement_period } = params;
    const res = await partnerStatementService.list({
      skip: ((current || 1) - 1) * (pageSize || 20),
      limit: pageSize || 20,
      partner_type: type,
      status,
      statement_period,
    });
    return { data: res?.items || [], total: res?.total || 0, success: true };
  };

  const customerTable = (
    <UniTable<PartnerStatement>
      headerTitle="客户对账"
      actionRef={customerActionRef}
      enableRowSelection
      selectedRowKeys={customerSelectedRowKeys}
      onRowSelectionChange={setCustomerSelectedRowKeys}
      rowKey="id"
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.partner-statements.Customer"
      scroll={{ x: 1200 }}
      showAdvancedSearch
      search={{ labelWidth: 100 }}
      showCreateButton
      createButtonText="新建对账单"
      onCreate={() => {
        setActiveTab('Customer');
        resetCreate();
        setCreateOpen(true);
      }}
      showDeleteButton
      onDelete={(keys) => handleBatchDelete(keys, 'Customer')}
      deleteConfirmTitle="确认批量删除"
      deleteConfirmDescription={(count) => `确定删除选中的 ${count} 条客户对账单吗？仅草稿可删除。`}
      toolBarActionsAfterDelete={[
        <UniBatchMenuButton
          key="customer-partner-statement-batch-actions"
          selectedRowKeys={customerSelectedRowKeys}
          buttonText="批量操作"
          menuItems={[
            {
              key: 'batch-confirm',
              label: '批量确认',
              requireConfirm: true,
              confirmTitle: (count) => `确认批量确认 ${count} 条对账单`,
              confirmDescription: '仅草稿对账单可确认，不满足条件的记录会由后端拒绝。',
              onClick: (keys) => handleBatchConfirm(keys, 'Customer'),
            },
          ]}
        />,
      ]}
      request={tableRequest('Customer')}
      columns={buildColumns('Customer')}
    />
  );

  const supplierTable = (
    <UniTable<PartnerStatement>
      headerTitle="供应商对账"
      actionRef={supplierActionRef}
      enableRowSelection
      selectedRowKeys={supplierSelectedRowKeys}
      onRowSelectionChange={setSupplierSelectedRowKeys}
      rowKey="id"
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.partner-statements.Supplier"
      scroll={{ x: 1200 }}
      showAdvancedSearch
      search={{ labelWidth: 100 }}
      showCreateButton
      createButtonText="新建对账单"
      onCreate={() => {
        setActiveTab('Supplier');
        resetCreate();
        setCreateOpen(true);
      }}
      showDeleteButton
      onDelete={(keys) => handleBatchDelete(keys, 'Supplier')}
      deleteConfirmTitle="确认批量删除"
      deleteConfirmDescription={(count) => `确定删除选中的 ${count} 条供应商对账单吗？仅草稿可删除。`}
      toolBarActionsAfterDelete={[
        <UniBatchMenuButton
          key="supplier-partner-statement-batch-actions"
          selectedRowKeys={supplierSelectedRowKeys}
          buttonText="批量操作"
          menuItems={[
            {
              key: 'batch-confirm',
              label: '批量确认',
              requireConfirm: true,
              confirmTitle: (count) => `确认批量确认 ${count} 条对账单`,
              confirmDescription: '仅草稿对账单可确认，不满足条件的记录会由后端拒绝。',
              onClick: (keys) => handleBatchConfirm(keys, 'Supplier'),
            },
          ]}
        />,
      ]}
      request={tableRequest('Supplier')}
      columns={buildColumns('Supplier')}
    />
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTab}
        onTabChange={(k) => setActiveTab(k as 'Customer' | 'Supplier')}
        preserveMounted
        tabs={[
          { key: 'Customer', label: '客户对账', children: customerTable },
          { key: 'Supplier', label: '供应商对账', children: supplierTable },
        ]}
      />

      <Modal
        title={`新建${partnerType === 'Customer' ? '客户' : '供应商'}对账单`}
        open={createOpen}
        width={960}
        onCancel={() => {
          if (submitting) return;
          setCreateOpen(false);
          resetCreate();
        }}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => { setCreateOpen(false); resetCreate(); }}>
            取消
          </Button>,
          <Button {...rowActionKind('read')} key="preview" loading={previewLoading} onClick={() => void handlePreview()}>
            预览
          </Button>,
          <Button {...rowActionKind('skip')}
            key="ok"
            type="primary"
            loading={submitting}
            disabled={!preview}
            onClick={() => void handleCreate()}
          >
            生成对账单
          </Button>,
        ]}
        destroyOnHidden
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              showSearch
              placeholder={partnerType === 'Customer' ? '选择客户' : '选择供应商'}
              style={{ width: 280 }}
              options={partnerOptions}
              value={partnerId ?? undefined}
              onChange={(v) => {
                setPartnerId(v);
                setPreview(null);
              }}
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <DatePicker
              picker="month"
              value={period}
              onChange={(v) => {
                if (v) setPeriod(v);
                setPreview(null);
              }}
            />
          </Space>

          {preview ? (
            <>
              <Descriptions size="small" bordered column={4}>
                <Descriptions.Item label="往来单位">{preview.partner_name}</Descriptions.Item>
                <Descriptions.Item label="期间">
                  {preview.start_date} ~ {preview.end_date}
                </Descriptions.Item>
                <Descriptions.Item label="期初余额">{money(preview.summary.opening_balance)}</Descriptions.Item>
                <Descriptions.Item label="期末余额">{money(preview.summary.closing_balance)}</Descriptions.Item>
                <Descriptions.Item label="本期借方">{money(preview.summary.debit_total)}</Descriptions.Item>
                <Descriptions.Item label="本期贷方">{money(preview.summary.credit_total)}</Descriptions.Item>
              </Descriptions>
              <Table
                size="small"
                rowKey={(r, i) => `${r.doc_code}-${i}`}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 800, y: 280 }}
                dataSource={preview.lines}
                columns={[
                  { title: '日期', dataIndex: 'date', width: 110 },
                  { title: '单据类型', dataIndex: 'doc_type', width: 90 },
                  { title: '单号', dataIndex: 'doc_code', width: 140, ellipsis: true },
                  { title: '摘要', dataIndex: 'summary', ellipsis: true },
                  {
                    title: '借方',
                    dataIndex: 'debit',
                    width: 100,
                    align: 'right',
                    render: (v) => (v ? money(v) : '—'),
                  },
                  {
                    title: '贷方',
                    dataIndex: 'credit',
                    width: 100,
                    align: 'right',
                    render: (v) => (v ? money(v) : '—'),
                  },
                  {
                    title: preview.balance_label,
                    dataIndex: 'balance',
                    width: 110,
                    align: 'right',
                    render: (v) => money(v),
                  },
                ]}
              />
              <ProForm form={createForm} submitter={false}>
                <DocumentAttachmentsField category="partner_statement_attachments" />
              </ProForm>
            </>
          ) : (
            <Typography.Text type="secondary">选择往来单位与对账月份后，点击「预览」查看明细。</Typography.Text>
          )}
          <Divider style={{ margin: 0 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            对账单汇总已审核应收/应付与已确认收/付款；确认生成后可导出 Excel/PDF 发送给对方核对。
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
};

export default PartnerStatementsPage;
