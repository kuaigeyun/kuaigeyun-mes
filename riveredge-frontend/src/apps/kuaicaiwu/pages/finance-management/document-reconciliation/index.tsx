import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Form, Select, Space, Steps, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LinkOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';
import {
  documentReconciliationService,
  type ChainDocumentCandidate,
  type DocumentReconciliationGapItem,
} from '../../../services/finance/document-reconciliation';
import { formatSettlementType } from '../../../utils/financeUiLabels';
import { documentReconciliationGapReasonMessage } from '../../../utils/documentReconciliationCapabilityMessages';
import { formatQuantity } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  documentReconciliationGapSearchColumns,
  resolveDocumentReconciliationGapListParams,
} from '../../../utils/financeListCore';
import { MarkerTag } from '../../../../../constants/statusBadges';

type GapRow = DocumentReconciliationGapItem;
type GapSummary = {
  gap_count?: number;
  open_balance_total?: number;
};
type ChainStep = {
  step_label?: string;
  step_type?: string;
  status?: string;
  document_code?: string;
  document_id?: number;
  amount?: number;
  quantity?: number;
  pushed_quantity?: number;
  max_push_quantity?: number;
};

const D = 'app.kuaicaiwu.documentReconciliation';
const S = 'app.kuaicaiwu.settlement';

const DOC_TYPE_I18N_KEY: Record<string, string> = {
  receivable: `${D}.docType.receivable`,
  receipt: `${D}.docType.receipt`,
  payable: `${D}.docType.payable`,
  payment: `${D}.docType.payment`,
};

const CHAIN_FLOW_BY_DOC: Record<string, 'sales' | 'purchase'> = {
  receivable: 'sales',
  receipt: 'sales',
  payable: 'purchase',
  payment: 'purchase',
};

const formatDocType = (docType: string | undefined, t: TFunction): string => {
  if (!docType) return '';
  const key = DOC_TYPE_I18N_KEY[docType];
  return key ? t(key) : docType;
};

type GapQueryContext = {
  partner_type: 'Customer' | 'Supplier';
  partner_id: number;
  start_date: string;
  end_date: string;
};

const DocumentReconciliationPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const gapQueryContextRef = useRef<GapQueryContext | null>(null);
  const lastListParamsRef = useRef<Record<string, string | number | boolean | undefined>>({});
  const [gapForm] = Form.useForm();
  const [chainForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('gaps');
  const [loading, setLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);
  const [chainMeta, setChainMeta] = useState<{ completion_rate?: number; linked_count?: number; total_steps?: number }>({});
  const [gapSummary, setGapSummary] = useState<GapSummary>({});
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const [chainDocOptions, setChainDocOptions] = useState<{ label: string; value: number }[]>([]);
  const [chainDocSearching, setChainDocSearching] = useState(false);
  const chainDocSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainFlowType = Form.useWatch('flow_type', chainForm) as 'sales' | 'purchase' | undefined;
  const chainDocumentType = Form.useWatch('document_type', chainForm) as string | undefined;

  const loadPartners = async (partnerType: 'Customer' | 'Supplier') => {
    const path = partnerType === 'Customer'
      ? '/apps/master-data/supply-chain/customers'
      : '/apps/master-data/supply-chain/suppliers';
    try {
      const res = await apiRequest<unknown>(path, { params: { limit: 1000, is_active: true } });
      const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
      setPartnerOptions((Array.isArray(list) ? list : []).map((item: any) => ({
        label: item.name || item.customer_name || item.supplier_name || item.code || String(item.id),
        value: item.id,
      })));
    } catch {
      setPartnerOptions([]);
    }
  };

  const handleSearch = async () => {
    try {
      const values = await gapForm.validateFields();
      gapQueryContextRef.current = {
        partner_type: values.partner_type,
        partner_id: values.partner_id,
        start_date: values.period[0].format('YYYY-MM-DD'),
        end_date: values.period[1].format('YYYY-MM-DD'),
      };
      setLoading(true);
      actionRef.current?.reload();
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err.message || t(`${D}.queryFailed`));
    }
  };

  const loadChain = async (flowType: 'sales' | 'purchase', documentType: string, documentId: number) => {
    try {
      setChainLoading(true);
      const result = await documentReconciliationService.getStandardChain(flowType, documentType, documentId);
      setChainSteps((result as any)?.steps ?? []);
      setChainMeta({
        completion_rate: (result as any)?.completion_rate,
        linked_count: (result as any)?.linked_count,
        total_steps: (result as any)?.total_steps,
      });
    } catch (error: any) {
      messageApi.error(error.message || t(`${D}.chainQueryFailed`));
    } finally {
      setChainLoading(false);
    }
  };

  const handleChainSearch = async () => {
    const values = await chainForm.validateFields();
    await loadChain(values.flow_type, values.document_type, values.document_id);
  };

  const openChainFromGap = async (row: GapRow) => {
    const docType = row.doc_type || '';
    const flowType = CHAIN_FLOW_BY_DOC[docType];
    if (!flowType || !row.doc_id) {
      messageApi.warning(t(`${D}.unsupportedChain`));
      return;
    }
    const code = row.doc_code || String(row.doc_id);
    setChainDocOptions([{ label: code, value: row.doc_id }]);
    chainForm.setFieldsValue({
      flow_type: flowType,
      document_type: docType,
      document_id: row.doc_id,
    });
    setActiveTab('chain');
    await loadChain(flowType, docType, row.doc_id);
  };

  const fetchChainDocOptions = useCallback(
    async (documentType: string, keyword?: string) => {
      if (!documentType) {
        setChainDocOptions([]);
        return;
      }
      setChainDocSearching(true);
      try {
        const res = await documentReconciliationService.listChainCandidates({
          document_type: documentType,
          keyword: keyword?.trim() || undefined,
          limit: 30,
        });
        const items = (res?.items ?? []) as ChainDocumentCandidate[];
        const mapped = items.map((item) => ({
          value: item.id,
          label: item.label || item.code || String(item.id),
        }));
        const selectedId = chainForm.getFieldValue('document_id') as number | undefined;
        setChainDocOptions((prev) => {
          if (!selectedId || mapped.some((o) => o.value === selectedId)) {
            return mapped;
          }
          const keep = prev.find((o) => o.value === selectedId);
          return keep ? [keep, ...mapped] : mapped;
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err.message || t(`${D}.chainQueryFailed`));
        setChainDocOptions((prev) => {
          const selectedId = chainForm.getFieldValue('document_id') as number | undefined;
          if (!selectedId) return [];
          const keep = prev.find((o) => o.value === selectedId);
          return keep ? [keep] : [];
        });
      } finally {
        setChainDocSearching(false);
      }
    },
    [chainForm, messageApi, t],
  );

  const handleChainDocSearch = useCallback(
    (keyword: string) => {
      if (!chainDocumentType) return;
      if (chainDocSearchTimerRef.current) {
        clearTimeout(chainDocSearchTimerRef.current);
      }
      chainDocSearchTimerRef.current = setTimeout(() => {
        void fetchChainDocOptions(chainDocumentType, keyword);
      }, 300);
    },
    [chainDocumentType, fetchChainDocOptions],
  );

  useEffect(() => {
    return () => {
      if (chainDocSearchTimerRef.current) {
        clearTimeout(chainDocSearchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!chainDocumentType) return;
    void fetchChainDocOptions(chainDocumentType);
  }, [chainDocumentType, fetchChainDocOptions]);

  const docTypeEnum = useMemo(
    () => ({
      receivable: { text: t(`${D}.docType.receivable`) },
      receipt: { text: t(`${D}.docType.receipt`) },
      payable: { text: t(`${D}.docType.payable`) },
      payment: { text: t(`${D}.docType.payment`) },
    }),
    [t],
  );

  const columns: ProColumns<GapRow>[] = useMemo(() => [
    ...documentReconciliationGapSearchColumns({
      docTypeLabel: t(`${D}.col.docType`),
      docCodeLabel: t(`${D}.col.docCode`),
      docTypeEnum,
    }),
    {
      title: t(`${D}.col.docType`),
      dataIndex: 'doc_type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
      valueType: 'select',
      valueEnum: docTypeEnum,
      render: (_, r) => formatDocType(r.doc_type, t),
    },
    {
      title: t(`${D}.col.docCode`),
      dataIndex: 'doc_code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${S}.preview.col.docAmount`),
      dataIndex: 'quantity',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${S}.preview.col.settledAmount`),
      dataIndex: 'pushed_quantity',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${S}.preview.col.settleableAmount`),
      dataIndex: 'max_push_quantity',
      valueType: 'money',
      align: 'right',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t(`${D}.col.gapReason`),
      dataIndex: 'gap_reason',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      render: (_, r) => (r.gap_reason ? documentReconciliationGapReasonMessage(r.gap_reason, t) : '—'),
    },
    {
      title: t(`${D}.col.link`),
      dataIndex: 'finance_related_count',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      render: (v) =>
        Number(v) > 0 ? (
          <MarkerTag color="success">{v}</MarkerTag>
        ) : (
          <MarkerTag color="warning">{t(`${D}.unlinked`)}</MarkerTag>
        ),
    },
    {
      title: t(`${D}.col.settlementMethod`),
      dataIndex: 'settlement_type',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_, r) => (r.settlement_type ? formatSettlementType(String(r.settlement_type), t) : '—'),
    },
    {
      title: t('common.actions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, r) => (
        <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => openChainFromGap(r)}>
          {t(`${D}.col.linkChain`)}
        </Button>
      ),
    },
  ], [t, docTypeEnum]);

  useEffect(() => {
    loadPartners('Customer');
  }, []);

  const gapHeaderActions = useMemo(
    () => (
      <Form
        form={gapForm}
        layout="inline"
        style={{ flexWrap: 'wrap', rowGap: 8 }}
        initialValues={{
          partner_type: 'Customer',
          period: [dayjs().startOf('month'), dayjs().endOf('month')],
        }}
        onValuesChange={(changed) => {
          if (changed.partner_type) {
            gapForm.setFieldValue('partner_id', undefined);
            loadPartners(changed.partner_type);
          }
        }}
      >
        <Form.Item name="partner_type" label={t(`${D}.partnerType`)} rules={[{ required: true }]}>
          <Select
            style={{ width: 120 }}
            options={[
              { label: t(`${D}.partnerTypeCustomer`), value: 'Customer' },
              { label: t(`${D}.partnerTypeSupplier`), value: 'Supplier' },
            ]}
          />
        </Form.Item>
        <Form.Item name="partner_id" label={t(`${D}.col.partner`)} rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={partnerOptions}
            onFocus={() => loadPartners(gapForm.getFieldValue('partner_type') || 'Customer')}
          />
        </Form.Item>
        <Form.Item name="period" label={t(`${D}.period`)} rules={[{ required: true }]}>
          <DatePicker.RangePicker />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearch}>
            {t(`${D}.queryGap`)}
          </Button>
        </Form.Item>
      </Form>
    ),
    [gapForm, loading, partnerOptions, t],
  );

  const gapRequest = useCallback(
    async (
      params: { current?: number; pageSize?: number },
      sort: Record<string, 'ascend' | 'descend' | null>,
      _filter: Record<string, React.ReactText[] | null>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const context = gapQueryContextRef.current;
      if (!context) {
        return { data: [], success: true, total: 0 };
      }

      const current = params.current ?? 1;
      const pageSize = params.pageSize ?? 20;
      const listParams = resolveDocumentReconciliationGapListParams(searchFormValues, sort);
      lastListParamsRef.current = listParams;

      try {
        setLoading(true);
        const result = await documentReconciliationService.listOpenGaps({
          ...context,
          only_gaps: true,
          skip: (current - 1) * pageSize,
          limit: pageSize,
          ...listParams,
        });
        setGapSummary({
          gap_count: result?.gap_count ?? result?.total ?? 0,
          open_balance_total: result?.open_balance_total,
        });
        return {
          data: result?.items ?? [],
          success: true,
          total: result?.total ?? 0,
        };
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err.message || t(`${D}.queryFailed`));
        return { data: [], success: false, total: 0 };
      } finally {
        setLoading(false);
      }
    },
    [messageApi, t],
  );

  const chainStartDocOptions = useMemo(() => {
    if (chainFlowType === 'purchase') {
      return [
        { label: t(`${D}.chain.purchaseOrder`), value: 'purchase_order' },
        { label: t(`${D}.chain.purchaseReceipt`), value: 'purchase_receipt' },
        { label: t(`${D}.docType.payable`), value: 'payable' },
        { label: t(`${D}.docType.payment`), value: 'payment' },
      ];
    }
    return [
      { label: t(`${D}.chain.salesOrder`), value: 'sales_order' },
      { label: t(`${D}.chain.salesDelivery`), value: 'sales_delivery' },
      { label: t(`${D}.docType.receivable`), value: 'receivable' },
      { label: t(`${D}.docType.receipt`), value: 'receipt' },
    ];
  }, [chainFlowType, t]);

  const gapPanel = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t(`${D}.queryHint`)} />
      {gapSummary.gap_count != null ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          {t(`${D}.summary`, {
            count: gapSummary.gap_count ?? 0,
            amount: Number(gapSummary.open_balance_total ?? 0).toFixed(2),
          })}
        </Card>
      ) : null}
      <UniTable<GapRow>
        actionRef={actionRef}
        enableRowSelection
        headerActions={gapHeaderActions}
        request={gapRequest}
        tanstackQuery={{ enabled: false }}
        rowKey={(r) => `${r.doc_type}-${r.doc_id}`}
        columnPersistenceId="apps.kuaicaiwu.pages.finance-management.document-reconciliation.gaps.list-v1"
        columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
        loading={loading}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        pagination={{ pageSize: 20 }}
        locale={{
          emptyText: gapQueryContextRef.current
            ? undefined
            : t(`${D}.gapEmptyBeforeQuery`),
        }}
      />
    </>
  );

  const chainPanel = (
    <>
      <Form
        form={chainForm}
        layout="inline"
        style={{ marginBottom: 16 }}
        initialValues={{ flow_type: 'sales', document_type: 'sales_delivery' }}
      >
        <Form.Item name="flow_type" label={t(`${D}.businessDirection`)} rules={[{ required: true }]}>
          <Select
            style={{ width: 120 }}
            options={[
              { label: t(`${D}.directionSales`), value: 'sales' },
              { label: t(`${D}.directionPurchase`), value: 'purchase' },
            ]}
            onChange={(value: 'sales' | 'purchase') => {
              chainForm.setFieldsValue({
                flow_type: value,
                document_type: value === 'purchase' ? 'purchase_receipt' : 'sales_delivery',
                document_id: undefined,
              });
              setChainDocOptions([]);
            }}
          />
        </Form.Item>
        <Form.Item name="document_type" label={t(`${D}.startDoc`)} rules={[{ required: true }]}>
          <Select
            style={{ width: 160 }}
            options={chainStartDocOptions}
            onChange={() => {
              chainForm.setFieldsValue({ document_id: undefined });
              setChainDocOptions([]);
            }}
          />
        </Form.Item>
        <Form.Item
          name="document_id"
          label={t(`${D}.chain.docCode`)}
          rules={[{ required: true, message: t(`${D}.chain.docCodeRequired`) }]}
          tooltip={t(`${D}.chain.docCodeTooltip`)}
        >
          <Select
            showSearch
            allowClear
            filterOption={false}
            style={{ minWidth: 280 }}
            placeholder={t(`${D}.chain.docCodePlaceholder`)}
            options={chainDocOptions}
            loading={chainDocSearching}
            onSearch={handleChainDocSearch}
            onDropdownVisibleChange={(open) => {
              if (open && chainDocumentType && chainDocOptions.length === 0) {
                void fetchChainDocOptions(chainDocumentType);
              }
            }}
            notFoundContent={chainDocSearching ? undefined : t(`${D}.chain.docCodeEmpty`)}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={chainLoading} onClick={handleChainSearch}>
            {t(`${D}.viewChain`)}
          </Button>
        </Form.Item>
      </Form>
      {chainMeta.total_steps ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          {t(`${D}.chain.completion`, {
            rate: Math.round((chainMeta.completion_rate ?? 0) * 100),
            linked: chainMeta.linked_count,
            total: chainMeta.total_steps,
          })}
        </Card>
      ) : null}
      <Steps
        orientation="vertical"
        items={chainSteps.map((step) => ({
          title: step.step_label,
          description: (
            <Space orientation="vertical" size={0}>
              <span>{step.document_code || '—'}</span>
              {step.quantity != null ? (
                <span>
                  {t(`${S}.preview.col.docAmount`)}
                  {' '}
                  ¥
                  {formatQuantity(step.quantity)}
                  {' - '}
                  {t(`${S}.preview.col.settledAmount`)}
                  {' '}
                  ¥
                  {formatQuantity(step.pushed_quantity ?? 0)}
                  {' - '}
                  {t(`${S}.preview.col.settleableAmount`)}
                  {' '}
                  ¥
                  {formatQuantity(step.max_push_quantity ?? 0)}
                </span>
              ) : step.amount != null ? (
                <span>
                  {t('app.kuaicaiwu.invoice.line.amount')}
                  {' '}
                  ¥
                  {Number(step.amount).toFixed(2)}
                </span>
              ) : null}
            </Space>
          ),
          status: step.status === 'linked' ? 'finish' : 'wait',
          icon: step.status === 'linked' ? undefined : <MarkerTag color="warning">{t(`${D}.chain.missing`)}</MarkerTag>,
        }))}
      />
    </>
  );

  const tabs = useMemo(() => [
    { key: 'gaps', label: t(`${D}.tabGap`), children: gapPanel },
    { key: 'chain', label: t(`${D}.tabChain`), children: chainPanel },
  ], [chainPanel, gapPanel, t]);

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
      preserveMounted
      tabs={tabs}
    />
  );
};

export default DocumentReconciliationPage;
