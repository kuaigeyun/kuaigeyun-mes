import React, { useState } from 'react';
import { PageContainer, ProTable, ProCard } from '@ant-design/pro-components';
import { Button, Modal, message, Space, Tag, InputNumber, Divider } from 'antd';
import { AuditOutlined, SelectOutlined } from '@ant-design/icons';
import { settlementService } from '../../../services/finance/settlement';

const SettlementPage: React.FC = () => {
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleManualSettle = async () => {
    if (!selectedReceivable || !selectedReceipt || settleAmount <= 0) {
      message.error('请选择单据并输入正确的核销金额');
      return;
    }
    try {
      await settlementService.settleReceivable(selectedReceivable.id, selectedReceipt.id, settleAmount);
      message.success('核销成功');
      setIsModalOpen(false);
      // 刷新表格逻辑可集成在 ProTable 的 actionRef 中
    } catch (error: any) {
      message.error('核销失败: ' + error.message);
    }
  };

  return (
    <PageContainer title="往来核销中心" subTitle="管理资金收付与业务单据的匹配">
      <Row gutter={16}>
        <Col span={12}>
          <ProTable
            headerTitle="待核销应收单 (Receivables)"
            rowKey="id"
            search={{ labelWidth: 'auto' }}
            request={async (params) => {
               // 这里应根据实际 params 调用 service.listReceivables
               return { data: [], success: true }; 
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
            request={async () => {
               return { data: [], success: true };
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
          <Text>核销金额：</Text>
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
