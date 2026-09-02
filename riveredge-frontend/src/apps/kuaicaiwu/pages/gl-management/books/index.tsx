/**
 * 总账账簿查询
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Descriptions,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { apiRequest } from '../../../../../services/api';
import { glService, type GlAccount, type GlVoucherLine } from '../../../services/gl';

const NS = 'app.kuaicaiwu.gl.books';

const asList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const obj = res as { data?: T[]; items?: T[]; rows?: T[]; entries?: T[] } | null;
  return obj?.data ?? obj?.items ?? obj?.rows ?? obj?.entries ?? [];
};

type Row = Record<string, unknown>;

const GlBooksPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const now = new Date();
  const [activeTab, setActiveTab] = useState('balance');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [includeUnposted, setIncludeUnposted] = useState(false);
  const [accountId, setAccountId] = useState<number | undefined>();
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [trialSummary, setTrialSummary] = useState<Row | null>(null);
  const [auxCustomerId, setAuxCustomerId] = useState<number | undefined>();
  const [auxSupplierId, setAuxSupplierId] = useState<number | undefined>();
  const [auxDepartmentId, setAuxDepartmentId] = useState<number | undefined>();
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [voucherDetailOpen, setVoucherDetailOpen] = useState(false);
  const [voucherDetail, setVoucherDetail] = useState<Row | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, custRes, suppRes, deptRes] = await Promise.all([
          glService.listAccounts({ is_active: true }),
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', {
            params: { limit: 1000, is_active: true },
          }),
          apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', {
            params: { limit: 1000, is_active: true },
          }),
          apiRequest<unknown>('/core/departments/tree', { method: 'GET' }),
        ]);
        if (cancelled) return;
        setAccounts(asList<GlAccount>(accRes));
        const mapPartner = (res: unknown) =>
          asList<Record<string, unknown>>(res).map((c) => ({
            label: String(c.name || c.customer_name || c.supplier_name || c.code || c.id),
            value: Number(c.id),
          }));
        setCustomerOptions(mapPartner(custRes));
        setSupplierOptions(mapPartner(suppRes));
        const flattenDept = (nodes: any[], out: { label: string; value: number }[] = []) => {
          for (const n of nodes || []) {
            if (n?.id) out.push({ label: String(n.name || n.title || n.id), value: Number(n.id) });
            if (n?.children) flattenDept(n.children, out);
          }
          return out;
        };
        const deptTree = (deptRes as any)?.items || (deptRes as any)?.data || deptRes;
        setDepartmentOptions(flattenDept(Array.isArray(deptTree) ? deptTree : []));
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setCustomerOptions([]);
          setSupplierOptions([]);
          setDepartmentOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.is_leaf)
        .map((a) => ({ label: `${a.account_code} ${a.account_name}`, value: a.id })),
    [accounts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setTrialSummary(null);
    try {
      const params = { year, month, include_unposted: includeUnposted };
      let data: Row[] = [];
      if (activeTab === 'balance') {
        data = asList<Row>(await glService.balanceSheet(params));
      } else if (activeTab === 'detail') {
        if (!accountId) {
          messageApi.warning(t(`${NS}.selectAccount`, { defaultValue: '请选择科目' }));
          setRows([]);
          return;
        }
        const res = (await glService.detailLedger({
          ...params,
          account_id: accountId,
          customer_id: auxCustomerId,
          supplier_id: auxSupplierId,
          department_id: auxDepartmentId,
        })) as {
          entries?: Row[];
        };
        data = asList<Row>(res?.entries ?? res);
      } else if (activeTab === 'general') {
        const res = await glService.generalLedger(params);
        data = asList<Row>(res);
      } else if (activeTab === 'trial') {
        const res = (await glService.trialBalance(params)) as Row & { rows?: Row[] };
        setTrialSummary(res);
        data = asList<Row>(res?.rows ?? res);
      } else if (activeTab === 'aux') {
        data = asList<Row>(
          await glService.balanceSheet({
            ...params,
            aux_only: true,
            customer_id: auxCustomerId,
            supplier_id: auxSupplierId,
            department_id: auxDepartmentId,
          }),
        );
      } else if (activeTab === 'voucherSummary') {
        data = asList<Row>(await glService.voucherSummary(params));
      }
      setRows(data);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, year, month, includeUnposted, accountId, auxCustomerId, auxSupplierId, auxDepartmentId, messageApi, t]);

  useEffect(() => {
    if (activeTab !== 'detail') {
      void load();
    }
  }, [activeTab, year, month, includeUnposted]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (v: unknown) => Number(v || 0).toFixed(2);

  const columnsByTab = useMemo(() => {
    if (activeTab === 'detail') {
      return [
        { title: t(`${NS}.col.date`, { defaultValue: '日期' }), dataIndex: 'voucher_date', width: 110 },
        {
          title: t(`${NS}.col.voucherCode`, { defaultValue: '凭证号' }),
          dataIndex: 'voucher_code',
          width: 120,
          render: (v: unknown, r: Row) => {
            const code = String(v || '');
            const vid = Number(r.voucher_id || 0);
            if (!code || !vid) return code || '—';
            return (
              <a
                onClick={() => {
                  void (async () => {
                    try {
                      const detail = (await glService.getVoucher(vid)) as Row;
                      setVoucherDetail(detail);
                      setVoucherDetailOpen(true);
                    } catch (error) {
                      messageApi.error(
                        getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })),
                      );
                    }
                  })();
                }}
              >
                {code}
              </a>
            );
          },
        },
        { title: t(`${NS}.col.summary`, { defaultValue: '摘要' }), dataIndex: 'summary', ellipsis: true },
        {
          title: t(`${NS}.col.debit`, { defaultValue: '借方' }),
          dataIndex: 'debit_amount',
          align: 'right' as const,
          width: 120,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.credit`, { defaultValue: '贷方' }),
          dataIndex: 'credit_amount',
          align: 'right' as const,
          width: 120,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.balance`, { defaultValue: '余额' }),
          key: 'balance',
          align: 'right' as const,
          width: 120,
          render: (_: unknown, r: Row) =>
            money(Number(r.balance_debit || 0) || Number(r.balance_credit || 0)),
        },
      ];
    }
    if (activeTab === 'voucherSummary') {
      return [
        { title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }), dataIndex: 'account_code', width: 120 },
        { title: t(`${NS}.col.accountName`, { defaultValue: '科目名称' }), dataIndex: 'account_name', ellipsis: true },
        {
          title: t(`${NS}.col.debit`, { defaultValue: '借方' }),
          dataIndex: 'debit_amount',
          align: 'right' as const,
          width: 120,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.credit`, { defaultValue: '贷方' }),
          dataIndex: 'credit_amount',
          align: 'right' as const,
          width: 120,
          render: (v: unknown) => money(v),
        },
      ];
    }
    if (activeTab === 'general') {
      return [
        { title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }), dataIndex: 'account_code', width: 120 },
        { title: t(`${NS}.col.accountName`, { defaultValue: '科目名称' }), dataIndex: 'account_name', ellipsis: true },
        {
          title: t(`${NS}.col.openingDebit`, { defaultValue: '期初借' }),
          dataIndex: 'opening_debit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.openingCredit`, { defaultValue: '期初贷' }),
          dataIndex: 'opening_credit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.periodDebit`, { defaultValue: '本期借' }),
          dataIndex: 'period_debit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.periodCredit`, { defaultValue: '本期贷' }),
          dataIndex: 'period_credit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.endingDebit`, { defaultValue: '期末借' }),
          dataIndex: 'ending_debit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.endingCredit`, { defaultValue: '期末贷' }),
          dataIndex: 'ending_credit',
          align: 'right' as const,
          width: 110,
          render: (v: unknown) => money(v),
        },
      ];
    }
    // balance / trial / aux
    return [
      { title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }), dataIndex: 'account_code', width: 120 },
      { title: t(`${NS}.col.accountName`, { defaultValue: '科目名称' }), dataIndex: 'account_name', ellipsis: true },
      ...(activeTab === 'aux'
        ? [
            {
              title: t(`${NS}.col.aux`, { defaultValue: '辅助' }),
              key: 'aux',
              width: 160,
              render: (_: unknown, r: Row) =>
                [r.customer_id && `C${r.customer_id}`, r.supplier_id && `S${r.supplier_id}`, r.department_id && `D${r.department_id}`]
                  .filter(Boolean)
                  .join(' ') || '—',
            },
          ]
        : []),
      {
        title: t(`${NS}.col.openingDebit`, { defaultValue: '期初借' }),
        dataIndex: 'opening_debit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
      {
        title: t(`${NS}.col.openingCredit`, { defaultValue: '期初贷' }),
        dataIndex: 'opening_credit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
      {
        title: t(`${NS}.col.periodDebit`, { defaultValue: '本期借' }),
        dataIndex: 'period_debit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
      {
        title: t(`${NS}.col.periodCredit`, { defaultValue: '本期贷' }),
        dataIndex: 'period_credit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
      {
        title: t(`${NS}.col.endingDebit`, { defaultValue: '期末借' }),
        dataIndex: 'ending_debit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
      {
        title: t(`${NS}.col.endingCredit`, { defaultValue: '期末贷' }),
        dataIndex: 'ending_credit',
        align: 'right' as const,
        width: 110,
        render: (v: unknown) => money(v),
      },
    ];
  }, [activeTab, t, messageApi]);

  const voucherLines = (voucherDetail?.lines as GlVoucherLine[] | undefined) || [];

  return (
    <ListPageTemplate>
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyItems: 'center', justifyContent: 'space-between' }}>
          <Space wrap>
            <Space.Compact>
              <InputNumber
                size="medium"
                precision={0}
                value={year}
                onChange={(v) => setYear(Number(v) || now.getFullYear())}
                prefix={t(`${NS}.year`, { defaultValue: '年' })}
                style={{ width: 140 }}
              />
              <InputNumber
                size="medium"
                min={1}
                max={12}
                precision={0}
                value={month}
                onChange={(v) => setMonth(Number(v) || 1)}
                prefix={t(`${NS}.month`, { defaultValue: '月' })}
                style={{ width: 120 }}
              />
            </Space.Compact>
            <Checkbox
              checked={includeUnposted}
              onChange={(e) => setIncludeUnposted(e.target.checked)}
            >
              {t(`${NS}.includeUnposted`, { defaultValue: '含未记账' })}
            </Checkbox>
            {activeTab === 'detail' ? (
              <Select
                size="medium"
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 280 }}
                placeholder={t(`${NS}.selectAccount`, { defaultValue: '请选择科目' })}
                options={accountOptions}
                value={accountId}
                onChange={setAccountId}
                allowClear
              />
            ) : null}
            {activeTab === 'detail' || activeTab === 'aux' ? (
              <>
                <Select
                  size="medium"
                  showSearch
                  optionFilterProp="label"
                  style={{ minWidth: 200 }}
                  placeholder={t(`${NS}.filter.customer`, { defaultValue: '客户' })}
                  options={customerOptions}
                  value={auxCustomerId}
                  onChange={(v) => setAuxCustomerId(v ?? undefined)}
                  allowClear
                />
                <Select
                  size="medium"
                  showSearch
                  optionFilterProp="label"
                  style={{ minWidth: 200 }}
                  placeholder={t(`${NS}.filter.supplier`, { defaultValue: '供应商' })}
                  options={supplierOptions}
                  value={auxSupplierId}
                  onChange={(v) => setAuxSupplierId(v ?? undefined)}
                  allowClear
                />
                <Select
                  size="medium"
                  showSearch
                  optionFilterProp="label"
                  style={{ minWidth: 200 }}
                  placeholder={t(`${NS}.filter.department`, { defaultValue: '部门' })}
                  options={departmentOptions}
                  value={auxDepartmentId}
                  onChange={(v) => setAuxDepartmentId(v ?? undefined)}
                  allowClear
                />
              </>
            ) : null}
            <Button type="primary" loading={loading} onClick={() => void load()}>
              {t('common.query', { defaultValue: '查询' })}
            </Button>
          </Space>
          <Space wrap>
            <Button
              onClick={() => {
                const header = columnsByTab.map((c: any) => c.title).join(',');
                const body = rows
                  .map((r) =>
                    columnsByTab
                      .map((c: any) => {
                        const key = c.dataIndex || c.key;
                        return `"${String(key ? r[key] ?? '' : '').replace(/"/g, '""')}"`;
                      })
                      .join(','),
                  )
                  .join('\n');
                const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `gl-books-${activeTab}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t('common.export', { defaultValue: '导出' })}
            </Button>
            <Button onClick={() => window.print()}>
              {t('common.print', { defaultValue: '打印' })}
            </Button>
          </Space>
        </div>

        {activeTab === 'trial' && trialSummary ? (
          <Typography.Text type={trialSummary.balanced ? 'success' : 'danger'}>
            {trialSummary.balanced
              ? t(`${NS}.trialBalanced`, { defaultValue: '试算平衡' })
              : t(`${NS}.trialUnbalanced`, { defaultValue: '试算不平衡' })}
            {' — '}
            {t(`${NS}.trialTotals`, {
              defaultValue: '期末借 {{d}} / 贷 {{c}}',
              d: money(trialSummary.ending_debit),
              c: money(trialSummary.ending_credit),
            })}
          </Typography.Text>
        ) : null}

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setRows([]);
          }}
          items={[
            { key: 'balance', label: t(`${NS}.tab.balance`, { defaultValue: '科目余额表' }) },
            { key: 'detail', label: t(`${NS}.tab.detail`, { defaultValue: '明细账' }) },
            { key: 'general', label: t(`${NS}.tab.general`, { defaultValue: '总账' }) },
            { key: 'trial', label: t(`${NS}.tab.trial`, { defaultValue: '试算平衡' }) },
            { key: 'aux', label: t(`${NS}.tab.aux`, { defaultValue: '辅助余额' }) },
            {
              key: 'voucherSummary',
              label: t(`${NS}.tab.voucherSummary`, { defaultValue: '凭证汇总' }),
            },
          ]}
        />

        <Table
          rowKey={(r, i) =>
            String(r.id ?? `${r.account_id ?? ''}-${r.voucher_code ?? ''}-${i}`)
          }
          loading={loading}
          columns={columnsByTab as any}
          dataSource={rows}
          size="medium"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 960 }}
        />
      </Space>

      <Modal
        title={t(`${NS}.voucherDetail`, { defaultValue: '凭证详情' })}
        open={voucherDetailOpen}
        onCancel={() => {
          setVoucherDetailOpen(false);
          setVoucherDetail(null);
        }}
        footer={null}
        width={MODAL_CONFIG.LARGE_WIDTH}
        destroyOnHidden
      >
        {voucherDetail ? (
          <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label={t(`${NS}.col.voucherCode`, { defaultValue: '凭证号' })}>
                {String(voucherDetail.voucher_code || '—')}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.date`, { defaultValue: '日期' })}>
                {String(voucherDetail.voucher_date || '—')}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${NS}.col.summary`, { defaultValue: '摘要' })}>
                {String(voucherDetail.summary || '—')}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status', { defaultValue: '状态' })}>
                {String(voucherDetail.status || '—')}
              </Descriptions.Item>
            </Descriptions>
            <Table
              rowKey={(r, i) => String(r.id ?? i)}
              size="medium"
              pagination={false}
              dataSource={voucherLines}
              columns={[
                {
                  title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }),
                  dataIndex: 'account_code',
                  width: 110,
                },
                {
                  title: t(`${NS}.col.accountName`, { defaultValue: '科目名称' }),
                  dataIndex: 'account_name',
                  ellipsis: true,
                },
                {
                  title: t(`${NS}.col.summary`, { defaultValue: '摘要' }),
                  dataIndex: 'summary',
                  ellipsis: true,
                },
                {
                  title: t(`${NS}.col.debit`, { defaultValue: '借方' }),
                  dataIndex: 'debit_amount',
                  align: 'right' as const,
                  width: 110,
                  render: (v: unknown) => money(v),
                },
                {
                  title: t(`${NS}.col.credit`, { defaultValue: '贷方' }),
                  dataIndex: 'credit_amount',
                  align: 'right' as const,
                  width: 110,
                  render: (v: unknown) => money(v),
                },
              ]}
            />
          </Space>
        ) : null}
      </Modal>
    </ListPageTemplate>
  );
};

export default GlBooksPage;
