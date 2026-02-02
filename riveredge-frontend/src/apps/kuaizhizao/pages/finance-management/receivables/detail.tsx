import React, { useEffect, useState } from 'react';
import { PageContainer, ProDescriptions, ProCard } from '@ant-design/pro-components';
import { Button, Modal, message, Space, Statistic, Row, Col, Divider, Timeline } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable } from '../../../types/finance/receivable';
import { ModalForm, ProFormMoney, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';

const ReceivableDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<Receivable>();
    const [loading, setLoading] = useState(false);
    const [receiptModalVisible, setReceiptModalVisible] = useState(false);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await receivableService.getReceivable(Number(id));
            setData(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleReceipt = async (values: any) => {
        if (!id) return;
        try {
            await receivableService.recordReceipt(Number(id), {
                receipt_amount: values.receipt_amount,
                receipt_date: values.receipt_date,
                notes: values.notes,
            });
            message.success('收款记录已添加');
            setReceiptModalVisible(false);
            loadData();
        } catch (error) {
            // Error handled by interceptor
        }
    };

    if (!data) return null;

    return (
        <PageContainer
            title={`应收单详情: ${data.receivable_code}`}
            extra={[
                <Button key="back" onClick={() => navigate(-1)}>返回</Button>,
                data.status !== '已结清' && (
                    <Button key="receipt" type="primary" onClick={() => setReceiptModalVisible(true)}>
                        登记收款
                    </Button>
                ),
            ]}
        >
            <Row gutter={24}>
                <Col span={16}>
                    <ProCard title="基本信息" bordered headerBordered loading={loading}>
                        <ProDescriptions column={2} dataSource={data}>
                            <ProDescriptions.Item label="客户名称">{data.customer_name}</ProDescriptions.Item>
                            <ProDescriptions.Item label="系统编号">{data.receivable_code}</ProDescriptions.Item>
                            <ProDescriptions.Item label="业务日期">{data.business_date}</ProDescriptions.Item>
                            <ProDescriptions.Item label="到期日期">{data.due_date}</ProDescriptions.Item>
                            <ProDescriptions.Item label="来源单据">{data.source_code} ({data.source_type})</ProDescriptions.Item>
                            <ProDescriptions.Item label="发票状态">
                                {data.invoice_issued ? <span style={{ color: 'green' }}>已开票 ({data.invoice_number})</span> : <span style={{ color: 'orange' }}>未开票</span>}
                            </ProDescriptions.Item>
                            <ProDescriptions.Item label="备注" span={2}>{data.notes || '-'}</ProDescriptions.Item>
                        </ProDescriptions>
                    </ProCard>

                    <ProCard title="关联明细" style={{ marginTop: 16 }} bordered headerBordered>
                        {/* Placeholder for order details or invoice items if we fetched them */}
                        <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                            暂无关联明细数据 (需关联订单API)
                        </div>
                    </ProCard>
                </Col>
                <Col span={8}>
                    <ProCard title="财务状态" bordered headerBordered loading={loading}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Statistic title="应收总额" value={data.total_amount} precision={2} prefix="¥" />
                            <Statistic title="已收金额" value={data.received_amount} precision={2} prefix="¥" valueStyle={{ color: '#3f8600' }} />
                            <Statistic title="剩余应收" value={data.remaining_amount} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
                            <Divider />
                            <div style={{ fontWeight: 'bold' }}>状态: {data.status}</div>
                            <div>审核: <span style={{ color: data.review_status === '已审核' ? 'green' : 'orange' }}>{data.review_status}</span></div>
                        </Space>
                    </ProCard>

                    <ProCard title="操作记录" style={{ marginTop: 16 }} bordered headerBordered>
                        <Timeline
                            items={[
                                { color: 'green', children: `创建于 ${data.created_at}` },
                                // TODO: Add real history log
                            ]}
                        />
                    </ProCard>
                </Col>
            </Row>

            <ModalForm
                title="登记收款"
                open={receiptModalVisible}
                onOpenChange={setReceiptModalVisible}
                onFinish={handleReceipt}
                initialValues={{
                    receipt_date: dayjs(),
                    receipt_amount: data.remaining_amount,
                }}
            >
                <ProFormMoney
                    name="receipt_amount"
                    label="本次收款金额"
                    rules={[{ required: true }]}
                    fieldProps={{ max: data.remaining_amount }}
                />
                <ProFormDatePicker
                    name="receipt_date"
                    label="收款日期"
                    rules={[{ required: true }]}
                    width="md"
                />
                <ProFormTextArea
                    name="notes"
                    label="备注"
                />
            </ModalForm>
        </PageContainer>
    );
};

export default ReceivableDetail;
