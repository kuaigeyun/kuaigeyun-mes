import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Form, InputNumber, Select, Space, Steps, Tag } from 'antd';
import { LinkOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';
import { documentReconciliationService } from '../../../services/finance/document-reconciliation';
import { formatSettlementType } from '../../../utils/financeUiLabels';

type GapRow = {
  doc_type?: string;
  doc_id?: number;
  doc_code?: string;
  amount?: number;
  remaining_amount?: number;
  unsettled_amount?: number;
  finance_related_count?: number;
  settlement_type?: string;
};
type ChainStep = {
  step_label?: string;
  step_type?: string;
  status?: string;
  document_code?: string;
  document_id?: number;
  amount?: number;
};

const DOC_TYPE_LABEL: Record<string, string> = {
  receivable: '应收单',
  receipt: '收款单',
  payable: '应付单',
  payment: '付款单',
};

const CHAIN_FLOW_BY_DOC: Record<string, 'sales' | 'purchase'> = {
  receivable: 'sales',
  receipt: 'sales',
  payable: 'purchase',
  payment: 'purchase',
};

const DocumentReconciliationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const gapRowsRef = useRef<GapRow[]>([]);
  const [gapForm] = Form.useForm();
  const [chainForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('gaps');
  const [loading, setLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);
  const [chainMeta, setChainMeta] = useState<{ completion_rate?: number; linked_count?: number; total_steps?: number }>({});
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);

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
      setLoading(true);
      const result = await documentReconciliationService.listOpenGaps({
        partner_type: values.partner_type,
        partner_id: values.partner_id,
        start_date: values.period[0].format('YYYY-MM-DD'),
        end_date: values.period[1].format('YYYY-MM-DD'),
        only_gaps: true,
      });
      const items = (result as any)?.items ?? [];
      const nextRows = Array.isArray(items) ? items : [];
      gapRowsRef.current = nextRows;
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '查询失败');
    } finally {
      setLoading(false);
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
      messageApi.error(error.message || '关联链查询失败');
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
      messageApi.warning('该单据类型暂不支持查看关联链');
      return;
    }
    chainForm.setFieldsValue({
      flow_type: flowType,
      document_type: docType,
      document_id: row.doc_id,
    });
    setActiveTab('chain');
    await loadChain(flowType, docType, row.doc_id);
  };

  const columns: ProColumns<GapRow>[] = [
    {
      title: '单据类型',
      dataIndex: 'doc_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        receivable: { text: '应收单' },
        receipt: { text: '收款单' },
        payable: { text: '应付单' },
        payment: { text: '付款单' },
      },
      render: (_, r) => DOC_TYPE_LABEL[r.doc_type || ''] || r.doc_type,
    },
    { title: '单据编号', dataIndex: 'doc_code', width: 160, ellipsis: true },
    { title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
    {
      title: '未结清',
      align: 'right',
      width: 120,
      render: (_, r) => {
        const val = r.remaining_amount ?? r.unsettled_amount;
        return val != null ? `¥${Number(val).toFixed(2)}` : '—';
      },
    },
    {
      title: '业财关联',
      dataIndex: 'finance_related_count',
      width: 100,
      render: (v) => (Number(v) > 0 ? <Tag color="success">{v}</Tag> : <Tag color="warning">未关联</Tag>),
    },
    {
      title: '结算方式',
      dataIndex: 'settlement_type',
      width: 100,
      render: (_, r) => (r.settlement_type ? formatSettlementType(String(r.settlement_type)) : '—'),
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => openChainFromGap(r)}>
          关联链
        </Button>
      ),
    },
  ];

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
        <Form.Item name="partner_type" label="往来类型" rules={[{ required: true }]}>
          <Select style={{ width: 120 }} options={[{ label: '客户', value: 'Customer' }, { label: '供应商', value: 'Supplier' }]} />
        </Form.Item>
        <Form.Item name="partner_id" label="往来单位" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 220 }}
            options={partnerOptions}
            onFocus={() => loadPartners(gapForm.getFieldValue('partner_type') || 'Customer')}
          />
        </Form.Item>
        <Form.Item name="period" label="期间" rules={[{ required: true }]}>
          <DatePicker.RangePicker />
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearch}>
            查询缺口
          </Button>
        </Form.Item>
      </Form>
    ),
    [gapForm, loading, partnerOptions],
  );

  const gapRequest = useCallback(
    async (
      params: { current?: number; pageSize?: number },
      _sort: Record<string, 'ascend' | 'descend' | null>,
      _filter: Record<string, React.ReactText[] | null>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const current = params.current ?? 1;
      const pageSize = params.pageSize ?? 20;
      let filtered = [...gapRowsRef.current];

      const keyword =
        typeof searchFormValues?.keyword === 'string' ? searchFormValues.keyword.trim().toLowerCase() : '';
      if (keyword) {
        filtered = filtered.filter((row) => {
          const docTypeLabel = DOC_TYPE_LABEL[row.doc_type || ''] || row.doc_type || '';
          const settlementLabel = row.settlement_type ? formatSettlementType(String(row.settlement_type)) : '';
          const hay = [
            docTypeLabel,
            row.doc_code,
            settlementLabel,
            row.amount,
            row.remaining_amount ?? row.unsettled_amount,
          ]
            .filter((v) => v != null && v !== '')
            .join('\n')
            .toLowerCase();
          return hay.includes(keyword);
        });
      }

      const docType = searchFormValues?.doc_type;
      if (typeof docType === 'string' && docType) {
        filtered = filtered.filter((row) => row.doc_type === docType);
      }

      const docCode = searchFormValues?.doc_code;
      if (typeof docCode === 'string' && docCode.trim()) {
        const codeKeyword = docCode.trim().toLowerCase();
        filtered = filtered.filter((row) => String(row.doc_code ?? '').toLowerCase().includes(codeKeyword));
      }

      const total = filtered.length;
      const start = (current - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        success: true,
        total,
      };
    },
    [],
  );

  const gapPanel = (
    <UniTable<GapRow>
      actionRef={actionRef}
      headerActions={gapHeaderActions}
      request={gapRequest}
      tanstackQuery={{ enabled: false }}
      rowKey={(r) => `${r.doc_type}-${r.doc_id}`}
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.document-reconciliation.gaps"
      columns={columns}
      loading={loading}
      search={false}
      pagination={{ pageSize: 20 }}
    />
  );

  const chainPanel = (
    <>
      <Form
        form={chainForm}
        layout="inline"
        style={{ marginBottom: 16 }}
        initialValues={{ flow_type: 'sales', document_type: 'sales_delivery' }}
      >
        <Form.Item name="flow_type" label="业务方向" rules={[{ required: true }]}>
          <Select style={{ width: 120 }} options={[{ label: '销售业务', value: 'sales' }, { label: '采购业务', value: 'purchase' }]} />
        </Form.Item>
        <Form.Item name="document_type" label="起始单据" rules={[{ required: true }]}>
          <Select
            style={{ width: 160 }}
            options={[
              { label: '销售出库', value: 'sales_delivery' },
              { label: '销售订单', value: 'sales_order' },
              { label: '应收单', value: 'receivable' },
              { label: '采购入库', value: 'purchase_receipt' },
              { label: '采购订单', value: 'purchase_order' },
              { label: '应付单', value: 'payable' },
            ]}
          />
        </Form.Item>
        <Form.Item name="document_id" label="单据内码" rules={[{ required: true }]} tooltip="系统中该单据的数字编号，可在单据详情页地址栏查看">
          <InputNumber min={1} style={{ width: 120 }} placeholder="编号" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={chainLoading} onClick={handleChainSearch}>
            查看关联链
          </Button>
        </Form.Item>
      </Form>
      {chainMeta.total_steps ? (
        <Card size="small" style={{ marginBottom: 16 }}>
          单据链条完整度：{Math.round((chainMeta.completion_rate ?? 0) * 100)}%
          （已关联 {chainMeta.linked_count}/{chainMeta.total_steps} 个环节）
        </Card>
      ) : null}
      <Steps
        orientation="vertical"
        items={chainSteps.map((step) => ({
          title: step.step_label,
          description: (
            <Space orientation="vertical" size={0}>
              <span>{step.document_code || '—'}</span>
              {step.amount != null ? <span>金额 ¥{Number(step.amount).toFixed(2)}</span> : null}
            </Space>
          ),
          status: step.status === 'linked' ? 'finish' : 'wait',
          icon: step.status === 'linked' ? undefined : <Tag color="warning">缺失</Tag>,
        }))}
      />
    </>
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
      preserveMounted
      tabs={[
        { key: 'gaps', label: '往来缺口', children: gapPanel },
        { key: 'chain', label: '业财单据链条', children: chainPanel },
      ]}
    />
  );
};

export default DocumentReconciliationPage;
