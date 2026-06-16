import React, { useState, useRef, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import type { ActionType } from '@ant-design/pro-components';
import { ProColumns } from '@ant-design/pro-components';
import { Modal, message, Space, InputNumber, Divider, Typography, Row, Col, Alert, Button } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { settlementService } from '../../../services/finance/settlement';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';
import { payableService } from '../../../services/finance/payable';
import { paymentService } from '../../../services/finance/payment';

const P = 'app.kuaicaiwu.settlement';
const C = 'app.kuaicaiwu.common';

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
  const [helpOpen, setHelpOpen] = useState(false);

  const tableOnlyViewTypes = ['table'] as const;

  const handleManualSettleReceivable = async () => {
    if (!selectedReceivable || !selectedReceipt || settleAmount <= 0) {
      message.error(t(`${P}.invalidAmount`));
      return;
    }
    try {
      await settlementService.settleReceivable(
        selectedReceivable.id as number,
        selectedReceipt.id as number,
        settleAmount,
      );
      message.success(t(`${P}.settleSuccess`));
      setSelectedReceivable(null);
      setSelectedReceipt(null);
      receivableActionRef.current?.reload();
      receiptActionRef.current?.reload();
    } catch (error: any) {
      message.error(t(`${P}.settleFailed`, { message: error.message }));
    }
  };

  const handleManualSettlePayable = async () => {
    if (!selectedPayable || !selectedPayment || settleAmount <= 0) {
      message.error(t(`${P}.invalidAmount`));
      return;
    }
    try {
      await settlementService.settlePayable(
        selectedPayable.id as number,
        selectedPayment.id as number,
        settleAmount,
      );
      message.success(t(`${P}.settleSuccess`));
      setSelectedPayable(null);
      setSelectedPayment(null);
      payableActionRef.current?.reload();
      paymentActionRef.current?.reload();
    } catch (error: any) {
      message.error(t(`${P}.settleFailed`, { message: error.message }));
    }
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
              setSettleAmount(Number(record.remaining_amount) || 0);
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
        render: (_, record) => [<a key="m" onClick={() => setSelectedReceipt(record)}>{t(`${P}.match`)}</a>],
      },
    ],
    [t],
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
              setSettleAmount(Number(record.remaining_amount) || 0);
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
        render: (_, record) => [<a key="m" onClick={() => setSelectedPayment(record)}>{t(`${P}.match`)}</a>],
      },
    ],
    [t],
  );

  const receivableSettlement = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t(`${P}.arAlertExtended`)} />
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
        open={!!(selectedReceivable && selectedReceipt)}
        onOk={handleManualSettleReceivable}
        onCancel={() => {
          setSelectedReceivable(null);
          setSelectedReceipt(null);
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>
            {t(`${P}.confirmArContent`, {
              receiptCode: String(selectedReceipt?.receipt_code ?? ''),
              receivableCode: String(selectedReceivable?.receivable_code ?? ''),
            })}
          </p>
          <Divider />
          <Typography.Text>{t(`${P}.settleAmount`)}：</Typography.Text>
          <InputNumber
            style={{ width: '100%' }}
            value={settleAmount}
            onChange={(val) => setSettleAmount(val || 0)}
            max={Math.min(
              Number(selectedReceivable?.remaining_amount) || 0,
              Number(selectedReceipt?.unsettled_amount) || 0,
            )}
          />
        </Space>
      </Modal>
    </>
  );

  const payableSettlement = (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title={t(`${P}.apAlertExtended`)} />
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
        open={!!(selectedPayable && selectedPayment)}
        onOk={handleManualSettlePayable}
        onCancel={() => {
          setSelectedPayable(null);
          setSelectedPayment(null);
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>
            {t(`${P}.confirmApContent`, {
              paymentCode: String(selectedPayment?.payment_code ?? ''),
              payableCode: String(selectedPayable?.payable_code ?? ''),
            })}
          </p>
          <Divider />
          <Typography.Text>{t(`${P}.settleAmount`)}：</Typography.Text>
          <InputNumber
            style={{ width: '100%' }}
            value={settleAmount}
            onChange={(val) => setSettleAmount(val || 0)}
            max={Math.min(
              Number(selectedPayable?.remaining_amount) || 0,
              Number(selectedPayment?.unsettled_amount) || 0,
            )}
          />
        </Space>
      </Modal>
    </>
  );

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSelectedReceivable(null);
    setSelectedReceipt(null);
    setSelectedPayable(null);
    setSelectedPayment(null);
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
