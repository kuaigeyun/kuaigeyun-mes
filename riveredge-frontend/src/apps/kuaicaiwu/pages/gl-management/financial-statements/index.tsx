/**
 * 法定三大报表：资产负债表 / 利润表 / 现金流量表
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { App, Button, Checkbox, InputNumber, Modal, Space, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useConfigStore } from '../../../../../stores';
import { glService } from '../../../services/gl';
import FinancialStatementPrintTemplate from './FinancialStatementPrintTemplate';
import { printFinancialStatementNode } from './printFinancialStatement';

const NS = 'app.kuaicaiwu.gl.statements';

type StatementKind = 'balance-sheet' | 'income' | 'cash-flow';
type Row = Record<string, unknown>;

const asRows = (res: unknown): Row[] => {
  if (Array.isArray(res)) return res as Row[];
  const obj = res as { rows?: Row[]; items?: Row[]; data?: Row[] } | null;
  return obj?.rows ?? obj?.items ?? obj?.data ?? [];
};

function resolveKind(pathname: string): StatementKind {
  if (pathname.endsWith('/income')) return 'income';
  if (pathname.endsWith('/cash-flow')) return 'cash-flow';
  return 'balance-sheet';
}

const money = (v: unknown) => Number(v || 0).toFixed(2);

const GlFinancialStatementsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const pathname = useLocation().pathname;
  const kind = resolveKind(pathname);
  const currentUser = useCurrentUser();
  const siteName = useConfigStore((s) => String(s.getConfig('site_name', '') || '').trim());
  const companyName = String(currentUser?.tenant_name || siteName || '').trim();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [includeUnposted, setIncludeUnposted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTime, setPrintTime] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const title = t(`${NS}.title.${kind}`, {
    defaultValue:
      kind === 'income' ? '利润表' : kind === 'cash-flow' ? '现金流量表' : '资产负债表',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { year, month, include_unposted: includeUnposted };
      let res: Row;
      if (kind === 'income') {
        res = (await glService.statutoryIncomeStatement(params)) as Row;
      } else if (kind === 'cash-flow') {
        res = (await glService.cashFlowStatement({ year, month })) as Row;
      } else {
        res = (await glService.statutoryBalanceSheet(params)) as Row;
      }
      setSummary(res);
      setRows(asRows(res));
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setSummary(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind, year, month, includeUnposted, messageApi, t]);

  useEffect(() => {
    void load();
  }, [kind, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryLabel = (value: unknown) => {
    const key = String(value || '');
    if (key === 'operating') return t(`${NS}.category.operating`, { defaultValue: '经营活动' });
    if (key === 'investing') return t(`${NS}.category.investing`, { defaultValue: '投资活动' });
    if (key === 'financing') return t(`${NS}.category.financing`, { defaultValue: '筹资活动' });
    return key || '—';
  };

  const columns = useMemo(() => {
    if (kind === 'cash-flow') {
      return [
        { title: t(`${NS}.col.itemCode`, { defaultValue: '项目编码' }), dataIndex: 'item_code', width: 120 },
        { title: t(`${NS}.col.label`, { defaultValue: '项目' }), dataIndex: 'item_name', ellipsis: true },
        {
          title: t(`${NS}.col.category`, { defaultValue: '类别' }),
          dataIndex: 'category',
          width: 120,
          render: (v: unknown) => categoryLabel(v),
        },
        {
          title: t(`${NS}.col.amount`, { defaultValue: '金额' }),
          dataIndex: 'signed_amount',
          align: 'right' as const,
          width: 140,
          render: (v: unknown, r: Row) => money(v ?? r.amount),
        },
      ];
    }
    if (kind === 'income') {
      return [
        { title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }), dataIndex: 'account_code', width: 120 },
        { title: t(`${NS}.col.label`, { defaultValue: '项目' }), dataIndex: 'label', ellipsis: true },
        {
          title: t(`${NS}.col.periodAmount`, { defaultValue: '本期金额' }),
          dataIndex: 'period_amount',
          align: 'right' as const,
          width: 140,
          render: (v: unknown) => money(v),
        },
        {
          title: t(`${NS}.col.yearAmount`, { defaultValue: '本年累计' }),
          dataIndex: 'year_amount',
          align: 'right' as const,
          width: 140,
          render: (v: unknown) => money(v),
        },
      ];
    }
    return [
      { title: t(`${NS}.col.accountCode`, { defaultValue: '科目编码' }), dataIndex: 'account_code', width: 120 },
      { title: t(`${NS}.col.label`, { defaultValue: '项目' }), dataIndex: 'label', ellipsis: true },
      {
        title: t(`${NS}.col.amount`, { defaultValue: '期末余额' }),
        dataIndex: 'amount',
        align: 'right' as const,
        width: 160,
        render: (v: unknown) => money(v),
      },
    ];
  }, [kind, t]);

  const exportCsv = () => {
    const header = columns.map((c) => c.title).join(',');
    const body = rows
      .map((r) =>
        columns
          .map((c) => {
            const key = (c as { dataIndex?: string }).dataIndex;
            return `"${String(key ? r[key] ?? '' : '').replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gl-${kind}-${year}${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ListPageTemplate>
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <Space.Compact>
              <InputNumber
                min={2000}
                max={2100}
                precision={0}
                value={year}
                onChange={(v) => setYear(Number(v) || now.getFullYear())}
                addonBefore={t(`${NS}.year`, { defaultValue: '年' })}
                style={{ width: 140 }}
              />
              <InputNumber
                min={1}
                max={12}
                precision={0}
                value={month}
                onChange={(v) => setMonth(Number(v) || 1)}
                addonBefore={t(`${NS}.month`, { defaultValue: '月' })}
                style={{ width: 120 }}
              />
            </Space.Compact>
            {kind !== 'cash-flow' ? (
              <Checkbox
                checked={includeUnposted}
                onChange={(e) => setIncludeUnposted(e.target.checked)}
              >
                {t(`${NS}.includeUnposted`, { defaultValue: '含未记账' })}
              </Checkbox>
            ) : null}
            <Button type="primary" loading={loading} onClick={() => void load()}>
              {t('common.query', { defaultValue: '查询' })}
            </Button>
          </Space>
          <Space wrap>
            <Button onClick={exportCsv}>{t('common.export', { defaultValue: '导出' })}</Button>
            <Button
              onClick={() => {
                if (!rows.length) {
                  messageApi.warning(t(`${NS}.print.empty`, { defaultValue: '暂无报表数据可打印' }));
                  return;
                }
                setPrintTime(formatDateTimeBySiteSetting(new Date()));
                setPrintOpen(true);
              }}
            >
              {t('common.print', { defaultValue: '打印' })}
            </Button>
          </Space>
        </div>

        {kind === 'balance-sheet' && summary ? (
          <Typography.Text type={summary.balanced ? 'success' : 'danger'}>
            {summary.balanced
              ? t(`${NS}.balanced`, { defaultValue: '资产 = 负债 + 权益' })
              : t(`${NS}.unbalanced`, { defaultValue: '资产负债表不平衡' })}
            {' — '}
            {t(`${NS}.balanceTotals`, {
              defaultValue: '资产 {{a}} / 负债+权益 {{le}}',
              a: money(summary.total_assets),
              le: money(summary.total_liabilities_and_equity),
            })}
          </Typography.Text>
        ) : null}

        {kind === 'income' && summary ? (
          <Typography.Text>
            {t(`${NS}.incomeTotals`, {
              defaultValue: '本期净利润 {{p}} / 本年累计 {{y}}',
              p: money(summary.period_profit),
              y: money(summary.year_profit),
            })}
          </Typography.Text>
        ) : null}

        {kind === 'cash-flow' && summary ? (
          <Typography.Text>
            {t(`${NS}.cashFlowNet`, {
              defaultValue: '经营 {{o}} / 投资 {{i}} / 筹资 {{f}} / 净增加 {{n}}',
              o: money(summary.operating_net),
              i: money(summary.investing_net),
              f: money(summary.financing_net),
              n: money(summary.net_increase),
            })}
          </Typography.Text>
        ) : null}

        <Table
          rowKey={(r, i) => String(r.line_key ?? r.item_code ?? `${r.account_id ?? ''}-${i}`)}
          loading={loading}
          columns={columns}
          dataSource={rows}
          size="medium"
          pagination={false}
          rowClassName={(r) => (r.is_total ? 'ant-table-row-selected' : '')}
          scroll={{ x: 720 }}
        />
      </Space>

      <Modal
        title={t(`${NS}.print.previewTitle`, { defaultValue: '标准打印预览' })}
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        destroyOnHidden
        mask={{ closable: true }}
        styles={{ body: { maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT, overflow: 'auto' } }}
        footer={
          <Space>
            <Button onClick={() => setPrintOpen(false)}>{t('common.cancel', { defaultValue: '取消' })}</Button>
            <Button
              type="primary"
              onClick={() => printFinancialStatementNode(printRef.current, title)}
            >
              {t(`${NS}.print.confirm`, { defaultValue: '打印' })}
            </Button>
          </Space>
        }
      >
        <div ref={printRef}>
          <FinancialStatementPrintTemplate
            kind={kind}
            title={title}
            year={year}
            month={month}
            companyName={companyName}
            preparedBy={currentUser?.full_name || currentUser?.username}
            printTime={printTime}
            rows={rows}
            summary={summary}
          />
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default GlFinancialStatementsPage;
