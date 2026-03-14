import React, { useEffect, useState } from 'react';
import { PageContainer, ProDescriptions, ProCard } from '@ant-design/pro-components';
import { Button, Space, Row, Col } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

const PurchaseInvoiceDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<PurchaseInvoice>();
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await purchaseInvoiceService.get(Number(id));
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

    if (!data) return null;

    return (
        <PageContainer
            title={`采购发票详情: ${data.invoice_code}`}
            extra={[
                <Button key="back" onClick={() => navigate(-1)}>返回</Button>,
                data.review_status === '待审核' && (
                    <UniWorkflowActions
                        key="workflow"
                        record={data}
                        entityName="采购发票"
                        statusField="status"
                        reviewStatusField="review_status"
                        draftStatuses={[]}
                        pendingStatuses={['待审核']}
                        approvedStatuses={['已审核', '通过']}
                        rejectedStatuses={['已驳回', '驳回']}
                        theme="default"
                        size="small"
                        actions={{
                            approve: (id) => purchaseInvoiceService.approve(id),
                            reject: (id, reason) => purchaseInvoiceService.approve(id, reason),
                        }}
                        onSuccess={loadData}
                    />
                ),
            ]}
        >
            <Row gutter={24}>
                <Col span={24}>
                    <ProCard title="基本信息" bordered headerBordered loading={loading}>
                        <ProDescriptions column={2} dataSource={data as Record<string, unknown>}>
                            <ProDescriptions.Item label="发票编码">{data.invoice_code}</ProDescriptions.Item>
                            <ProDescriptions.Item label="采购订单">{data.purchase_order_code}</ProDescriptions.Item>
                            <ProDescriptions.Item label="供应商">{data.supplier_name}</ProDescriptions.Item>
                            <ProDescriptions.Item label="发票号码">{data.invoice_number}</ProDescriptions.Item>
                            <ProDescriptions.Item label="开票日期">{data.invoice_date}</ProDescriptions.Item>
                            <ProDescriptions.Item label="发票类型">{data.invoice_type}</ProDescriptions.Item>
                            <ProDescriptions.Item label="发票金额">{data.invoice_amount}</ProDescriptions.Item>
                            <ProDescriptions.Item label="税额">{data.tax_amount}</ProDescriptions.Item>
                            <ProDescriptions.Item label="价税合计">{data.total_amount}</ProDescriptions.Item>
                            <ProDescriptions.Item label="税率">{data.tax_rate}%</ProDescriptions.Item>
                            <ProDescriptions.Item label="状态">{data.status}</ProDescriptions.Item>
                            <ProDescriptions.Item label="审核状态">{data.review_status}</ProDescriptions.Item>
                            <ProDescriptions.Item label="应付单">{data.payable_code || '-'}</ProDescriptions.Item>
                            <ProDescriptions.Item label="备注" span={2}>{data.notes || '-'}</ProDescriptions.Item>
                        </ProDescriptions>
                    </ProCard>
                </Col>
            </Row>
        </PageContainer>
    );
};

export default PurchaseInvoiceDetail;
