/**
 * 应交增值税属期台账
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, Button, Descriptions, InputNumber, Modal, Space, Spin, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { useConfigStore } from '../../../../../stores';
import { taxService, type VatLedgerSummary } from '../../../services/tax';
import VatLedgerPrintTemplate from './VatLedgerPrintTemplate';
import { printVatLedgerNode } from './printVatLedger';

const NS = 'app.kuaicaiwu.tax.vatLedger';
const money = (v: number) => Number(v || 0).toFixed(2);

const VatLedgerPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi, modal } = App.useApp();
  const { canUpdate, canExport } = useResourcePermissions('kuaicaiwu:tax');
  const currentUser = useCurrentUser();
  const siteName = useConfigStore((s) => String(s.getConfig('site_name', '') || '').trim());
  const companyName = String(currentUser?.tenant_name || siteName || '').trim();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<VatLedgerSummary | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillKind, setDrillKind] = useState<'output' | 'input' | 'transfer_out'>('output');
  const [drillRows, setDrillRows] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taxService.getVatLedger(year, month);
      setSummary(res);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, messageApi, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDrill = async (kind: 'output' | 'input' | 'transfer_out') => {
    setDrillKind(kind);
    setDrillOpen(true);
    setDrillLoading(true);
    try {
      const res = await taxService.listVatLedgerInvoices({ year, month, kind, limit: 200 });
      setDrillRows(res.items ?? []);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
      setDrillRows([]);
    } finally {
      setDrillLoading(false);
    }
  };

  const confirmVoucher = (action: 'vat' | 'surcharge') => {
    modal.confirm({
      title:
        action === 'vat'
          ? t(`${NS}.confirmVatVoucher`, { defaultValue: '生成增值税结转凭证？' })
          : t(`${NS}.confirmSurchargeVoucher`, { defaultValue: '生成附加税计提凭证？' }),
      onOk: async () => {
        try {
          const res =
            action === 'vat'
              ? await taxService.createVatVoucher(year, month)
              : await taxService.createSurchargeVoucher(year, month);
          messageApi.success(
            t(`${NS}.voucherCreated`, {
              defaultValue: '凭证已生成 {{code}}',
              code: res.voucher_code,
            }),
          );
          await load();
        } catch (error) {
          messageApi.error(getApiErrorMessage(error, t(`${NS}.voucherFailed`, { defaultValue: '生成凭证失败' })));
        }
      },
    });
  };

  const drillColumns = [
    { title: t(`${NS}.col.code`, { defaultValue: '单号' }), dataIndex: 'invoice_code' },
    { title: t(`${NS}.col.number`, { defaultValue: '票号' }), dataIndex: 'invoice_number' },
    { title: t(`${NS}.col.partner`, { defaultValue: '往来单位' }), dataIndex: 'partner_name' },
    { title: t(`${NS}.col.date`, { defaultValue: '日期' }), dataIndex: 'invoice_date' },
    {
      title: t(`${NS}.col.tax`, { defaultValue: '税额' }),
      dataIndex: 'tax_amount',
      render: (v: number) => money(v),
    },
  ];

  return (
    <ListPageTemplate
      toolbarExtra={
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <InputNumber min={2000} max={2100} value={year} onChange={(v) => v && setYear(v)} addonBefore={t(`${NS}.year`, { defaultValue: '年' })} />
            <InputNumber min={1} max={12} value={month} onChange={(v) => v && setMonth(v)} addonBefore={t(`${NS}.month`, { defaultValue: '月' })} />
            <Button onClick={() => void load()}>{t('common.refresh', { defaultValue: '刷新' })}</Button>
            {canExport && (
              <Button onClick={() => setPrintOpen(true)}>
                {t(`${NS}.print`, { defaultValue: '打印预览' })}
              </Button>
            )}
            {canUpdate && !summary?.locked && (
              <>
                <Button type="primary" onClick={() => confirmVoucher('vat')} disabled={!!summary?.vat_transfer_voucher_id}>
                  {t(`${NS}.vatVoucher`, { defaultValue: '增值税结转' })}
                </Button>
                <Button onClick={() => confirmVoucher('surcharge')} disabled={!!summary?.surcharge_voucher_id}>
                  {t(`${NS}.surchargeVoucher`, { defaultValue: '附加税计提' })}
                </Button>
              </>
            )}
          </Space>
        </div>
      }
    >
      <Spin spinning={loading}>
        {summary ? (
          <Descriptions bordered column={2} size="small">
          <Descriptions.Item label={t(`${NS}.taxPeriod`, { defaultValue: '属期' })}>
            {summary.tax_period}
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.taxpayerType`, { defaultValue: '纳税人类型' })}>
            {summary.taxpayer_type === 'small_scale'
              ? t(`${NS}.smallScale`, { defaultValue: '小规模' })
              : t(`${NS}.general`, { defaultValue: '一般纳税人' })}
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.outputTax`, { defaultValue: '销项税额' })}>
            <Button type="link" onClick={() => void openDrill('output')}>
              {money(summary.output_tax)}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.inputTax`, { defaultValue: '进项税额' })}>
            <Button type="link" onClick={() => void openDrill('input')} disabled={summary.taxpayer_type === 'small_scale'}>
              {money(summary.input_tax)}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.transferOut`, { defaultValue: '进项转出' })}>
            <Button type="link" onClick={() => void openDrill('transfer_out')} disabled={summary.taxpayer_type === 'small_scale'}>
              {money(summary.transfer_out)}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.taxPayable`, { defaultValue: '应纳税额' })}>
            <Typography.Text strong>{money(summary.tax_payable)}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label={t(`${NS}.surcharge`, { defaultValue: '附加税合计' })} span={2}>
            {money(summary.surcharge_total)}（城建 {money(summary.surcharge_urban)} 教育 {money(summary.surcharge_education)} 地方教育 {money(summary.surcharge_local_education)}）
          </Descriptions.Item>
          {summary.locked && (
            <Descriptions.Item label={t(`${NS}.locked`, { defaultValue: '状态' })} span={2}>
              {t(`${NS}.periodLocked`, { defaultValue: '属期已锁定' })}
            </Descriptions.Item>
          )}
        </Descriptions>
        ) : null}
      </Spin>

      <Modal
        title={t(`${NS}.drillTitle.${drillKind}`, { defaultValue: '发票明细' })}
        open={drillOpen}
        onCancel={() => setDrillOpen(false)}
        footer={null}
        width={900}
        destroyOnHidden
      >
        <Table
          size="small"
          loading={drillLoading}
          rowKey="id"
          dataSource={drillRows}
          columns={[
            ...drillColumns,
            {
              title: t('common.actions', { defaultValue: '操作' }),
              render: (_: unknown, row: Record<string, unknown>) => (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    if (row.source === 'sales') {
                      navigate(`/apps/kuaicaiwu/finance-management/sales-invoices/${row.id}`);
                    } else {
                      navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${row.id}`);
                    }
                  }}
                >
                  {t(`${NS}.viewInvoice`, { defaultValue: '查看发票' })}
                </Button>
              ),
            },
          ]}
          pagination={{ pageSize: 20 }}
        />
      </Modal>

      <Modal
        title={t(`${NS}.print`, { defaultValue: '打印预览' })}
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        width={860}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setPrintOpen(false)}>{t('common.close', { defaultValue: '关闭' })}</Button>
            <Button type="primary" onClick={() => printRef.current && printVatLedgerNode(printRef.current)}>
              {t(`${NS}.printConfirm`, { defaultValue: '打印' })}
            </Button>
          </Space>
        }
      >
        {summary && (
          <VatLedgerPrintTemplate ref={printRef} summary={summary} companyName={companyName} />
        )}
      </Modal>
    </ListPageTemplate>
  );
};

export default VatLedgerPage;
