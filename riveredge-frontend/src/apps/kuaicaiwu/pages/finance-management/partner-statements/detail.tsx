/**
 * 往来对账单详情页
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import {
  partnerStatementService,
  PartnerStatement,
  PartnerStatementLine,
  downloadBlob,
} from '../../../services/finance/partnerStatement';
import {
  partnerStatementExpandableProps,
  usePartnerStatementInboundDetail,
} from '../../../components/PartnerStatementInboundDetail';
import {
  buildPartnerStatementStatusEnum,
  formatSentChannel,
  getSentChannelOptions,
} from '../../../utils/financeSharedOptions';
import { formatDateTime, formatCurrencyAmount } from '../../../../../utils/format';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  buildLineAmountPayload,
  patchLineStatementAmount,
  recalcPartnerStatementLines,
} from '../../../utils/partnerStatementAmountUtils';
import { usePartnerStatementLineColumns } from '../../../utils/partnerStatementLineColumns';
import { useFinanceVoucherDetail } from '../../../components/FinanceVoucherDetailProvider';
import { resolvePartnerStatementVoucherTarget } from '../../../utils/financeVoucherDocType';
import { getAntdModal } from '../../../../../utils/antdAppApis';
const PS = 'app.kuaicaiwu.partnerStatement';
const PARTNER_STATEMENT_RESOURCE = 'kuaicaiwu:partner-statement';

const money = (v: number | string | undefined) =>
  formatCurrencyAmount(v ?? 0);

const PartnerStatementDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const statementPerms = useResourcePermissions(PARTNER_STATEMENT_RESOURCE);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PartnerStatement | null>(null);
  const [localLines, setLocalLines] = useState<PartnerStatementLine[]>([]);
  const [localSummary, setLocalSummary] = useState<{
    opening_balance?: number;
    debit_total?: number;
    credit_total?: number;
    closing_balance?: number;
  } | null>(null);
  const [linesDirty, setLinesDirty] = useState(false);
  const [savingLines, setSavingLines] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const { cache: lineDetailCache, loadLineDetail, clearCache: clearLineDetailCache } = usePartnerStatementInboundDetail();

  const statusEnum = useMemo(() => buildPartnerStatementStatusEnum(t), [t]);
  const sentChannelOptions = useMemo(() => getSentChannelOptions(t), [t]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    clearLineDetailCache();
    try {
      const res = await partnerStatementService.get(Number(id));
      setData(res);
    } catch (e: any) {
      message.error(e?.message || t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [clearLineDetailCache, id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) {
      setLocalLines([]);
      setLocalSummary(null);
      setLinesDirty(false);
      return;
    }
    const opening = Number(
      data.transaction_details?.summary?.opening_balance ?? data.opening_balance ?? 0,
    );
    const srcLines = data.transaction_details?.lines || [];
    const recalc = recalcPartnerStatementLines(opening, srcLines);
    setLocalLines(recalc.lines);
    setLocalSummary({
      opening_balance: opening,
      debit_total: recalc.debitTotal,
      credit_total: recalc.creditTotal,
      closing_balance: recalc.closingBalance,
    });
    setLinesDirty(false);
  }, [data]);

  const linesEditable =
    !!data &&
    (data.status === 'Draft' || data.status === 'Disputed') &&
    statementPerms.canUpdate;

  const handleStatementAmountChange = useCallback(
    (lineKey: string, amount: number) => {
      setLocalLines((prev) => {
        const next = prev.map((ln, idx) => {
          const key = `${ln.doc_type}-${ln.doc_id}-${idx}`;
          if (key !== lineKey) return ln;
          return patchLineStatementAmount(ln, amount);
        });
        const opening = Number(
          localSummary?.opening_balance ?? data?.opening_balance ?? 0,
        );
        const recalc = recalcPartnerStatementLines(opening, next);
        setLocalSummary((s) => ({
          ...s,
          debit_total: recalc.debitTotal,
          credit_total: recalc.creditTotal,
          closing_balance: recalc.closingBalance,
        }));
        return recalc.lines;
      });
      setLinesDirty(true);
    },
    [data?.opening_balance, localSummary?.opening_balance],
  );

  const lineKeyFn = useCallback(
    (ln: PartnerStatementLine, idx: number) => `${ln.doc_type}-${ln.doc_id}-${idx}`,
    [],
  );

  const lines = localLines;
  const summary = localSummary || {
    opening_balance: data?.opening_balance,
    debit_total: data?.debit_total,
    credit_total: data?.credit_total,
    closing_balance: data?.closing_balance,
  };
  const balanceLabel = useMemo(() => {
    if (data?.transaction_details?.balance_label) {
      return data.transaction_details.balance_label;
    }
    return data?.partner_type === 'Customer'
      ? t(`${PS}.detail.receivableBalance`)
      : t(`${PS}.detail.payableBalance`);
  }, [data, t]);
  const snap = data?.transaction_details?.partner_snapshot || {};

  const { openFinanceVoucherDetail } = useFinanceVoucherDetail();

  const handleDocCodeClick = useCallback(
    (line: PartnerStatementLine) => {
      const target = resolvePartnerStatementVoucherTarget(line);
      if (target) openFinanceVoucherDetail(target);
    },
    [openFinanceVoucherDetail],
  );

  const lineColumns = usePartnerStatementLineColumns({
    t,
    balanceLabel,
    editable: linesEditable,
    onStatementAmountChange: handleStatementAmountChange,
    lineKey: lineKeyFn,
    onDocCodeClick: handleDocCodeClick,
  });

  const handleSaveLines = async () => {
    if (!data) return;
    setSavingLines(true);
    try {
      await partnerStatementService.updateLines(data.id, buildLineAmountPayload(localLines));
      message.success(t(`${PS}.detail.linesSaved`));
      setLinesDirty(false);
      await load();
    } catch (e: any) {
      message.error(e?.message || t('common.saveFailed'));
    } finally {
      setSavingLines(false);
    }
  };

  const handleConfirm = () => {
    if (!data) return;
    if (linesDirty) {
      message.warning(t(`${PS}.detail.saveLinesBeforeConfirm`));
      return;
    }
    getAntdModal().confirm({
      title: t(`${PS}.detail.confirmTitle`),
      content: t(`${PS}.detail.confirmContent`, { code: data.statement_code }),
      onOk: async () => {
        await partnerStatementService.confirm(data.id);
        message.success(t(`${PS}.detail.confirmed`));
        load();
      },
    });
  };

  const handleMarkSent = () => {
    if (!data) return;
    let channel = 'wechat_manual';
    let notes = '';
    getAntdModal().confirm({
      title: t(`${PS}.detail.markSentTitle`),
      width: 480,
      content: (
        <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }}>
          <Typography.Text type="secondary">
            {t(`${PS}.detail.markSentHint`)}
          </Typography.Text>
          <div>
            <Typography.Text>{t(`${PS}.detail.sentChannel`)}</Typography.Text>
            <select
              defaultValue={channel}
              style={{ width: '100%', marginTop: 4, padding: '4px 8px' }}
              onChange={(e) => { channel = e.target.value; }}
            >
              {sentChannelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Typography.Text>{t(`${PS}.detail.sentNotes`)}</Typography.Text>
            <Input.TextArea rows={2} style={{ marginTop: 4 }} onChange={(e) => { notes = e.target.value; }} />
          </div>
        </Space>
      ),
      onOk: async () => {
        await partnerStatementService.markSent(data.id, { channel, notes: notes.trim() || undefined });
        message.success(t(`${PS}.detail.markedSent`));
        load();
      },
    });
  };

  const handleDispute = () => {
    if (!data) return;
    let reason = '';
    getAntdModal().confirm({
      title: t(`${PS}.detail.disputeTitle`),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t(`${PS}.detail.disputePlaceholder`)}
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.warning(t(`${PS}.detail.disputeMissing`));
          return Promise.reject();
        }
        await partnerStatementService.dispute(data.id, reason.trim());
        message.success(t(`${PS}.detail.disputeRecorded`));
        load();
      },
    });
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!data) return;
    setExporting(format);
    try {
      const blob = await partnerStatementService.exportFile(data.id, format);
      const ext = format === 'pdf' && blob.type.includes('html') ? 'html' : format;
      downloadBlob(blob, t(`${PS}.detail.exportFilename`, { code: data.statement_code, ext }));
      message.success(t(`${PS}.detail.exportSuccess`));
    } catch (e: any) {
      message.error(e?.message || t('common.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!id) return null;

  const statusMeta = data ? statusEnum[data.status as keyof typeof statusEnum] : null;
  const statusColorMap: Record<string, string> = {
    Draft: 'default',
    Confirmed: 'processing',
    Sent: 'success',
    Disputed: 'warning',
  };

  const pageActions = data ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <Space wrap size={8}>
        <Button onClick={() => navigate('/apps/kuaicaiwu/finance-management/partner-statements')}>{t('common.back')}</Button>
        {linesEditable ? (
          <Button loading={savingLines} disabled={!linesDirty} onClick={() => void handleSaveLines()}>
            {t(`${PS}.detail.saveLines`)}
          </Button>
        ) : null}
        {data.status === 'Draft' || data.status === 'Disputed' ? (
          statementPerms.canUpdate ? (
          <Button type="primary" onClick={handleConfirm}>{t(`${PS}.detail.internalConfirm`)}</Button>
          ) : null
        ) : null}
        {data.status === 'Confirmed' && statementPerms.canUpdate ? (
          <Button type="primary" onClick={handleMarkSent}>{t(`${PS}.detail.markSent`)}</Button>
        ) : null}
        {(data.status === 'Sent' || data.status === 'Confirmed') && statementPerms.canUpdate ? (
          <Button danger onClick={handleDispute}>{t(`${PS}.detail.recordDispute`)}</Button>
        ) : null}
      </Space>
      <Space wrap size={8}>
        {statementPerms.canExport ? (
          <>
            <Button loading={exporting === 'xlsx'} onClick={() => void handleExport('xlsx')}>{t(`${PS}.detail.exportExcel`)}</Button>
            <Button loading={exporting === 'pdf'} onClick={() => void handleExport('pdf')}>{t(`${PS}.detail.exportPdf`)}</Button>
          </>
        ) : null}
        <Button onClick={handlePrint}>{t('common.print')}</Button>
      </Space>
    </div>
  ) : null;

  return (
    <div style={uniTabsChildPageVerticalInsetStyle()} className="partner-statement-detail">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .partner-statement-detail, .partner-statement-detail * { visibility: visible; }
          .partner-statement-detail { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE} className="no-print">
        <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
          {t(`${PS}.pageTitle`)} {data?.statement_code || ''}
        </Typography.Title>
        {pageActions}
      </div>

      {loading && !data ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>
      ) : !data ? (
        <Typography.Text type="secondary">{t(`${PS}.detailNotFound`)}</Typography.Text>
      ) : (
        <div ref={printRef}>
          <Typography.Title level={4} style={{ textAlign: 'center', display: 'none' }} className="print-only">
            {t(`${PS}.detail.printTitle`, { company: data.company_name || t(`${PS}.detail.ourCompany`) })}
          </Typography.Title>
          <Space style={{ marginBottom: 16 }} className="no-print">
            {statusMeta ? <Tag color={statusColorMap[data.status] || 'default'}>{statusMeta.text}</Tag> : null}
            {data.sent_channel ? (
              <Typography.Text type="secondary">
                {t(`${PS}.detail.sentAt`, {
                  channel: formatSentChannel(data.sent_channel, t),
                  time: data.sent_at ? ` - ${formatDateTime(data.sent_at, 'YYYY-MM-DD HH:mm')}` : '',
                })}
              </Typography.Text>
            ) : null}
          </Space>

          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t(`${PS}.col.code`)}>{data.statement_code}</Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.col.partner`)}>{data.partner_name}</Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.col.period`)}>
              {data.start_date} ~ {data.end_date}（{data.statement_period}）
            </Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.detail.partnerType`)}>
              {data.partner_type === 'Customer'
                ? t(`${PS}.partnerType.customer`)
                : t(`${PS}.partnerType.supplier`)}
            </Descriptions.Item>
            {(snap as any).finance_contact_name ? (
              <Descriptions.Item label={t(`${PS}.detail.financeContact`)} span={2}>
                {(snap as any).finance_contact_name} {(snap as any).finance_contact_phone || ''}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label={t(`${PS}.col.openingBalance`)}>{money(summary?.opening_balance)}</Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.col.closingBalance`)}>{money(summary?.closing_balance)}</Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.col.debitTotal`)}>{money(summary?.debit_total)}</Descriptions.Item>
            <Descriptions.Item label={t(`${PS}.col.creditTotal`)}>{money(summary?.credit_total)}</Descriptions.Item>
            {data.dispute_reason ? (
              <Descriptions.Item label={t(`${PS}.detail.disputeReason`)} span={2}>{data.dispute_reason}</Descriptions.Item>
            ) : null}
            {data.notes ? (
              <Descriptions.Item label={t('common.remark')} span={2}>{data.notes}</Descriptions.Item>
            ) : null}
          </Descriptions>

          <Alert type="info" showIcon message={t(`${PS}.dataSourceNote`)} style={{ marginBottom: 12 }} />
          {linesEditable && linesDirty ? (
            <Alert
              type="warning"
              showIcon
              message={t(`${PS}.detail.unsavedLinesHint`)}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          <Table
            size="small"
            rowKey={(r, i) => `${r.doc_type}-${r.doc_id}-${i}`}
            pagination={false}
            dataSource={lines}
            scroll={{ x: 1400 }}
            columns={lineColumns}
            expandable={partnerStatementExpandableProps(lineDetailCache, loadLineDetail)}
          />

          <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            {t(`${PS}.detail.footer`)}
          </Typography.Paragraph>
        </div>
      )}
    </div>
  );
};

export default PartnerStatementDetailPage;
