/**
 * 往来对账单详情页
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Descriptions, Input, Modal, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
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
  PARTNER_STATEMENT_STATUS_MAP,
  SENT_CHANNEL_OPTIONS,
  downloadBlob,
} from '../../../services/finance/partnerStatement';

const money = (v: number | string | undefined) =>
  `¥${Number(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PartnerStatementDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PartnerStatement | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await partnerStatementService.get(Number(id));
      setData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines: PartnerStatementLine[] =
    data?.transaction_details?.lines ||
    [];
  const summary = data?.transaction_details?.summary || {
    opening_balance: data?.opening_balance,
    debit_total: data?.debit_total,
    credit_total: data?.credit_total,
    closing_balance: data?.closing_balance,
  };
  const balanceLabel =
    data?.transaction_details?.balance_label ||
    (data?.partner_type === 'Customer' ? '应收余额' : '应付余额');
  const snap = data?.transaction_details?.partner_snapshot || {};

  const handleConfirm = () => {
    if (!data) return;
    Modal.confirm({
      title: '确认对账单',
      content: `确认对账单 ${data.statement_code} 数据无误？`,
      onOk: async () => {
        await partnerStatementService.confirm(data.id);
        message.success('已确认');
        load();
      },
    });
  };

  const handleMarkSent = () => {
    if (!data) return;
    let channel = 'wechat_manual';
    let notes = '';
    Modal.confirm({
      title: '标记已发送',
      width: 480,
      content: (
        <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }}>
          <Typography.Text type="secondary">
            请先将对账单导出或打印后，通过微信/邮件等方式发送给对方，再标记发送记录。
          </Typography.Text>
          <div>
            <Typography.Text>发送方式</Typography.Text>
            <select
              defaultValue={channel}
              style={{ width: '100%', marginTop: 4, padding: '4px 8px' }}
              onChange={(e) => { channel = e.target.value; }}
            >
              {SENT_CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Typography.Text>备注（可选）</Typography.Text>
            <Input.TextArea rows={2} style={{ marginTop: 4 }} onChange={(e) => { notes = e.target.value; }} />
          </div>
        </Space>
      ),
      onOk: async () => {
        await partnerStatementService.markSent(data.id, { channel, notes: notes.trim() || undefined });
        message.success('已标记发送');
        load();
      },
    });
  };

  const handleDispute = () => {
    if (!data) return;
    let reason = '';
    Modal.confirm({
      title: '记录异议',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请填写对方反馈的异议说明"
          onChange={(e) => { reason = e.target.value; }}
        />
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('请填写异议说明');
          return Promise.reject();
        }
        await partnerStatementService.dispute(data.id, reason.trim());
        message.success('已记录异议');
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
      downloadBlob(blob, `对账单-${data.statement_code}.${ext}`);
      message.success('导出成功');
    } catch (e: any) {
      message.error(e?.message || '导出失败');
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!id) return null;

  const statusMeta = data ? PARTNER_STATEMENT_STATUS_MAP[data.status] : null;

  const pageActions = data ? (
    <Space wrap size={8}>
      <Button onClick={() => navigate('/apps/kuaicaiwu/finance-management/partner-statements')}>返回</Button>
      {data.status === 'Draft' || data.status === 'Disputed' ? (
        <Button type="primary" onClick={handleConfirm}>内部确认</Button>
      ) : null}
      {data.status === 'Confirmed' ? (
        <Button type="primary" onClick={handleMarkSent}>标记已发送</Button>
      ) : null}
      <Button loading={exporting === 'xlsx'} onClick={() => void handleExport('xlsx')}>导出 Excel</Button>
      <Button loading={exporting === 'pdf'} onClick={() => void handleExport('pdf')}>导出 PDF</Button>
      <Button onClick={handlePrint}>打印</Button>
      {data.status === 'Sent' || data.status === 'Confirmed' ? (
        <Button danger onClick={handleDispute}>记录异议</Button>
      ) : null}
    </Space>
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
          往来对账单 {data?.statement_code || ''}
        </Typography.Title>
        {pageActions}
      </div>

      {loading && !data ? (
        <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>
      ) : !data ? (
        <Typography.Text type="secondary">未找到对账单</Typography.Text>
      ) : (
        <div ref={printRef}>
          <Typography.Title level={4} style={{ textAlign: 'center', display: 'none' }} className="print-only">
            {data.company_name || '本公司'} — 往来对账单
          </Typography.Title>
          <Space style={{ marginBottom: 16 }} className="no-print">
            {statusMeta ? <Tag color={statusMeta.color}>{statusMeta.text}</Tag> : null}
            {data.sent_channel ? (
              <Typography.Text type="secondary">
                发送方式：{SENT_CHANNEL_OPTIONS.find((o) => o.value === data.sent_channel)?.label || data.sent_channel}
                {data.sent_at ? ` · ${dayjs(data.sent_at).format('YYYY-MM-DD HH:mm')}` : ''}
              </Typography.Text>
            ) : null}
          </Space>

          <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="对账单号">{data.statement_code}</Descriptions.Item>
            <Descriptions.Item label="往来单位">{data.partner_name}</Descriptions.Item>
            <Descriptions.Item label="对账期间">
              {data.start_date} ~ {data.end_date}（{data.statement_period}）
            </Descriptions.Item>
            <Descriptions.Item label="单位类型">
              {data.partner_type === 'Customer' ? '客户' : '供应商'}
            </Descriptions.Item>
            {(snap as any).finance_contact_name ? (
              <Descriptions.Item label="财务联系人" span={2}>
                {(snap as any).finance_contact_name} {(snap as any).finance_contact_phone || ''}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="期初余额">{money(summary?.opening_balance)}</Descriptions.Item>
            <Descriptions.Item label="期末余额">{money(summary?.closing_balance)}</Descriptions.Item>
            <Descriptions.Item label="本期借方">{money(summary?.debit_total)}</Descriptions.Item>
            <Descriptions.Item label="本期贷方">{money(summary?.credit_total)}</Descriptions.Item>
            {data.dispute_reason ? (
              <Descriptions.Item label="异议说明" span={2}>{data.dispute_reason}</Descriptions.Item>
            ) : null}
            {data.notes ? (
              <Descriptions.Item label="备注" span={2}>{data.notes}</Descriptions.Item>
            ) : null}
          </Descriptions>

          <Table
            size="small"
            rowKey={(r, i) => `${r.doc_code}-${i}`}
            pagination={false}
            dataSource={lines}
            scroll={{ x: 900 }}
            columns={[
              { title: '日期', dataIndex: 'date', width: 110 },
              { title: '单据类型', dataIndex: 'doc_type', width: 90 },
              { title: '单号', dataIndex: 'doc_code', width: 150 },
              { title: '摘要', dataIndex: 'summary', ellipsis: true },
              {
                title: '借方',
                dataIndex: 'debit',
                width: 110,
                align: 'right',
                render: (v) => (v ? money(v) : '—'),
              },
              {
                title: '贷方',
                dataIndex: 'credit',
                width: 110,
                align: 'right',
                render: (v) => (v ? money(v) : '—'),
              },
              {
                title: balanceLabel,
                dataIndex: 'balance',
                width: 120,
                align: 'right',
                render: (v) => money(v),
              },
            ]}
          />

          <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            请于收到本对账单后 7 个工作日内核对并回复；如有异议请注明。
          </Typography.Paragraph>
        </div>
      )}
    </div>
  );
};

export default PartnerStatementDetailPage;
