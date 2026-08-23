/**
 * 月结定价工作台
 *
 * 契约：kuaicaiwu SKILL — ListPageTemplate 不传 title；MultiTabListPageTemplate + UniTable；
 * 查询表单进 headerActions；行缓存走 onTableDataChange；关联单号 openLinkedDocumentDetail。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Alert, Button, DatePicker, Form, Modal, Select, Space, InputNumber } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rowActionKind } from '../../../../../components/uni-action';
import { MultiTabListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { useLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  priceSettlementService,
  type PriceSettlementApplyResult,
  type PriceSettlementCandidate,
} from '../../../services/finance/priceSettlement';
import { apiRequest } from '../../../../../services/api';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const P = 'app.kuaicaiwu.priceSettlement';
const RESOURCE = 'kuaicaiwu:price-settlement';

type Side = 'sales' | 'purchase';

type QueryContext = {
  period: string;
  partner_id: number;
  price_source: string;
};

type PriceSettlementRow = PriceSettlementCandidate & {
  delta_amount: number;
};

const money = (v: number | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dashText = (v?: string | null) => {
  const text = (v ?? '').trim();
  return text || '—';
};

const enrichPriceSettlementRow = (
  row: PriceSettlementCandidate,
  afterOverride?: number,
): PriceSettlementRow => {
  const afterRaw =
    afterOverride ??
    row.after_unit_price ??
    row.suggested_unit_price ??
    row.provisional_unit_price;
  const after = Number(afterRaw ?? 0);
  const before = Number(row.before_unit_price ?? 0);
  const qty = Number(row.settled_quantity ?? 0);
  return {
    ...row,
    after_unit_price: afterRaw,
    delta_amount: (after - before) * qty,
  };
};

const parsePositiveInt = (raw: string | null): number | null => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

type SettlementPanelProps = {
  side: Side;
  initialPartnerId?: number | null;
  initialPeriod?: string | null;
};

const PriceSettlementPanel: React.FC<SettlementPanelProps> = ({
  side,
  initialPartnerId,
  initialPeriod,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const linked = useLinkedDocumentDetail();
  const navigate = useNavigate();
  const perms = useResourcePermissions(RESOURCE);
  const canSettle = !perms.enabled || (perms.canCreate && Boolean(perms.canAction?.('execute')));
  const actionRef = useRef<ActionType>();
  const queryContextRef = useRef<QueryContext | null>(null);
  const tableRowsRef = useRef<PriceSettlementRow[]>([]);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [partnerOptions, setPartnerOptions] = useState<{ label: string; value: number }[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [tableData, setTableData] = useState<PriceSettlementRow[]>([]);
  const [applyResult, setApplyResult] = useState<PriceSettlementApplyResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const autoQueriedRef = useRef(false);

  const loadPartners = useCallback(async () => {
    const path =
      side === 'sales'
        ? '/apps/master-data/supply-chain/customers'
        : '/apps/master-data/supply-chain/suppliers';
    setPartnerLoading(true);
    try {
      const res = await apiRequest<unknown>(path, { params: { limit: 1000, is_active: true } });
      const list = Array.isArray(res)
        ? res
        : (res as { data?: unknown[]; items?: unknown[] })?.data ??
          (res as { items?: unknown[] })?.items ??
          [];
      setPartnerOptions(
        (Array.isArray(list) ? list : []).map(
          (item: { id: number; name?: string; customer_name?: string; supplier_name?: string; code?: string }) => ({
            label: item.name || item.customer_name || item.supplier_name || item.code || String(item.id),
            value: item.id,
          }),
        ),
      );
    } catch (error: unknown) {
      setPartnerOptions([]);
      const err = error as { message?: string };
      messageApi.error(err.message || t('common.loadFailed'));
    } finally {
      setPartnerLoading(false);
    }
  }, [messageApi, side, t]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    const periodDayjs =
      initialPeriod && /^\d{4}-\d{2}$/.test(initialPeriod)
        ? dayjs(`${initialPeriod}-01`)
        : dayjs().subtract(1, 'month');
    form.setFieldsValue({
      partner_id: initialPartnerId ?? undefined,
      period: periodDayjs,
      price_source: 'partner_book',
    });
    autoQueriedRef.current = false;
    queryContextRef.current = null;
    setTableData([]);
    tableRowsRef.current = [];
    actionRef.current?.reload();
  }, [form, initialPartnerId, initialPeriod, side]);

  const partnerLabel =
    side === 'sales' ? t('app.kuaicaiwu.common.customer') : t('app.kuaicaiwu.common.supplier');
  const selectPartnerPlaceholder =
    side === 'sales' ? t(`${P}.selectCustomer`) : t(`${P}.selectSupplier`);
  const queryHint = side === 'sales' ? t(`${P}.queryHintCustomer`) : t(`${P}.queryHintSupplier`);
  const emptyBeforeQueryText =
    side === 'sales' ? t(`${P}.emptyBeforeQueryCustomer`) : t(`${P}.emptyBeforeQuerySupplier`);

  const fetchCandidates = useCallback(async (ctx: QueryContext) => {
    setLoading(true);
    try {
      const data = await priceSettlementService.listCandidates({
        period: ctx.period,
        side,
        partner_id: ctx.partner_id,
        price_source: ctx.price_source,
      });
      const rows = data.map((row) => enrichPriceSettlementRow(row));
      setTableData(rows);
      tableRowsRef.current = rows;
      actionRef.current?.reload();
      return rows;
    } catch (err: unknown) {
      setTableData([]);
      tableRowsRef.current = [];
      messageApi.error((err as Error)?.message || t(`${P}.loadFailed`));
      actionRef.current?.reload();
      return [];
    } finally {
      setLoading(false);
    }
  }, [messageApi, side, t]);

  const handleSearch = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const period = (values.period as Dayjs).format('YYYY-MM');
      const ctx: QueryContext = {
        period,
        partner_id: values.partner_id as number,
        price_source: values.price_source as string,
      };
      queryContextRef.current = ctx;
      await fetchCandidates(ctx);
    } catch {
      messageApi.warning(queryHint);
    }
  }, [fetchCandidates, form, messageApi, queryHint]);

  const handleApply = useCallback(async () => {
    const ctx = queryContextRef.current;
    const rows = tableRowsRef.current;
    if (!ctx) {
      messageApi.warning(queryHint);
      return;
    }
    if (!rows.length) {
      messageApi.warning(t(`${P}.noRows`));
      return;
    }
    const lines = rows.map((row) => ({
      source_line_id: row.source_line_id,
      after_unit_price: Number(row.after_unit_price ?? 0),
    }));
    const invalid = lines.find((line) => line.after_unit_price <= 0);
    if (invalid) {
      messageApi.warning(t(`${P}.priceRequired`));
      return;
    }
    setSubmitting(true);
    try {
      const batch = await priceSettlementService.createBatch({
        period: ctx.period,
        side,
        partner_id: ctx.partner_id,
        price_source: ctx.price_source,
        lines,
      });
      const result = await priceSettlementService.applyBatch(batch.id);
      setApplyResult(result);
      setResultOpen(true);
      messageApi.success(t(`${P}.applySuccess`, { code: result.batch.batch_code }));
      if (queryContextRef.current) {
        await fetchCandidates(queryContextRef.current);
      }
    } catch (err: unknown) {
      messageApi.error((err as Error)?.message || t(`${P}.applyFailed`));
    } finally {
      setSubmitting(false);
    }
  }, [fetchCandidates, messageApi, queryHint, side, t]);

  const handleAfterPriceChange = useCallback((row: PriceSettlementRow, val: number | null) => {
    const after = Number(val ?? 0);
    setTableData((prev) => {
      const next = prev.map((item) =>
        item.source_line_id === row.source_line_id ? enrichPriceSettlementRow(item, after) : item,
      );
      tableRowsRef.current = next;
      return next;
    });
  }, []);

  const renderDeltaCell = useCallback(
    (row: PriceSettlementRow) => {
      const delta = Number(row.delta_amount ?? 0);
      const qty = Number(row.settled_quantity ?? 0);
      if (qty <= 0) {
        const after = Number(row.after_unit_price ?? 0);
        const before = Number(row.before_unit_price ?? 0);
        const unitGap = after - before;
        if (unitGap !== 0) {
          return (
            <Space orientation="vertical" size={0} style={{ alignItems: 'flex-end', lineHeight: 1.25 }}>
              <span>{money(0)}</span>
              <span style={{ fontSize: 12, color: 'var(--ant-color-text-description)' }}>
                {t(`${P}.deltaUnitPreview`, { amount: money(unitGap) })}
              </span>
            </Space>
          );
        }
      }
      return money(delta);
    },
    [t],
  );

  const columns: ProColumns<PriceSettlementRow>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.orderCode`),
        dataIndex: 'source_order_code',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() =>
              linked.openLinkedDocumentDetail(
                side === 'sales' ? 'sales_order' : 'purchase_order',
                row.source_order_id,
              )
            }
          >
            {row.source_order_code}
          </Button>
        ),
      },
      {
        title: t(`${P}.col.materialCode`),
        dataIndex: 'material_code',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => dashText(row.material_code),
      },
      {
        title: t(`${P}.col.material`),
        dataIndex: 'material_name',
        width: 160,
        minWidth: 160,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => dashText(row.material_name),
      },
      {
        title: t(`${P}.col.materialSpec`),
        dataIndex: 'material_spec',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => dashText(row.material_spec),
      },
      {
        title: t(`${P}.col.materialModel`),
        dataIndex: 'material_model',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => dashText(row.material_model),
      },
      {
        title: t(`${P}.col.materialUnit`),
        dataIndex: 'material_unit',
        width: 72,
        minWidth: 72,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => dashText(row.material_unit),
      },
      {
        title: t(`${P}.col.settledQty`),
        dataIndex: 'settled_quantity',
        align: 'right',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.beforePrice`),
        dataIndex: 'before_unit_price',
        align: 'right',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) => money(row.before_unit_price),
      },
      {
        title: t(`${P}.col.suggestedPrice`),
        dataIndex: 'suggested_unit_price',
        align: 'right',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) =>
          row.suggested_unit_price != null ? money(row.suggested_unit_price) : '—',
      },
      {
        title: t(`${P}.col.provisionalPrice`),
        dataIndex: 'provisional_unit_price',
        align: 'right',
        width: 120,
        minWidth: 120,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, row) =>
          row.provisional_unit_price != null ? money(row.provisional_unit_price) : '—',
      },
      {
        title: t(`${P}.col.afterPrice`),
        key: 'after_unit_price',
        dataIndex: 'after_unit_price',
        width: 148,
        minWidth: 148,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, row) =>
          canSettle ? (
            <div style={{ minWidth: 128, overflow: 'visible' }}>
              <InputNumber
                min={0}
                precision={4}
                value={row.after_unit_price ?? null}
                placeholder={t(`${P}.inputAfterPrice`)}
                onChange={(val) => handleAfterPriceChange(row, val)}
                style={{ width: 128 }}
              />
            </div>
          ) : (
            row.after_unit_price != null ? money(Number(row.after_unit_price)) : '—'
          ),
      },
      {
        title: t(`${P}.col.delta`),
        key: 'delta',
        dataIndex: 'delta_amount',
        align: 'right',
        width: 148,
        minWidth: 148,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: false,
        hideInSearch: true,
        render: (_, row) => renderDeltaCell(row),
      },
    ],
    [canSettle, handleAfterPriceChange, linked, renderDeltaCell, side, t],
  );

  const headerActions = useMemo(
    () => (
      <Form
        form={form}
        layout="inline"
        style={{ flexWrap: 'wrap', rowGap: 8 }}
        initialValues={{
          period: dayjs().subtract(1, 'month'),
          price_source: 'partner_book',
        }}
      >
        <Form.Item
          name="partner_id"
          label={partnerLabel}
          rules={[{ required: true, message: selectPartnerPlaceholder }]}
        >
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            loading={partnerLoading}
            style={{ minWidth: 220 }}
            placeholder={selectPartnerPlaceholder}
            options={partnerOptions}
            onFocus={() => void loadPartners()}
          />
        </Form.Item>
        <Form.Item name="period" label={t(`${P}.col.period`)} rules={[{ required: true }]}>
          <DatePicker picker="month" allowClear={false} />
        </Form.Item>
        <Form.Item name="price_source" label={t(`${P}.col.priceSource`)}>
          <Select
            style={{ width: 140 }}
            options={[
              { label: t(`${P}.sourcePartnerBook`), value: 'partner_book' },
              { label: t(`${P}.sourceManual`), value: 'manual' },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => void handleSearch()}>
              {t('common.search')}
            </Button>
            {canSettle ? (
              <Button type="primary" loading={submitting} onClick={() => void handleApply()}>
                {t(`${P}.confirmApply`)}
              </Button>
            ) : null}
          </Space>
        </Form.Item>
      </Form>
    ),
    [canSettle, form, handleApply, handleSearch, loadPartners, loading, partnerLabel, partnerLoading, partnerOptions, selectPartnerPlaceholder, side, submitting, t],
  );

  const tableRequest = useCallback(async () => {
    if (!queryContextRef.current) {
      return { data: [], success: true, total: 0 };
    }
    return { data: tableData, success: true, total: tableData.length };
  }, [tableData]);

  useEffect(() => {
    if (autoQueriedRef.current || !initialPartnerId) return;
    if (!initialPeriod || !/^\d{4}-\d{2}$/.test(initialPeriod)) return;
    autoQueriedRef.current = true;
    const ctx: QueryContext = {
      period: initialPeriod,
      partner_id: initialPartnerId,
      price_source: 'partner_book',
    };
    queryContextRef.current = ctx;
    void fetchCandidates(ctx);
  }, [fetchCandidates, initialPartnerId, initialPeriod]);

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={queryHint} />
      <UniTable<PriceSettlementRow>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.priceSettlement)}
        actionRef={actionRef}
        headerActions={headerActions}
        dataSource={tableData}
        request={tableRequest}
        tanstackQuery={{ enabled: false }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows as PriceSettlementRow[];
        }}
        rowKey="source_line_id"
        columnPersistenceId={`apps.kuaicaiwu.pages.finance-management.price-settlement.${side}.list-v2`}
        columns={columns}
        loading={loading}
        search={false}
        pagination={false}
        skipFuzzyPinyinClientFilter
        locale={{
          emptyText: queryContextRef.current ? undefined : emptyBeforeQueryText,
        }}
      />

      <Modal
        title={t(`${P}.resultTitle`)}
        open={resultOpen}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onCancel={() => setResultOpen(false)}
        footer={[
          <Button {...rowActionKind('skip')} key="close" type="primary" onClick={() => setResultOpen(false)}>
            {t('common.close')}
          </Button>,
        ]}
        destroyOnHidden
      >
        {applyResult ? (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              {t(`${P}.resultBatch`)}: {applyResult.batch.batch_code}
            </div>
            <div>
              {t(`${P}.resultDelta`)}: {money(applyResult.batch.total_delta_amount)}
            </div>
            {applyResult.receivable_ids.length > 0 ? (
              <div>
                <strong>{t(`${P}.resultReceivables`)}</strong>
                <Space wrap style={{ marginTop: 8 }}>
                  {applyResult.receivable_ids.map((id) => (
                    <Button
                      key={id}
                      type="link"
                      size="small"
                      onClick={() => navigate(`/apps/kuaicaiwu/finance-management/receivables/${id}`)}
                    >
                      #{id}
                    </Button>
                  ))}
                </Space>
              </div>
            ) : null}
            {applyResult.payable_ids.length > 0 ? (
              <div>
                <strong>{t(`${P}.resultPayables`)}</strong>
                <Space wrap style={{ marginTop: 8 }}>
                  {applyResult.payable_ids.map((id) => (
                    <Button
                      key={id}
                      type="link"
                      size="small"
                      onClick={() => navigate(`/apps/kuaicaiwu/finance-management/payables/${id}`)}
                    >
                      #{id}
                    </Button>
                  ))}
                </Space>
              </div>
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </>
  );
};

const PriceSettlementPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSide = searchParams.get('side') === 'purchase' ? 'purchase' : 'sales';
  const initialPartnerId = parsePositiveInt(searchParams.get('partnerId'));
  const initialPeriod = searchParams.get('period');
  const [activeTab, setActiveTab] = useState<Side>(initialSide);

  const handleTabChange = (key: string) => {
    const side = key as Side;
    setActiveTab(side);
    const next = new URLSearchParams(searchParams);
    next.set('side', side);
    setSearchParams(next, { replace: true });
  };

  const tabs = useMemo(
    () => [
      {
        key: 'sales',
        label: t(`${P}.sideSales`),
        children: (
          <PriceSettlementPanel
            side="sales"
            initialPartnerId={initialSide === 'sales' ? initialPartnerId : null}
            initialPeriod={initialSide === 'sales' ? initialPeriod : null}
          />
        ),
      },
      {
        key: 'purchase',
        label: t(`${P}.sidePurchase`),
        children: (
          <PriceSettlementPanel
            side="purchase"
            initialPartnerId={initialSide === 'purchase' ? initialPartnerId : null}
            initialPeriod={initialSide === 'purchase' ? initialPeriod : null}
          />
        ),
      },
    ],
    [initialPartnerId, initialPeriod, initialSide, t],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={handleTabChange}
      preserveMounted
      tabs={tabs}
    />
  );
};

export default PriceSettlementPage;
