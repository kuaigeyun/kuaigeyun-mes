import React, { useEffect, useState } from 'react';
import { PageContainer, ProDescriptions, ProCard } from '@ant-design/pro-components';
import { Button, Modal, message, Space, Statistic, Row, Col, Divider, Timeline } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { payableService } from '../../../services/finance/payable';
import { Payable } from '../../../types/finance/payable';
import { ModalForm, ProFormMoney, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import dayjs from 'dayjs';

const PayableDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<Payable>();
    const [loading, setLoading] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await payableService.getPayable(Number(id));
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

    const handlePayment = async (values: any) => {
        if (!id) return;
        try {
            await payableService.recordPayment(Number(id), {
                payment_amount: values.payment_amount,
                payment_date: values.payment_date,
                notes: values.notes,
            });
            message.success('付款记录已添加');
            setPaymentModalVisible(false);
            loadData();
        } catch (error) {
            // Error handled by interceptor
        }
    };

    if (!data) return null;

    return (
        <PageContainer
            title={`应付单详情: ${data.payable_code}`}
            extra={[
                <Button key="back" onClick={() => navigate(-1)}>返回</Button>,
                data.status !== '已结清' && (
                    <Button key="payment" type="primary" onClick={() => setPaymentModalVisible(true)}>
                        登记付款
                    </Button>
                ),
            ]}
        >
            <Row gutter={24}>
                <Col span={16}>
                    <ProCard title="基本信息" bordered headerBordered loading={loading}>
                        <ProDescriptions column={2} dataSource={data}>
                            <ProDescriptions.Item label="供应商名称">{data.supplier_name}</ProDescriptions.Item>
                            <ProDescriptions.Item label="系统编号">{data.payable_code}</ProDescriptions.Item>
                            <ProDescriptions.Item label="业务日期">{data.business_date}</ProDescriptions.Item>
                            <ProDescriptions.Item label="到期日期">{data.due_date}</ProDescriptions.Item>
                            <ProDescriptions.Item label="来源单据">{data.source_code} ({data.source_type})</ProDescriptions.Item>
                            <ProDescriptions.Item label="发票状态">
                                {data.invoice_received ? <span style={{ color: 'green' }}>已收票 ({data.invoice_number})</span> : <span style={{ color: 'orange' }}>未收票</span>}
                            </ProDescriptions.Item>
                            <ProDescriptions.Item label="备注" span={2}>{data.notes || '-'}</ProDescriptions.Item>
                        </ProDescriptions>
                    </ProCard>
                </Col>
                <Col span={8}>
                    <ProCard title="财务状态" bordered headerBordered loading={loading}>
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Statistic title="应付总额" value={data.total_amount} precision={2} prefix="¥" />
                            <Statistic title="已付金额" value={data.paid_amount} precision={2} prefix="¥" valueStyle={{ color: '#3f8600' }} />
                            <Statistic title="剩余应付" value={data.remaining_amount} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
                            <Divider />
                            <div style={{ fontWeight: 'bold' }}>状态: {data.status}</div>
                            <div>审核: <span style={{ color: data.review_status === '已审核' ? 'green' : 'orange' }}>{data.review_status}</span></div>
                        </Space>
                    </ProCard>

                    <ProCard title="操作记录" style={{ marginTop: 16 }} bordered headerBordered>
                        <Timeline
                            items={[
                                { color: 'green', children: `创建于 ${data.created_at}` },
                            ]}
                        />
                    </ProCard>
                </Col>
            </Row>

            <ModalForm
                title="登记付款"
                open={paymentModalVisible}
                onOpenChange={setPaymentModalVisible}
                onFinish={handlePayment}
                initialValues={{
                    payment_date: dayjs(),
                    payment_amount: data.remaining_amount,
                }}
            >
                <ProFormMoney
                    name="payment_amount"
                    label="本次付款金额"
                    rules={[{ required: true }]}
                    fieldProps={{ max: data.remaining_amount }}
                />
                <ProFormDatePicker
                    name="payment_date"
                    label="付款日期"
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

export default PayableDetail;
