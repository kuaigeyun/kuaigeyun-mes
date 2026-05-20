import React, { useState, useRef } from 'react';
import type { ActionType } from '@ant-design/pro-components';
import { ProColumns } from '@ant-design/pro-components';
import { Modal, message, Space, InputNumber, Divider, Typography, Row, Col } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { settlementService } from '../../../services/finance/settlement';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';

const SettlementPage: React.FC = () => {
  const receivableActionRef = useRef<ActionType>();
  const receiptActionRef = useRef<ActionType>();
  const [selectedReceivable, setSelectedReceivable] = useState<Record<string, unknown> | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Record<string, unknown> | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);

  const handleManualSettle = async () => {
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

  return (
    <ListPageTemplate>
      <Row gutter={16}>
        <Col span={12}>
          <UniTable
            headerTitle="待核销应收单"
            actionRef={receivableActionRef}
            rowKey="id"
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement"
            search={{ labelWidth: 'auto' }}
            showAdvancedSearch
            scroll={{ x: 720 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receivableService.listReceivables({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                status: '未收款',
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
            columnPersistenceId="apps.kuaicaiwu.pages.finance-management.settlement:2"
            search={false}
            scroll={{ x: 560 }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receiptService.listReceipts({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                status: 'Confirmed',
                ...rest,
              });
              const items = (res?.items || []).filter((i: { unsettled_amount?: number }) => (i.unsettled_amount ?? 0) > 0);
              return {
                data: items as any[],
                total: (res?.total ?? items.length) as any,
                success: true,
              };
            }}
            columns={receiptColumns}
          />
        </Col>
      </Row>

      <Modal
        title="确认手动核销"
        open={!!(selectedReceivable && selectedReceipt)}
        onOk={handleManualSettle}
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
    </ListPageTemplate>
  );
};

export default SettlementPage;
