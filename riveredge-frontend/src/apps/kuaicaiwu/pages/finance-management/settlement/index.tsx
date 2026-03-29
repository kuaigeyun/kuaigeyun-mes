import React, { useState } from 'react';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Modal, message, Space, InputNumber, Divider, Row, Col, Typography } from 'antd';
import { settlementService } from '../../../services/finance/settlement';
import { receivableService } from '../../../services/finance/receivable';
import { receiptService } from '../../../services/finance/receipt';

const SettlementPage: React.FC = () => {
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);

  const handleManualSettle = async () => {
    if (!selectedReceivable || !selectedReceipt || settleAmount <= 0) {
      message.error('请选择单据并输入正确的核销金额');
      return;
    }
    try {
      await settlementService.settleReceivable(selectedReceivable.id, selectedReceipt.id, settleAmount);
      message.success('核销成功');
      setSelectedReceivable(null);
      setSelectedReceipt(null);
      // 刷新表格逻辑可集成在 ProTable 的 actionRef 中
    } catch (error: any) {
      message.error('核销失败: ' + error.message);
    }
  };

  return (
    <PageContainer 
      header={undefined}
      pageHeaderRender={false}
      childrenContentStyle={{ padding: 0 }}
      style={{ padding: 0 }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <ProTable
            headerTitle="待核销应收单 (Receivables)"
            rowKey="id"
            search={{ labelWidth: 'auto' }}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receivableService.listReceivables({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                // 只看未结清的
                status: '未收款', 
                ...rest,
              });
              return {
                data: res?.items || [],
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={[
              { title: '编号', dataIndex: 'receivable_code' },
              { title: '客户', dataIndex: 'customer_name' },
              { title: '待收金额', dataIndex: 'remaining_amount', valueType: 'money' },
              {
                title: '操作',
                valueType: 'option',
                render: (_, record) => [
                  <a key="select" onClick={() => {
                    setSelectedReceivable(record);
                    setSettleAmount(record.remaining_amount);
                  }}>选择</a>,
                ],
              },
            ]}
          />
        </Col>
        <Col span={12}>
          <ProTable
            headerTitle="可用收款单 (Receipts)"
            rowKey="id"
            search={false}
            request={async (params) => {
              const { current, pageSize, ...rest } = params;
              const res = await receiptService.listReceipts({
                skip: ((current || 1) - 1) * (pageSize || 20),
                limit: pageSize || 20,
                status: 'Confirmed',
                ...rest,
              });
              // 过滤掉已核销完的
              const items = (res?.items || []).filter(i => i.unsettled_amount > 0);
              return {
                data: items,
                total: res?.total || 0,
                success: true,
              };
            }}
            columns={[
              { title: '编号', dataIndex: 'receipt_code' },
              { title: '余额', dataIndex: 'unsettled_amount', valueType: 'money' },
              {
                title: '操作',
                valueType: 'option',
                render: (_, record) => [
                  <a key="select" onClick={() => setSelectedReceipt(record)}>匹配</a>,
                ],
              },
            ]}
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
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>将收款单 <b>{selectedReceipt?.receipt_code}</b> 的金额核销至应收单 <b>{selectedReceivable?.receivable_code}</b></p>
          <Divider />
          <Typography.Text>核销金额：</Typography.Text>
          <InputNumber 
            style={{ width: '100%' }} 
            value={settleAmount} 
            onChange={(val) => setSettleAmount(val || 0)} 
            max={Math.min(selectedReceivable?.remaining_amount || 0, selectedReceipt?.unsettled_amount || 0)}
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default SettlementPage;
