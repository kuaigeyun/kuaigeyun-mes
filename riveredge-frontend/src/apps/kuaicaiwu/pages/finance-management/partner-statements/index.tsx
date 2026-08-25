/**
 * 往来对账列表页
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Modal,
  Typography,
  Space,
  Table,
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
  PartnerStatementLine,
  PartnerStatementPreview,
} from '../../../services/finance/partnerStatement';
import {
  priceSettlementService,
  type ProvisionalSummary,
} from '../../../services/finance/priceSettlement';
import {
  partnerStatementExpandableProps,
  usePartnerStatementInboundDetail,
} from '../../../components/PartnerStatementInboundDetail';
import { buildPartnerStatementStatusEnum } from '../../../utils/financeSharedOptions';
import {
  allPreviewLineKeys,
  buildLineAmountPayload,
  filterLinesBySelectedKeys,
  patchLineStatementAmount,
  previewLineKey,
  recalcPartnerStatementLines,
} from '../../../utils/partnerStatementAmountUtils';
import { usePartnerStatementLineColumns } from '../../../utils/partnerStatementLineColumns';
import { useFinanceVoucherDetail } from '../../../components/FinanceVoucherDetailProvider';
import { resolvePartnerStatementVoucherTarget } from '../../../utils/financeVoucherDocType';
import { apiRequest } from '../../../../../services/api';
import DocumentAttachmentsField from '../../../../kuaizhizao/components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../../kuaizhizao/utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCreatedUpdatedColumns,
  partnerStatementSearchColumns,
  resolvePartnerStatementListParams,
} from '../../../utils/financeListCore';
import type { PartnerStatementListParams } from '../../../services/finance/partnerStatement';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { buildReportHelpViewConfig } from '../../../../../components/page-help-wiki';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
const money = (v: number | string | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PS = 'app.kuaicaiwu.partnerStatement';
const PARTNER_STATEMENT_RESOURCE = 'kuaicaiwu:partner-statement';

const PartnerStatementsPage: React.FC = () => {
  const customerActionRef = useRef<ActionType>();
  const supplierActionRef = useRef<ActionType>();
  const customerLastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const supplierLastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [activeTab, setActiveTab] = useState<'Customer' | 'Supplier'>('Customer');
  const [customerSelectedRowKeys, setCustomerSelectedRowKeys] = useState<React.Key[]>([]);
  const [supplierSelectedRowKeys, setSupplierSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PartnerStatementPreview | null>(null);
  const [previewEditableLines, setPreviewEditableLines] = useState<PartnerStatementLine[]>([]);
  const [previewSelectedRowKeys, setPreviewSelectedRowKeys] = useState<React.Key[]>([]);
  const [provisionalSummary, setProvisionalSummary] = useState<ProvisionalSummary | null>(null);
  const { cache: previewLineDetailCache, loadLineDetail: loadPreviewLineDetail, clearCache: clearPreviewLineDetailCache } =
    usePartnerStatementInboundDetail();
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => {
    const month = dayjs().subtract(1, 'month');
    return [month.startOf('month'), month.endOf('month')];
  });
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const [createForm] = ProForm.useForm();
  const { message: messageApi } = App.useApp();
  const statementPerms = useResourcePermissions(PARTNER_STATEMENT_RESOURCE);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openFinanceVoucherDetail } = useFinanceVoucherDetail();

  const handleDocCodeClick = useCallback(
    (line: PartnerStatementLine) => {
      const target = resolvePartnerStatementVoucherTarget(line);
      if (target) openFinanceVoucherDetail(target);
    },
    [openFinanceVoucherDetail],
  );

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
    const [start, end] = dateRange;
    return { start, end, label: start.format('YYYY-MM') };
  }, [dateRange]);

  const resetCreate = () => {
    clearPreviewLineDetailCache();
    setPreview(null);
    setPreviewEditableLines([]);
    setPreviewSelectedRowKeys([]);
    setProvisionalSummary(null);
    setPartnerId(null);
    const month = dayjs().subtract(1, 'month');
    setDateRange([month.startOf('month'), month.endOf('month')]);
    createForm.resetFields();
  };

  const handlePreview = async () => {
    if (!partnerId) {
      messageApi.warning(t(`${PS}.selectPartner`));
      return;
    }
    setPreviewLoading(true);
    clearPreviewLineDetailCache();
    try {
      const data = await partnerStatementService.preview({
        partner_id: partnerId,
        partner_type: partnerType,
        start_date: periodRange.start.format('YYYY-MM-DD'),
        end_date: periodRange.end.format('YYYY-MM-DD'),
      });
      setPreview(data);
      const recalc = recalcPartnerStatementLines(data.summary.opening_balance, data.lines || []);
      setPreviewEditableLines(recalc.lines);
      setPreviewSelectedRowKeys(allPreviewLineKeys(recalc.lines));
      try {
        const summary = await priceSettlementService.getProvisionalSummary({
          period: periodRange.label,
          side: partnerType === 'Customer' ? 'sales' : 'purchase',
          partner_id: partnerId,
        });
        setProvisionalSummary(summary);
      } catch {
        setProvisionalSummary(null);
      }
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
    const selectedLines = filterLinesBySelectedKeys(previewEditableLines, previewSelectedRowKeys);
    if (selectedLines.length === 0) {
      messageApi.warning(t(`${PS}.selectLinesRequired`));
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
        line_amounts: buildLineAmountPayload(selectedLines),
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
    getAntdModal().confirm({
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

  const buildColumns = useMemo(
    () => (type: 'Customer' | 'Supplier'): ProColumns<PartnerStatement>[] => [
      ...partnerStatementSearchColumns({
        statementCodeLabel: t(`${PS}.col.code`),
        partnerLabel: type === 'Customer' ? t(`${PS}.col.customerName`) : t(`${PS}.col.supplierName`),
        partnerOptions,
        periodLabel: t(`${PS}.col.period`),
      }),
      {
        title: t(`${PS}.col.code`),
        key: 'finance_doc_partner_stacked',
        dataIndex: 'statement_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.partner_name ?? '')}
            secondary={String(r.statement_code ?? '')}
            onSecondaryClick={() =>
              navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${r.id}`)
            }
          />
        ),
      },
      {
        title: type === 'Customer' ? t(`${PS}.col.customerName`) : t(`${PS}.col.supplierName`),
        dataIndex: 'partner_name',
        hideInTable: true,
      },
      {
        title: t(`${PS}.col.period`),
        dataIndex: 'statement_period',
        width: 200,
        minWidth: 200,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => {
          const start = r.start_date ? String(r.start_date).slice(0, 10) : '';
          const end = r.end_date ? String(r.end_date).slice(0, 10) : '';
          if (start && end) return `${start} ~ ${end}`;
          return r.statement_period || '—';
        },
      },
      {
        title: t(`${PS}.col.openingBalance`),
        dataIndex: 'opening_balance',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        hideInSearch: true,
        sorter: true,
        render: (_, r) => money(r.opening_balance),
      },
      {
        title: t(`${PS}.col.closingBalance`),
        dataIndex: 'closing_balance',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (
          <Typography.Text strong type={Number(r.closing_balance) > 0 ? 'danger' : undefined}>
            {money(r.closing_balance)}
          </Typography.Text>
        ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        order: 22,
        valueEnum: statusEnum,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        sorter: true,
        valueEnum: statusEnum,
        render: (_, r) => {
          const m = statusEnum[r.status as keyof typeof statusEnum] || { text: r.status };
          const colorMap: Record<string, string> = {
            Draft: 'default',
            Confirmed: 'processing',
            Sent: 'success',
            Disputed: 'warning',
          };
          return <MarkerTag color={colorMap[r.status] || 'default'}>{m.text}</MarkerTag>;
        },
      },
      ...financeDocCreatedUpdatedColumns<PartnerStatement>(t),
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
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
            record.status === 'Draft' && statementPerms.canDelete ? (
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
    ],
    [t, navigate, statusEnum, partnerOptions, statementPerms.canDelete],
  );

  const selectedPreviewLines = useMemo(
    () => filterLinesBySelectedKeys(previewEditableLines, previewSelectedRowKeys),
    [previewEditableLines, previewSelectedRowKeys],
  );

  const previewSummary = useMemo(() => {
    if (!preview) return null;
    const recalc = recalcPartnerStatementLines(preview.summary.opening_balance, selectedPreviewLines);
    return {
      ...preview.summary,
      debit_total: recalc.debitTotal,
      credit_total: recalc.creditTotal,
      closing_balance: recalc.closingBalance,
    };
  }, [preview, selectedPreviewLines]);

  const handlePreviewStatementAmountChange = (lineKey: string, amount: number) => {
    setPreviewEditableLines((prev) => {
      const next = prev.map((ln, idx) => {
        const key = previewLineKey(ln, idx);
        if (key !== lineKey) return ln;
        return patchLineStatementAmount(ln, amount);
      });
      const opening = Number(preview?.summary.opening_balance ?? 0);
      return recalcPartnerStatementLines(opening, next).lines;
    });
  };

  const previewLineColumns = usePartnerStatementLineColumns({
    t,
    balanceLabel: preview?.balance_label || t(`${PS}.col.closingBalance`),
    editable: true,
    onStatementAmountChange: handlePreviewStatementAmountChange,
    lineKey: previewLineKey,
    onDocCodeClick: handleDocCodeClick,
  });

  const previewRowSelection = useMemo(
    () => ({
      selectedRowKeys: previewSelectedRowKeys,
      onChange: (keys: React.Key[]) => setPreviewSelectedRowKeys(keys),
    }),
    [previewSelectedRowKeys],
  );

  const tableRequest = (type: 'Customer' | 'Supplier') => async (
    params: { current?: number; pageSize?: number },
    sort?: Record<string, unknown>,
    _filter?: unknown,
    searchFormValues?: Record<string, unknown>,
  ) => {
    const listParams = resolvePartnerStatementListParams(searchFormValues, sort, type);
    if (type === 'Customer') {
      customerLastListParamsRef.current = listParams;
    } else {
      supplierLastListParamsRef.current = listParams;
    }
    const apiParams: PartnerStatementListParams = {
      skip: ((params.current || 1) - 1) * (params.pageSize || 20),
      limit: params.pageSize || 20,
      ...listParams,
    };
    const res = await partnerStatementService.list(apiParams);
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
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.partner-statements.Customer.list-v1"
      viewTypes={['table', 'help']}
      helpViewConfig={buildReportHelpViewConfig()}
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
      columns={alignProColumns(buildColumns('Customer'), SALES_DOC_LIST_FIELD_RANK)}
      skipFuzzyPinyinClientFilter
      pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
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
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.partner-statements.Supplier.list-v1"
      viewTypes={['table', 'help']}
      helpViewConfig={buildReportHelpViewConfig()}
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
      columns={alignProColumns(buildColumns('Supplier'), SALES_DOC_LIST_FIELD_RANK)}
      skipFuzzyPinyinClientFilter
      pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
    />
  );

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t(`${PS}.dataSourceNote`)}
      />
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
            disabled={
              !preview
              || previewEditableLines.length === 0
              || previewSelectedRowKeys.length === 0
            }
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
                clearPreviewLineDetailCache();
                setPreview(null);
                setPreviewEditableLines([]);
                setPreviewSelectedRowKeys([]);
              }}
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <DatePicker.RangePicker
              allowClear={false}
              value={dateRange}
              onChange={(v) => {
                if (v?.[0] && v?.[1]) {
                  setDateRange([v[0].startOf('day'), v[1].endOf('day')]);
                }
                clearPreviewLineDetailCache();
                setPreview(null);
                setPreviewEditableLines([]);
                setPreviewSelectedRowKeys([]);
              }}
              placeholder={[t(`${PS}.startDate`), t(`${PS}.endDate`)]}
            />
          </Space>

          {preview ? (
            <>
              {provisionalSummary && provisionalSummary.provisional_line_count > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  title={t(`${PS}.provisionalPricingHint`, {
                    count: provisionalSummary.provisional_line_count,
                  })}
                  action={
                    <Button
                      size="small"
                      type="link"
                      onClick={() =>
                        navigate(
                          `/apps/kuaicaiwu/finance-management/price-settlement?side=${
                            partnerType === 'Customer' ? 'sales' : 'purchase'
                          }&partnerId=${partnerId}&period=${periodRange.label}`,
                        )
                      }
                    >
                      {t(`${PS}.goPriceSettlement`)}
                    </Button>
                  }
                />
              ) : null}
              {preview.existing_period_statement_code && (preview.lines?.length ?? 0) > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  title={t(`${PS}.periodHasPriorStatement`, {
                    period: preview.existing_period,
                    code: preview.existing_period_statement_code,
                  })}
                />
              ) : null}
              {preview.existing_period_statement_code && !(preview.lines?.length) ? (
                <Alert
                  type="warning"
                  showIcon
                  title={t(`${PS}.periodFullyStated`, {
                    period: preview.existing_period,
                    code: preview.existing_period_statement_code,
                  })}
                />
              ) : null}
              {Number(preview.excluded_from_period || 0) > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  title={t(`${PS}.excludedStatedHint`, { count: preview.excluded_from_period })}
                />
              ) : null}
              <Alert
                type="info"
                showIcon
                title={t(`${PS}.previewSelectHint`, {
                  count: previewSelectedRowKeys.length,
                  total: previewEditableLines.length,
                })}
                style={{ marginBottom: 8 }}
              />
              <Descriptions size="small" bordered column={4}>
                <Descriptions.Item label={t(`${PS}.col.partner`)}>{preview.partner_name}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.periodRange`)}>
                  {preview.start_date} ~ {preview.end_date}
                </Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.openingBalance`)}>{money(previewSummary?.opening_balance)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.closingBalance`)}>{money(previewSummary?.closing_balance)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.debitTotal`)}>{money(previewSummary?.debit_total)}</Descriptions.Item>
                <Descriptions.Item label={t(`${PS}.col.creditTotal`)}>{money(previewSummary?.credit_total)}</Descriptions.Item>
              </Descriptions>
              <Table<PartnerStatementLine>
                size="small"
                rowKey={previewLineKey}
                pagination={{ pageSize: 8 }}
                scroll={{ x: 1400, y: 280 }}
                dataSource={previewEditableLines}
                rowSelection={previewRowSelection}
                columns={previewLineColumns}
                expandable={partnerStatementExpandableProps(
                  previewLineDetailCache,
                  loadPreviewLineDetail,
                )}
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
