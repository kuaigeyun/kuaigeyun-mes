import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import type { ActionType } from '@ant-design/pro-components';
import { ProColumns } from '@ant-design/pro-components';
import { Modal, message, Space, InputNumber, Divider, Typography, Row, Col, Alert, Button, Spin, Table, Empty } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { MultiTabListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { settlementService, type SettlementPreview } from '../../../services/finance/settlement';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';
import { payableService } from '../../../services/finance/payable';
import { paymentService } from '../../../services/finance/payment';
import { settlementCapabilityReasonMessage } from '../../../utils/settlementCapabilityMessages';

const P = 'app.kuaicaiwu.settlement';
const C = 'app.kuaicaiwu.common';

const formatSettleMoney = (value: number) =>
  `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SettlementPage: React.FC = () => {
  const { t } = useTranslation();
  const receivableActionRef = useRef<ActionType>();
  const receiptActionRef = useRef<ActionType>();
  const payableActionRef = useRef<ActionType>();
  const paymentActionRef = useRef<ActionType>();
  const [activeTab, setActiveTab] = useState('receivable');
  const [selectedReceivable, setSelectedReceivable] = useState<Record<string, unknown> | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Record<string, unknown> | null>(null);
  const [selectedPayable, setSelectedPayable] = useState<Record<string, unknown> | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Record<string, unknown> | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [arPreviewLoading, setArPreviewLoading] = useState(false);
  const [arPreviewData, setArPreviewData] = useState<SettlementPreview | null>(null);
  const [apPreviewLoading, setApPreviewLoading] = useState(false);
  const [apPreviewData, setApPreviewData] = useState<SettlementPreview | null>(null);
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const tableOnlyViewTypes = ['table'] as const;

  const arPreviewOpen = !!(selectedReceivable && selectedReceipt);
  const apPreviewOpen = !!(selectedPayable && selectedPayment);
  const arMaxSettle = Number(arPreviewData?.max_settle_quantity ?? 0);
  const apMaxSettle = Number(apPreviewData?.max_settle_quantity ?? 0);

  const resetArSelection = useCallback(() => {
    setSelectedReceivable(null);
    setSelectedReceipt(null);
    setArPreviewData(null);
    setSettleAmount(0);
  }, []);

  const resetApSelection = useCallback(() => {
    setSelectedPayable(null);
    setSelectedPayment(null);
    setApPreviewData(null);
    setSettleAmount(0);
  }, []);

  useEffect(() => {
    if (!selectedReceivable?.id || !selectedReceipt?.id) {
      setArPreviewData(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setArPreviewLoading(true);
      setArPreviewData(null);
      try {
        const data = await settlementService.previewReceivableSettle(
          Number(selectedReceivable.id),
          Number(selectedReceipt.id),
        );
        if (cancelled) return;
        setArPreviewData(data);
        const maxPush = Number(data.max_settle_quantity ?? 0);
        setSettleAmount(maxPush > 0 ? maxPush : 0);
      } catch (error: any) {
        if (!cancelled) {
          message.error(
            error?.response?.data?.detail?.message || error?.message || t(`${P}.previewFailed`),
          );
          resetArSelection();
        }
      } finally {
        if (!cancelled) setArPreviewLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedReceivable?.id, selectedReceipt?.id, resetArSelection, t]);

  useEffect(() => {
    if (!selectedPayable?.id || !selectedPayment?.id) {
      setApPreviewData(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setApPreviewLoading(true);
      setApPreviewData(null);
      try {
        const data = await settlementService.previewPayableSettle(
          Number(selectedPayable.id),
          Number(selectedPayment.id),
        );
        if (cancelled) return;
        setApPreviewData(data);
        const maxPush = Number(data.max_settle_quantity ?? 0);
        setSettleAmount(maxPush > 0 ? maxPush : 0);
      } catch (error: any) {
        if (!cancelled) {
          message.error(
            error?.response?.data?.detail?.message || error?.message || t(`${P}.previewFailed`),
          );
          resetApSelection();
        }
      } finally {
        if (!cancelled) setApPreviewLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedPayable?.id, selectedPayment?.id, resetApSelection, t]);

  const handleManualSettleReceivable = async () => {
    if (!selectedReceivable || !selectedReceipt || !arPreviewData || arPreviewData.has_blocking_issues) {
      message.error(t(`${P}.invalidAmount`));
      return;
    }
    if (settleAmount <= 0 || settleAmount > arMaxSettle) {
      message.error(t(`${P}.pullExceedMax`, { max: arMaxSettle.toFixed(2) }));
      return;
    }
    setSettleSubmitting(true);
    try {
      await settlementService.settleReceivable(
        selectedReceivable.id as number,
        selectedReceipt.id as number,
        settleAmount,
      );
      message.success(t(`${P}.settleSuccess`));
      resetArSelection();
      receivableActionRef.current?.reload();
      receiptActionRef.current?.reload();
    } catch (error: any) {
      message.error(
        error?.response?.data?.detail?.message || error?.message || t(`${P}.settleFailed`, { message: '' }),
      );
    } finally {
      setSettleSubmitting(false);
    }
  };

  const handleManualSettlePayable = async () => {
    if (!selectedPayable || !selectedPayment || !apPreviewData || apPreviewData.has_blocking_issues) {
      message.error(t(`${P}.invalidAmount`));
      return;
    }
    if (settleAmount <= 0 || settleAmount > apMaxSettle) {
      message.error(t(`${P}.pullExceedMax`, { max: apMaxSettle.toFixed(2) }));
      return;
    }
    setSettleSubmitting(true);
    try {
      await settlementService.settlePayable(
        selectedPayable.id as number,
        selectedPayment.id as number,
        settleAmount,
      );
      message.success(t(`${P}.settleSuccess`));
      resetApSelection();
      payableActionRef.current?.reload();
      paymentActionRef.current?.reload();
    } catch (error: any) {
      message.error(
        error?.response?.data?.detail?.message || error?.message || t(`${P}.settleFailed`, { message: '' }),
      );
    } finally {
      setSettleSubmitting(false);
    }
  };

  const renderPreviewBody = (preview: SettlementPreview | null, loading: boolean, partnerLabel: string) => {
    if (loading) {
      return (
        <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Spin />
          <div style={{ color: 'var(--ant-color-primary)' }}>{t(`${P}.loadingPreview`)}</div>
        </div>
      );
    }
    if (!preview) return null;
    return (
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Typography.Paragraph style={{ marginBottom: 0, fontWeight: 500 }}>{preview.summary}</Typography.Paragraph>
        {preview.has_blocking_issues && preview.blocking_reason ? (
          <Alert
            type="warning"
            showIcon
            message={settlementCapabilityReasonMessage(preview.blocking_reason, t)}
          />
        ) : null}
        {preview.items?.length ? (
          <Table
            size="small"
            dataSource={preview.items}
            rowKey={(row) => `${row.doc_type}-${row.item_id}`}
            pagination={false}
            scroll={{ x: 800 }}
            columns={[
              {
                title: t(`${P}.preview.col.docType`),
                dataIndex: 'doc_type',
                width: 100,
                render: (v: string) => t(`${P}.preview.docType.${v}`, { defaultValue: v }),
              },
              { title: t(`${C}.code`), dataIndex: 'source_code', width: 140, ellipsis: true },
              { title: partnerLabel, dataIndex: 'partner_name', width: 160, ellipsis: true },
              {
                title: t(`${P}.preview.col.docAmount`),
                dataIndex: 'quantity',
                width: 120,
                align: 'right',
                render: (v: number) => formatSettleMoney(v),
              },
              {
                title: t(`${P}.preview.col.settledAmount`),
                dataIndex: 'pushed_quantity',
                width: 120,
                align: 'right',
                render: (v: number) => formatSettleMoney(v),
              },
              {
                title: t(`${P}.preview.col.settleableAmount`),
                dataIndex: 'max_push_quantity',
                width: 120,
                align: 'right',
                render: (v: number) => formatSettleMoney(v),
              },
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.previewNoLines`)} />
        )}
        {preview.tip ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {preview.tip}
          </Typography.Paragraph>
        ) : null}
        {!preview.has_blocking_issues && Number(preview.max_settle_quantity) > 0 ? (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Typography.Text>{t(`${P}.settleAmount`)}</Typography.Text>
            <InputNumber
              style={{ width: '100%' }}
              value={settleAmount}
              min={0.01}
              max={Number(preview.max_settle_quantity)}
              precision={2}
              onChange={(val) => setSettleAmount(val || 0)}
            />
          </>
        ) : null}
      </Space>
    );
  };

  const receivableColumns: ProColumns<Record<string, unknown>>[] = useMemo(
    () => [
      {
        title: t(`${C}.code`),
        dataIndex: 'receivable_code',
        width: 160,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.receivable_code ?? '') }} ellipsis>
            {String(r.receivable_code ?? '-')}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name', ellipsis: true },
      { title: t(`${P}.col.pendingReceive`), dataIndex: 'remaining_amount', valueType: 'money', align: 'right' },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 80,
        render: (_, record) => [
          <a
            key="sel"
            onClick={() => {
              setSelectedReceivable(record);
              setSelectedReceipt(null);
              setArPreviewData(null);
              setSettleAmount(0);
            }}
          >
            {t(`${P}.select`)}
          </a>,
        ],
      },
    ],
    [t],
  );

  const receiptColumns: ProColumns<Record<string, unknown>>[] = useMemo(
    () => [
      {
        title: t(`${C}.code`),
        dataIndex: 'receipt_code',
        width: 160,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.receipt_code ?? '') }} ellipsis>
            {String(r.receipt_code ?? '-')}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.col.balance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 80,
        render: (_, record) => [
          <a
            key="m"
            onClick={() => {
              if (!selectedReceivable) {
                message.warning(t(`${P}.selectReceivableFirst`));
                return;
              }
              setSelectedReceipt(record);
            }}
          >
            {t(`${P}.match`)}
          </a>,
        ],
      },
    ],
    [t, selectedReceivable],
  );

  const payableColumns: ProColumns<Record<string, unknown>>[] = useMemo(
    () => [
      {
        title: t(`${C}.code`),
        dataIndex: 'payable_code',
        width: 160,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.payable_code ?? '') }} ellipsis>
            {String(r.payable_code ?? '-')}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name', ellipsis: true },
      { title: t(`${P}.col.pendingPay`), dataIndex: 'remaining_amount', valueType: 'money', align: 'right' },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 80,
        render: (_, record) => [
          <a
            key="sel"
            onClick={() => {
              setSelectedPayable(record);
              setSelectedPayment(null);
              setApPreviewData(null);
              setSettleAmount(0);
            }}
          >
            {t(`${P}.select`)}
          </a>,
        ],
      },
    ],
    [t],
  );

  const paymentColumns: ProColumns<Record<string, unknown>>[] = useMemo(
    () => [
      {
        title: t(`${C}.code`),
        dataIndex: 'payment_code',
        width: 160,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.payment_code ?? '') }} ellipsis>
            {String(r.payment_code ?? '-')}
          </Typography.Text>
        ),
      },
      { title: t(`${P}.col.balance`), dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 80,
        render: (_, record) => [
          <a
            key="m"
            onClick={() => {
              if (!selectedPayable) {
                message.warning(t(`${P}.selectPayableFirst`));
                return;
              }
              setSelectedPayment(record);
            }}
          >
            {t(`${P}.match`)}
          </a>,
        ],
      },
    ],
    [t, selectedPayable],
  );

  const receivableSettlement = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t(`${P}.arAlertExtended`)} />
      {selectedReceivable ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title={t(`${P}.selectedReceivable`, { code: String(selectedReceivable.receivable_code ?? '') })}
        />
      ) : null}
      <Row gutter={16}>
        <Col span={12}>
          <UniTable
            headerTitle={t(`${P}.pendingReceivables`)}
            actionRef={receivableActionRef}
            enableRowSelection
            rowKey="id"
            viewTypes={[...tableOnlyViewTypes]}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement"
            search={{ labelWidth: 'auto' }}
            showAdvancedSearch
            scroll={{ x: 720 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receivableService.listReceivables({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                pending_settlement: true,
                ...rest,
              });
              return {
                data: (res?.items || []) as any[],
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={receivableColumns}
          />
        </Col>
        <Col span={12}>
          <UniTable
            headerTitle={t(`${P}.availableReceipts`)}
            actionRef={receiptActionRef}
            enableRowSelection
            rowKey="id"
            viewTypes={[...tableOnlyViewTypes]}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement:2"
            search={false}
            scroll={{ x: 560 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receiptService.listReceipts({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                unsettled_only: true,
                ...rest,
              });
              return {
                data: (res?.items || []) as any[],
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={receiptColumns}
          />
        </Col>
      </Row>

      <Modal
        title={t(`${P}.confirmArTitle`)}
        open={arPreviewOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onOk={handleManualSettleReceivable}
        onCancel={resetArSelection}
        confirmLoading={settleSubmitting}
        okText={t(`${P}.confirmSettle`)}
        okButtonProps={{
          disabled:
            arPreviewLoading ||
            !arPreviewData ||
            !!arPreviewData?.has_blocking_issues ||
            arMaxSettle <= 0 ||
            settleAmount <= 0,
        }}
      >
        {renderPreviewBody(arPreviewData, arPreviewLoading, t('app.kuaicaiwu.common.customer'))}
      </Modal>
    </>
  );

  const payableSettlement = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t(`${P}.apAlertExtended`)} />
      {selectedPayable ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title={t(`${P}.selectedPayable`, { code: String(selectedPayable.payable_code ?? '') })}
        />
      ) : null}
      <Row gutter={16}>
        <Col span={12}>
          <UniTable
            headerTitle={t(`${P}.pendingPayables`)}
            actionRef={payableActionRef}
            enableRowSelection
            rowKey="id"
            viewTypes={[...tableOnlyViewTypes]}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement:payable"
            search={{ labelWidth: 'auto' }}
            showAdvancedSearch
            scroll={{ x: 720 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await payableService.listPayables({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                pending_settlement: true,
                ...rest,
              });
              return {
                data: (res?.items || []) as any[],
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={payableColumns}
          />
        </Col>
        <Col span={12}>
          <UniTable
            headerTitle={t(`${P}.availablePayments`)}
            actionRef={paymentActionRef}
            enableRowSelection
            rowKey="id"
            viewTypes={[...tableOnlyViewTypes]}
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement:payment"
            search={false}
            scroll={{ x: 560 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await paymentService.listPayments({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                unsettled_only: true,
                ...rest,
              });
              return {
                data: (res?.items || []) as any[],
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={paymentColumns}
          />
        </Col>
      </Row>

      <Modal
        title={t(`${P}.confirmApTitle`)}
        open={apPreviewOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onOk={handleManualSettlePayable}
        onCancel={resetApSelection}
        confirmLoading={settleSubmitting}
        okText={t(`${P}.confirmSettle`)}
        okButtonProps={{
          disabled:
            apPreviewLoading ||
            !apPreviewData ||
            !!apPreviewData?.has_blocking_issues ||
            apMaxSettle <= 0 ||
            settleAmount <= 0,
        }}
      >
        {renderPreviewBody(apPreviewData, apPreviewLoading, t('app.kuaicaiwu.common.supplier'))}
      </Modal>
    </>
  );

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    resetArSelection();
    resetApSelection();
  };

  const tabBarExtraContent = useMemo(
    () => (
      <Button type="default" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
        {t(`${P}.help`)}
      </Button>
    ),
    [t],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTab}
        onTabChange={handleTabChange}
        preserveMounted
        tabBarExtraContent={tabBarExtraContent}
        tabs={[
          { key: 'receivable', label: t(`${P}.tabReceivable`), children: receivableSettlement },
          { key: 'payable', label: t(`${P}.tabPayable`), children: payableSettlement },
        ]}
      />

      <Modal
        title={t(`${P}.helpTitle`)}
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={[
          <Button {...rowActionKind('close')} key="close" type="primary" onClick={() => setHelpOpen(false)}>
            {t(`${P}.helpGotIt`)}
          </Button>,
        ]}
        width={560}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>{t(`${P}.helpArTitle`)}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              {t(`${P}.helpArDesc`)}
            </Typography.Paragraph>
          </div>
          <Divider style={{ margin: 0 }} />
          <div>
            <Typography.Text strong>{t(`${P}.helpApTitle`)}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              {t(`${P}.helpApDesc`)}
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default SettlementPage;
