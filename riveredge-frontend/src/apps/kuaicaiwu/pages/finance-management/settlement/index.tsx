import React, { useState, useRef, useMemo } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import type { ActionType } from '@ant-design/pro-components';
import { ProColumns } from '@ant-design/pro-components';
import { Modal, message, Space, InputNumber, Divider, Typography, Row, Col, Alert, Button } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { settlementService } from '../../../services/finance/settlement';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';
import { payableService } from '../../../services/finance/payable';
import { paymentService } from '../../../services/finance/payment';

const SettlementPage: React.FC = () => {
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

  /** 双栏列表仅表格视图，不展示 UniView 切换 */
  const tableOnlyViewTypes = ['table'] as const;

  const handleManualSettleReceivable = async () => {
    if (!selectedReceivable || !selectedReceipt || settleAmount <= 0) {
      message.error('请选择单据并输入正确的核销金额');
      return;
    }
    try {
      await settlementService.settleReceivable(
        selectedReceivable.id as number,
        selectedReceipt.id as number,
        settleAmount,
      );
      message.success('核销成功');
      setSelectedReceivable(null);
      setSelectedReceipt(null);
      receivableActionRef.current?.reload();
      receiptActionRef.current?.reload();
    } catch (error: any) {
      message.error(`核销失败: ${error.message}`);
    }
  };

  const handleManualSettlePayable = async () => {
    if (!selectedPayable || !selectedPayment || settleAmount <= 0) {
      message.error('请选择单据并输入正确的核销金额');
      return;
    }
    try {
      await settlementService.settlePayable(
        selectedPayable.id as number,
        selectedPayment.id as number,
        settleAmount,
      );
      message.success('核销成功');
      setSelectedPayable(null);
      setSelectedPayment(null);
      payableActionRef.current?.reload();
      paymentActionRef.current?.reload();
    } catch (error: any) {
      message.error(`核销失败: ${error.message}`);
    }
  };

  const receivableColumns: ProColumns<Record<string, unknown>>[] = [
    {
      title: '编号',
      dataIndex: 'receivable_code',
      width: 160,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.receivable_code ?? '') }} ellipsis>
          {String(r.receivable_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: '客户', dataIndex: 'customer_name', ellipsis: true },
    { title: '待收金额', dataIndex: 'remaining_amount', valueType: 'money', align: 'right' },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, record) => [
        <a key="sel" onClick={() => {
          setSelectedReceivable(record);
          setSettleAmount(Number(record.remaining_amount) || 0);
        }}
        >
          选择
        </a>,
      ],
    },
  ];

  const receiptColumns: ProColumns<Record<string, unknown>>[] = [
    {
      title: '编号',
      dataIndex: 'receipt_code',
      width: 160,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.receipt_code ?? '') }} ellipsis>
          {String(r.receipt_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: '余额', dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, record) => [<a key="m" onClick={() => setSelectedReceipt(record)}>匹配</a>],
    },
  ];

  const payableColumns: ProColumns<Record<string, unknown>>[] = [
    {
      title: '编号',
      dataIndex: 'payable_code',
      width: 160,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.payable_code ?? '') }} ellipsis>
          {String(r.payable_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
    { title: '待付金额', dataIndex: 'remaining_amount', valueType: 'money', align: 'right' },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, record) => [
        <a key="sel" onClick={() => {
          setSelectedPayable(record);
          setSettleAmount(Number(record.remaining_amount) || 0);
        }}
        >
          选择
        </a>,
      ],
    },
  ];

  const paymentColumns: ProColumns<Record<string, unknown>>[] = [
    {
      title: '编号',
      dataIndex: 'payment_code',
      width: 160,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.payment_code ?? '') }} ellipsis>
          {String(r.payment_code ?? '-')}
        </Typography.Text>
      ),
    },
    { title: '余额', dataIndex: 'unsettled_amount', valueType: 'money', align: 'right' },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      render: (_, record) => [<a key="m" onClick={() => setSelectedPayment(record)}>匹配</a>],
    },
  ];

  const receivableSettlement = (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="将「有余额的收款单」手动匹配到「有待收金额的应收单」。若已在应收详情登记收款并自动核销，或单据已全部结清，则此处不会显示数据。"
      />
      <Row gutter={16}>
        <Col span={12}>
          <UniTable
            headerTitle="待核销应收单"
            actionRef={receivableActionRef}
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
            headerTitle="可用收款单"
            actionRef={receiptActionRef}
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
        title="确认手动核销（应收）"
        open={!!(selectedReceivable && selectedReceipt)}
        onOk={handleManualSettleReceivable}
        onCancel={() => {
          setSelectedReceivable(null);
          setSelectedReceipt(null);
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>
            将收款单 <b>{String(selectedReceipt?.receipt_code ?? '')}</b> 的金额核销至应收单{' '}
            <b>{String(selectedReceivable?.receivable_code ?? '')}</b>
          </p>
          <Divider />
          <Typography.Text>核销金额：</Typography.Text>
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
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="将「有余额的付款单」手动匹配到「有待付金额的应付单」。若已在应付详情登记付款并自动核销，或单据已全部结清，则此处不会显示数据。"
      />
      <Row gutter={16}>
        <Col span={12}>
          <UniTable
            headerTitle="待核销应付单"
            actionRef={payableActionRef}
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
            headerTitle="可用付款单"
            actionRef={paymentActionRef}
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
        title="确认手动核销（应付）"
        open={!!(selectedPayable && selectedPayment)}
        onOk={handleManualSettlePayable}
        onCancel={() => {
          setSelectedPayable(null);
          setSelectedPayment(null);
        }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <p>
            将付款单 <b>{String(selectedPayment?.payment_code ?? '')}</b> 的金额核销至应付单{' '}
            <b>{String(selectedPayable?.payable_code ?? '')}</b>
          </p>
          <Divider />
          <Typography.Text>核销金额：</Typography.Text>
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
        帮助
      </Button>
    ),
    [],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTab}
        onTabChange={handleTabChange}
        preserveMounted
        tabBarExtraContent={tabBarExtraContent}
        tabs={[
          { key: 'receivable', label: '应收核销', children: receivableSettlement },
          { key: 'payable', label: '应付核销', children: payableSettlement },
        ]}
      />

      <Modal
        title="往来核销帮助"
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={[
          <Button {...rowActionKind('close')} key="close" type="primary" onClick={() => setHelpOpen(false)}>
            知道了
          </Button>,
        ]}
        width={560}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>应收核销</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              将「有余额的收款单」手动匹配到「有待收金额的应收单」。左侧选择应收单，右侧匹配收款单，确认核销金额即可。
              若已在应收详情登记收款并自动核销，或单据已全部结清，则列表不会显示数据。
            </Typography.Paragraph>
          </div>
          <Divider style={{ margin: 0 }} />
          <div>
            <Typography.Text strong>应付核销</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              将「有余额的付款单」手动匹配到「有待付金额的应付单」。操作方式与应收核销相同。
              若已在应付详情登记付款并自动核销，或单据已全部结清，则列表不会显示数据。
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>
    </>
  );
};

export default SettlementPage;
