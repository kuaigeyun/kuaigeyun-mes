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
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import {
  partnerStatementService,
  PartnerStatement,
  PartnerStatementPreview,
} from '../../../services/finance/partnerStatement';
import { buildPartnerStatementStatusEnum } from '../../../utils/financeSharedOptions';
import { apiRequest } from '../../../../../services/api';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';

const money = (v: number | string | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PS = 'app.kuaicaiwu.partnerStatement';

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
  const { t } = useTranslation();
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
      messageApi.warning(t(`${PS}.selectPartner`));
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
      messageApi.error(e?.message || t(`${PS}.previewFailed`));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!partnerId || !preview) {
      messageApi.warning(t(`${PS}.previewFirst`));
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
      messageApi.success(t(`${PS}.generateSuccess`));
      setCreateOpen(false);
      resetCreate();
      if (partnerType === 'Customer') customerActionRef.current?.reload();
      else supplierActionRef.current?.reload();
      navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${created.id}`);
    } catch (e: any) {
      messageApi.error(e?.message || t(`${PS}.generateFailed`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (record: PartnerStatement) => {
    Modal.confirm({
      title: t(`${PS}.deleteTitle`),
      content: t(`${PS}.deleteConfirm`, { code: record.statement_code }),
      okType: 'danger',
      onOk: async () => {
        await partnerStatementService.delete(record.id);
        messageApi.success(t(`${PS}.deleted`));
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
      messageApi.success(t(`${PS}.batchDeleted`, { count: keys.length }));
      if (type === 'Customer') {
        setCustomerSelectedRowKeys([]);
        customerActionRef.current?.reload();
      } else {
        setSupplierSelectedRowKeys([]);
        supplierActionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.batchDeleteFailed'));
    }
  };

  const handleBatchConfirm = async (keys: React.Key[], type: 'Customer' | 'Supplier') => {
    try {
      for (const id of keys) {
        await partnerStatementService.confirm(Number(id));
      }
      messageApi.success(t(`${PS}.batchConfirmed`, { count: keys.length }));
      if (type === 'Customer') {
        setCustomerSelectedRowKeys([]);
        customerActionRef.current?.reload();
      } else {
        setSupplierSelectedRowKeys([]);
        supplierActionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaicaiwu.common.batchConfirmFailed'));
    }
  };

  const statusEnum = useMemo(() => buildPartnerStatementStatusEnum(t), [t]);

  const buildColumns = useMemo(() => (type: 'Customer' | 'Supplier'): ProColumns<PartnerStatement>[] => [
    {
      title: t(`${PS}.col.code`),
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
      title: type === 'Customer' ? t(`${PS}.col.customerName`) : t(`${PS}.col.supplierName`),
      dataIndex: 'partner_name',
      width: 200,
    },
    {
      title: t(`${PS}.col.period`),
      dataIndex: 'statement_period',
      width: 110,
    },
    {
      title: t(`${PS}.col.openingBalance`),
      dataIndex: 'opening_balance',
      width: 120,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => money(r.opening_balance),
    },
    {
      title: t(`${PS}.col.closingBalance`),
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
      title: t('common.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: statusEnum,
      render: (_, r) => {
        const m = statusEnum[r.status as keyof typeof statusEnum] || { text: r.status };
        const colorMap: Record<string, string> = {
          Draft: 'default',
          Confirmed: 'processing',
          Sent: 'success',
          Disputed: 'warning',
        };
        return <Tag color={colorMap[r.status] || 'default'}>{m.text}</Tag>;
      },
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.created_at ? formatDateTime(r.created_at, 'YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: t('common.actions'),
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
              {t('common.detail')}
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
                {t('common.delete')}
              </Button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[],
    },
  ], [t, navigate, statusEnum]);

  const previewLineColumns = useMemo(() => [
    { title: t(`${PS}.col.date`), dataIndex: 'date', width: 110 },
    { title: t(`${PS}.col.docType`), dataIndex: 'doc_type', width: 90 },
    { title: t(`${PS}.col.docCode`), dataIndex: 'doc_code', width: 140, ellipsis: true },
    { title: t(`${PS}.col.summary`), dataIndex: 'summary', ellipsis: true },
    {
      title: t(`${PS}.col.debit`),
      dataIndex: 'debit',
      width: 100,
      align: 'right' as const,
      render: (v: unknown) => (v ? money(v as number) : '—'),
    },
    {
      title: t(`${PS}.col.credit`),
      dataIndex: 'credit',
      width: 100,
      align: 'right' as const,
      render: (v: unknown) => (v ? money(v as number) : '—'),
    },
    {
      title: preview?.balance_label || t(`${PS}.col.closingBalance`),
      dataIndex: 'balance',
      width: 110,
      align: 'right' as const,
      render: (v: unknown) => money(v as number),
    },
  ], [t, preview?.balance_label]);

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
      headerTitle={t(`${PS}.tabCustomer`)}
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
      createButtonText={t(`${PS}.createButton`)}
      onCreate={() => {
        setActiveTab('Customer');
        resetCreate();
        setCreateOpen(true);
      }}
      showDeleteButton
      onDelete={(keys) => handleBatchDelete(keys, 'Customer')}
      deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
      deleteConfirmDescription={(count) => t(`${PS}.batchDeleteCustomerConfirm`, { count })}
      toolBarActionsAfterDelete={[
        <UniBatchMenuButton
          key="customer-partner-statement-batch-actions"
          selectedRowKeys={customerSelectedRowKeys}
          buttonText={t('components.uniBatch.batchActions')}
          menuItems={[
            {
              key: 'batch-confirm',
              label: t('app.kuaicaiwu.common.batchConfirm'),
              requireConfirm: true,
              confirmTitle: (count) => t(`${PS}.batchConfirmTitle`, { count }),
              confirmDescription: t(`${PS}.batchConfirmOnlyDraft`),
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
      headerTitle={t(`${PS}.tabSupplier`)}
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
      createButtonText={t(`${PS}.createButton`)}
      onCreate={() => {
        setActiveTab('Supplier');
        resetCreate();
        setCreateOpen(true);
      }}
      showDeleteButton
      onDelete={(keys) => handleBatchDelete(keys, 'Supplier')}
      deleteConfirmTitle={t('app.kuaicaiwu.common.confirmBatchDelete')}
      deleteConfirmDescription={(count) => t(`${PS}.batchDeleteSupplierConfirm`, { count })}
      toolBarActionsAfterDelete={[
        <UniBatchMenuButton
          key="supplier-partner-statement-batch-actions"
          selectedRowKeys={supplierSelectedRowKeys}
          buttonText={t('components.uniBatch.batchActions')}
          menuItems={[
            {
              key: 'batch-confirm',
              label: t('app.kuaicaiwu.common.batchConfirm'),
              requireConfirm: true,
              confirmTitle: (count) => t(`${PS}.batchConfirmTitle`, { count }),
              confirmDescription: t(`${PS}.batchConfirmOnlyDraft`),
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
          { key: 'Customer', label: t(`${PS}.tabCustomer`), children: customerTable },
          { key: 'Supplier', label: t(`${PS}.tabSupplier`), children: supplierTable },
        ]}
      />

      <Modal
        title={partnerType === 'Customer' ? t(`${PS}.createCustomer`) : t(`${PS}.createSupplier`)}
        open={createOpen}
        width={960}
        onCancel={() => {
          if (submitting) return;
          setCreateOpen(false);
          resetCreate();
        }}
        footer={[
          <Button {...rowActionKind('revoke')} key="cancel" onClick={() => { setCreateOpen(false); resetCreate(); }}>
            {t('common.cancel')}
          </Button>,
          <Button {...rowActionKind('read')} key="preview" loading={previewLoading} onClick={() => void handlePreview()}>
            {t('app.kuaicaiwu.common.preview')}
          </Button>,
          <Button {...rowActionKind('skip')}
            key="ok"
            type="primary"
            loading={submitting}
            disabled={!preview}
            onClick={() => void handleCreate()}
          >
            {t(`${PS}.generate`)}
          </Button>,
        ]}
        destroyOnHidden
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              showSearch
              placeholder={partnerType === 'Customer' ? t(`${PS}.selectCustomer`) : t(`${PS}.selectSupplier`)}
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
                <Descriptions.Item label={t(`${PS}.col.partner`)}>{preview.partner_name}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.periodRange`)}>
                  {preview.start_date} ~ {preview.end_date}
                </Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.openingBalance`)}>{money(preview.summary.opening_balance)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.closingBalance`)}>{money(preview.summary.closing_balance)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.debitTotal`)}>{money(preview.summary.debit_total)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.creditTotal`)}>{money(preview.summary.credit_total)}</Descriptions.Item>
              </Descriptions>
              <Table
                size="small"
                rowKey={(r, i) => `${r.doc_code}-${i}`}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 800, y: 280 }}
                dataSource={preview.lines}
                columns={previewLineColumns}
              />
              <ProForm form={createForm} submitter={false}>
                <DocumentAttachmentsField category="partner_statement_attachments" />
              </ProForm>
            </>
          ) : (
            <Typography.Text type="secondary">{t(`${PS}.previewHint`)}</Typography.Text>
          )}
          <Divider style={{ margin: 0 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t(`${PS}.previewFooter`)}
          </Typography.Text>
        </Space>
      </Modal>
    </>
  );
};

export default PartnerStatementsPage;
