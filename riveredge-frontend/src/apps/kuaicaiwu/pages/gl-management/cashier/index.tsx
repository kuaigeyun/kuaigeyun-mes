/**
 * 出纳：日记账 / 银行对账 / 余额调节表
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProFormCheckbox,
  ProFormDatePicker,
  ProFormDigit,
  ProFormText,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Descriptions,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { glService, type GlAccount } from '../../../services/gl';
const NS = 'app.kuaicaiwu.gl.cashier';

const asList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const obj = res as { data?: T[]; items?: T[]; entries?: T[] } | null;
  return obj?.data ?? obj?.items ?? obj?.entries ?? [];
};

type Row = Record<string, unknown>;

const GlCashierPage: React.FC = () => {
  const { t } = useTranslation();
  const amountDecimals = useNumericPrecisionPlaces('amount');
  const { message: messageApi } = App.useApp();
  const now = new Date();
  const [activeTab, setActiveTab] = useState('journal');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [kind, setKind] = useState<'cash' | 'bank'>('cash');
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [glAccountId, setGlAccountId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [journalRows, setJournalRows] = useState<Row[]>([]);
  const [reconcileRows, setReconcileRows] = useState<Row[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [bankBalance, setBankBalance] = useState<number>(0);
  const [adjustment, setAdjustment] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [cheques, setCheques] = useState<Row[]>([]);
  const [chequeOpen, setChequeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await glService.listAccounts({ is_active: true });
        if (!cancelled) {
          const list = asList<GlAccount>(res);
          setAccounts(list);
          const bankOrCash = list.find((a) => a.is_bank_journal || a.is_cash_journal);
          if (bankOrCash) setGlAccountId(bankOrCash.id);
        }
      } catch {
        if (!cancelled) setAccounts([]);
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

  const loadJournal = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await glService.cashierJournal({
        year,
        month,
        kind,
        account_id: glAccountId,
      })) as { entries?: Row[] };
      setJournalRows(asList<Row>(res?.entries ?? res));
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setJournalRows([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, kind, glAccountId, messageApi, t]);

  const loadReconcile = useCallback(async () => {
    if (!glAccountId) {
      messageApi.warning(t(`${NS}.selectAccount`, { defaultValue: '请选择总账科目' }));
      return;
    }
    setLoading(true);
    try {
      const res = await glService.listReconcileItems({
        gl_account_id: glAccountId,
        year,
        month,
      });
      setReconcileRows(asList<Row>(res));
      setSelectedKeys([]);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setReconcileRows([]);
    } finally {
      setLoading(false);
    }
  }, [glAccountId, year, month, messageApi, t]);

  const loadAdjustment = useCallback(async () => {
    if (!glAccountId) {
      messageApi.warning(t(`${NS}.selectAccount`, { defaultValue: '请选择总账科目' }));
      return;
    }
    setLoading(true);
    try {
      const res = (await glService.balanceAdjustment({
        gl_account_id: glAccountId,
        year,
        month,
        bank_balance: bankBalance,
      })) as Row;
      setAdjustment(res);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setAdjustment(null);
    } finally {
      setLoading(false);
    }
  }, [glAccountId, year, month, bankBalance, messageApi, t]);

  const loadCheques = useCallback(async () => {
    setLoading(true);
    try {
      const res = await glService.listCheques(glAccountId);
      setCheques(asList<Row>(res));
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setCheques([]);
    } finally {
      setLoading(false);
    }
  }, [glAccountId, messageApi, t]);

  const handleSync = async () => {
    if (!glAccountId) return;
    try {
      await glService.syncEnterprise(glAccountId, year, month);
      messageApi.success(t(`${NS}.syncSuccess`, { defaultValue: '企业账已同步' }));
      await loadReconcile();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t(`${NS}.syncFailed`, { defaultValue: '同步失败' })));
    }
  };

  const handleMatch = async () => {
    if (selectedKeys.length < 2) {
      messageApi.warning(t(`${NS}.selectMatchItems`, { defaultValue: '请至少勾选两条记录进行勾对' }));
      return;
    }
    try {
      await glService.matchReconcile(selectedKeys.map((k) => Number(k)));
      messageApi.success(t(`${NS}.matchSuccess`, { defaultValue: '勾对成功' }));
      await loadReconcile();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t(`${NS}.matchFailed`, { defaultValue: '勾对失败' })));
    }
  };

  const handleAddBankItem = async (values: Record<string, unknown>) => {
    if (!glAccountId) return;
    try {
      await glService.addReconcileItem({
        gl_account_id: glAccountId,
        period_year: year,
        period_month: month,
        txn_date: values.txn_date
          ? dayjs(values.txn_date as string).format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        summary: values.summary,
        debit_amount: Number(values.debit_amount || 0),
        credit_amount: Number(values.credit_amount || 0),
        is_opening: Boolean(values.is_opening),
      });
      messageApi.success(t(`${NS}.addSuccess`, { defaultValue: '银行对账单已添加' }));
      setAddOpen(false);
      await loadReconcile();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })));
    }
  };

  const money = (v: unknown) => Number(v || 0).toFixed(2);

  const journalColumns = [
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
                  const detail = await glService.getVoucher(vid);
                  messageApi.info(
                    `${detail.voucher_code} ${detail.summary || ''} 借${detail.total_debit} 贷${detail.total_credit}`,
                  );
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
  ];

  const reconcileColumns = [
    {
      title: t(`${NS}.col.side`, { defaultValue: '方向' }),
      dataIndex: 'side',
      width: 100,
      render: (v: string) =>
        v === 'bank'
          ? t(`${NS}.side.bank`, { defaultValue: '银行' })
          : t(`${NS}.side.enterprise`, { defaultValue: '企业' }),
    },
    { title: t(`${NS}.col.date`, { defaultValue: '日期' }), dataIndex: 'txn_date', width: 110 },
    { title: t(`${NS}.col.summary`, { defaultValue: '摘要' }), dataIndex: 'summary', ellipsis: true },
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
    {
      title: t(`${NS}.col.matched`, { defaultValue: '已勾对' }),
      dataIndex: 'is_matched',
      width: 90,
      render: (v: boolean) =>
        v ? t('common.yes', { defaultValue: '是' }) : t('common.no', { defaultValue: '否' }),
    },
    {
      title: t(`${NS}.col.opening`, { defaultValue: '期初未达' }),
      dataIndex: 'is_opening',
      width: 100,
      render: (v: boolean) =>
        v ? t('common.yes', { defaultValue: '是' }) : t('common.no', { defaultValue: '否' }),
    },
  ];

  const periodControls = (
    <Space wrap>
      <Space.Compact>
        <InputNumber
          size="medium"
          precision={0}
          value={year}
          onChange={(v) => setYear(Number(v) || now.getFullYear())}
          addonBefore={t(`${NS}.year`, { defaultValue: '年' })}
          style={{ width: 140 }}
        />
        <InputNumber
          size="medium"
          min={1}
          max={12}
          precision={0}
          value={month}
          onChange={(v) => setMonth(Number(v) || 1)}
          addonBefore={t(`${NS}.month`, { defaultValue: '月' })}
          style={{ width: 120 }}
        />
      </Space.Compact>
      {(activeTab === 'reconcile' || activeTab === 'adjustment' || activeTab === 'cheques') && (
        <Select
          size="medium"
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 260 }}
          options={accountOptions}
          value={glAccountId}
          onChange={setGlAccountId}
          placeholder={t(`${NS}.selectAccount`, { defaultValue: '请选择总账科目' })}
        />
      )}
    </Space>
  );

  return (
    <ListPageTemplate>
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'journal', label: t(`${NS}.tab.journal`, { defaultValue: '日记账' }) },
            { key: 'reconcile', label: t(`${NS}.tab.reconcile`, { defaultValue: '银行对账' }) },
            {
              key: 'adjustment',
              label: t(`${NS}.tab.adjustment`, { defaultValue: '余额调节表' }),
            },
            { key: 'cheques', label: t(`${NS}.tab.cheques`, { defaultValue: '支票' }) },
          ]}
        />

        {activeTab === 'journal' ? (
          <>
            <Space wrap>
              {periodControls}
              <Select
                size="medium"
                style={{ width: 120 }}
                value={kind}
                onChange={(v) => setKind(v)}
                options={[
                  { label: t(`${NS}.kind.cash`, { defaultValue: '现金' }), value: 'cash' },
                  { label: t(`${NS}.kind.bank`, { defaultValue: '银行' }), value: 'bank' },
                ]}
              />
              <Select
                size="medium"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 260 }}
                options={accountOptions}
                value={glAccountId}
                onChange={setGlAccountId}
                placeholder={t(`${NS}.optionalAccount`, { defaultValue: '科目（可选）' })}
              />
              <Button type="primary" loading={loading} onClick={() => void loadJournal()}>
                {t('common.query', { defaultValue: '查询' })}
              </Button>
            </Space>
            <Table
              rowKey={(r, i) => String(r.id ?? `${r.voucher_code}-${i}`)}
              loading={loading}
              columns={journalColumns}
              dataSource={journalRows}
              size="medium"
              pagination={{ pageSize: 50 }}
              scroll={{ x: 800 }}
            />
          </>
        ) : null}

        {activeTab === 'reconcile' ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <Space wrap>
                {periodControls}
                <Button onClick={() => setAddOpen(true)}>
                  {t(`${NS}.addBankItem`, { defaultValue: '添加银行对账单' })}
                </Button>
                <Button onClick={() => void handleMatch()}>
                  {t(`${NS}.match`, { defaultValue: '勾对选中' })}
                </Button>
                <Button type="primary" loading={loading} onClick={() => void loadReconcile()}>
                  {t('common.query', { defaultValue: '查询' })}
                </Button>
              </Space>
              <Button onClick={() => void handleSync()}>
                {t(`${NS}.syncEnterprise`, { defaultValue: '同步企业账' })}
              </Button>
            </div>
            <Table
              rowKey="id"
              loading={loading}
              columns={reconcileColumns}
              dataSource={reconcileRows}
              size="medium"
              pagination={{ pageSize: 50 }}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: setSelectedKeys,
                getCheckboxProps: (r) => ({ disabled: Boolean(r.is_matched) }),
              }}
              scroll={{ x: 860 }}
            />
          </>
        ) : null}

        {activeTab === 'adjustment' ? (
          <>
            <Space wrap>
              {periodControls}
              <InputNumber
                size="medium"
                precision={amountDecimals}
                value={bankBalance}
                onChange={(v) => setBankBalance(Number(v || 0))}
                addonBefore={t(`${NS}.bankBalance`, { defaultValue: '银行余额' })}
                style={{ width: 220 }}
              />
              <Button type="primary" loading={loading} onClick={() => void loadAdjustment()}>
                {t(`${NS}.calcAdjustment`, { defaultValue: '生成调节表' })}
              </Button>
            </Space>
            {adjustment ? (
              <>
                <Alert
                  showIcon
                  type={adjustment.balanced ? 'success' : 'warning'}
                  title={
                    adjustment.balanced
                      ? t(`${NS}.adjustmentBalanced`, { defaultValue: '调节后平衡' })
                      : t(`${NS}.adjustmentUnbalanced`, { defaultValue: '调节后不平衡' })
                  }
                />
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label={t(`${NS}.bookBalance`, { defaultValue: '企业账面余额' })}>
                    {money(adjustment.book_balance)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t(`${NS}.bankBalance`, { defaultValue: '银行余额' })}>
                    {money(adjustment.bank_balance)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={t(`${NS}.enterpriseUnrecordedDebit`, { defaultValue: '银行已收企业未收' })}
                  >
                    {money(adjustment.enterprise_unrecorded_debit)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={t(`${NS}.enterpriseUnrecordedCredit`, { defaultValue: '银行已付企业未付' })}
                  >
                    {money(adjustment.enterprise_unrecorded_credit)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={t(`${NS}.bankUnrecordedDebit`, { defaultValue: '企业已收银行未收' })}
                  >
                    {money(adjustment.bank_unrecorded_debit)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={t(`${NS}.bankUnrecordedCredit`, { defaultValue: '企业已付银行未付' })}
                  >
                    {money(adjustment.bank_unrecorded_credit)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t(`${NS}.adjustedBook`, { defaultValue: '调节后账面' })}>
                    {money(adjustment.adjusted_book_balance)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t(`${NS}.adjustedBank`, { defaultValue: '调节后银行' })}>
                    {money(adjustment.adjusted_bank_balance)}
                  </Descriptions.Item>
                </Descriptions>
                <Typography.Title level={5}>
                  {t(`${NS}.unmatchedItems`, { defaultValue: '未达账项' })}
                </Typography.Title>
                <Table
                  rowKey="id"
                  columns={reconcileColumns}
                  dataSource={asList<Row>(adjustment.unmatched_items)}
                  size="medium"
                  pagination={false}
                />
              </>
            ) : null}
          </>
        ) : null}
        {activeTab === 'cheques' ? (
          <>
            <Space wrap>
              {periodControls}
              <Button onClick={() => setChequeOpen(true)}>
                {t(`${NS}.addCheque`, { defaultValue: '登记支票' })}
              </Button>
              <Button type="primary" loading={loading} onClick={() => void loadCheques()}>
                {t('common.query', { defaultValue: '查询' })}
              </Button>
            </Space>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={cheques}
              size="medium"
              pagination={{ pageSize: 50 }}
              columns={[
                { title: t(`${NS}.col.chequeNo`, { defaultValue: '支票号' }), dataIndex: 'cheque_no', width: 140 },
                { title: t(`${NS}.col.date`, { defaultValue: '日期' }), dataIndex: 'issue_date', width: 110 },
                { title: t(`${NS}.col.payee`, { defaultValue: '收款人' }), dataIndex: 'payee', ellipsis: true },
                {
                  title: t(`${NS}.col.amount`, { defaultValue: '金额' }),
                  dataIndex: 'amount',
                  align: 'right' as const,
                  width: 120,
                  render: (v: unknown) => money(v),
                },
                { title: t('common.status', { defaultValue: '状态' }), dataIndex: 'status', width: 100 },
                {
                  title: t('common.action', { defaultValue: '操作' }),
                  key: 'action',
                  width: 160,
                  render: (_: unknown, r: Row) => (
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        disabled={r.status !== 'issued'}
                        onClick={() =>
                          void (async () => {
                            try {
                              await glService.clearCheque(Number(r.id));
                              messageApi.success(t(`${NS}.cleared`, { defaultValue: '已核销' }));
                              await loadCheques();
                            } catch (error) {
                              messageApi.error(
                                getApiErrorMessage(error, t('common.operationFailed', { defaultValue: '操作失败' })),
                              );
                            }
                          })()
                        }
                      >
                        {t(`${NS}.clear`, { defaultValue: '核销' })}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        disabled={r.status === 'void'}
                        onClick={() =>
                          void (async () => {
                            try {
                              await glService.voidCheque(Number(r.id));
                              messageApi.success(t(`${NS}.voided`, { defaultValue: '已作废' }));
                              await loadCheques();
                            } catch (error) {
                              messageApi.error(
                                getApiErrorMessage(error, t('common.operationFailed', { defaultValue: '操作失败' })),
                              );
                            }
                          })()
                        }
                      >
                        {t(`${NS}.void`, { defaultValue: '作废' })}
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </Space>

      <FormModalTemplate
        title={t(`${NS}.addBankItem`, { defaultValue: '添加银行对账单' })}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        width={MODAL_CONFIG.SMALL_WIDTH}
        onFinish={handleAddBankItem}
        initialValues={{ txn_date: dayjs(), debit_amount: 0, credit_amount: 0, is_opening: false }}
      >
        <ProFormDatePicker
          name="txn_date"
          label={t(`${NS}.col.date`, { defaultValue: '日期' })}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormText name="summary" label={t(`${NS}.col.summary`, { defaultValue: '摘要' })} />
        <ProFormDigit
          name="debit_amount"
          label={t(`${NS}.col.debit`, { defaultValue: '借方' })}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="credit_amount"
          label={t(`${NS}.col.credit`, { defaultValue: '贷方' })}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormCheckbox name="is_opening">
          {t(`${NS}.col.opening`, { defaultValue: '期初未达' })}
        </ProFormCheckbox>
      </FormModalTemplate>

      <FormModalTemplate
        title={t(`${NS}.addCheque`, { defaultValue: '登记支票' })}
        open={chequeOpen}
        onClose={() => setChequeOpen(false)}
        width={MODAL_CONFIG.SMALL_WIDTH}
        onFinish={async (values) => {
          if (!glAccountId) {
            messageApi.warning(t(`${NS}.selectAccount`, { defaultValue: '请选择总账科目' }));
            return;
          }
          try {
            await glService.createCheque({
              gl_account_id: glAccountId,
              cheque_no: values.cheque_no,
              issue_date: values.issue_date
                ? dayjs(values.issue_date as string).format('YYYY-MM-DD')
                : dayjs().format('YYYY-MM-DD'),
              payee: values.payee,
              amount: Number(values.amount || 0),
              notes: values.notes,
            });
            messageApi.success(t(`${NS}.addSuccess`, { defaultValue: '已登记' }));
            setChequeOpen(false);
            await loadCheques();
          } catch (error) {
            messageApi.error(
              getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })),
            );
          }
        }}
        initialValues={{ issue_date: dayjs(), amount: 0 }}
      >
        <ProFormText
          name="cheque_no"
          label={t(`${NS}.col.chequeNo`, { defaultValue: '支票号' })}
          rules={[{ required: true }]}
        />
        <ProFormDatePicker
          name="issue_date"
          label={t(`${NS}.col.date`, { defaultValue: '日期' })}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormText name="payee" label={t(`${NS}.col.payee`, { defaultValue: '收款人' })} />
        <ProFormDigit name="amount" label={t(`${NS}.col.amount`, { defaultValue: '金额' })} min={0} fieldProps={{ precision: 2 }} />
        <ProFormText name="notes" label={t('common.remark', { defaultValue: '备注' })} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default GlCashierPage;
