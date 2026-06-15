import React, { useEffect, useState } from 'react';
import { ProDescriptions, ModalForm, ProFormMoney, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { Button, message, Statistic, Row, Col, Spin, Empty, Typography, Space } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { payableService } from '../../../services/finance/payable';
import { Payable } from '../../../types/finance/payable';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DetailDrawerSection,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  PAGE_SPACING,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import {
  DocumentTrackingRelationsBody,
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { getPayableLifecycle } from '../../../utils/payableLifecycle';
import dayjs from 'dayjs';

const PayableDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<Payable>();
  const [loading, setLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const pageTitle = data?.payable_code ? `应付账款 · ${data.payable_code}` : '应付账款';

  useEffect(() => {
    if (!data?.payable_code) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: data.payable_code },
      }),
    );
  }, [data?.payable_code, location.pathname, location.search]);

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

  const documentTracking = useDocumentTracking(
    data?.id != null ? 'payable' : undefined,
    data?.id
  );

  const handlePayment = async (values: any) => {
    if (!id) return;
    try {
      await payableService.recordPayment(Number(id), {
        payable_id: Number(id),
        payment_amount: values.payment_amount,
        payment_date: dayjs(values.payment_date).format('YYYY-MM-DD'),
        payment_method: values.payment_method || '银行转账',
        notes: values.notes,
      });
      message.success('付款单已创建并完成核销');
      setPaymentModalVisible(false);
      loadData();
    } catch {
      // Error handled by interceptor
    }
  };

  const pageActions = data ? (
    <>
      <Button onClick={() => navigate(-1)}>返回</Button>
      <UniWorkflowActions
        record={data}
        entityName="应付单"
        statusField="status"
        reviewStatusField="review_status"
        draftStatuses={[]}
        pendingStatuses={['待审核']}
        approvedStatuses={['已审核', '通过']}
        rejectedStatuses={['已驳回', '驳回']}
        theme="default"
        size="small"
        onSuccess={loadData}
      />
      {data.status !== '已结清' && (
        <Button type="primary" onClick={() => setPaymentModalVisible(true)}>
          登记付款
        </Button>
      )}
    </>
  ) : null;

  const renderShell = (body: React.ReactNode) => (
    <div style={uniTabsChildPageVerticalInsetStyle()}>
      <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
        <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
          {pageTitle}
        </Typography.Title>
        {pageActions ? <Space wrap size={8}>{pageActions}</Space> : null}
      </div>
      {body}
    </div>
  );

  if (!id) return null;

  if (loading && !data) {
    return renderShell(
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>,
    );
  }

  if (!data) {
    return renderShell(<Empty description="未找到应付单" />);
  }

  return (
    <>
      {renderShell(
        <Row gutter={PAGE_SPACING.BLOCK_GAP} wrap={false} align="stretch">
          <Col flex="70%" style={{ minWidth: 0 }}>
            <DetailDrawerSection title="基本信息">
              <ProDescriptions column={3} dataSource={data as unknown as Record<string, unknown>} loading={loading}>
                <ProDescriptions.Item label="供应商名称">{data.supplier_name}</ProDescriptions.Item>
                <ProDescriptions.Item label="系统编号">{data.payable_code}</ProDescriptions.Item>
                <ProDescriptions.Item label="业务日期">{data.business_date}</ProDescriptions.Item>
                <ProDescriptions.Item label="到期日期">{data.due_date}</ProDescriptions.Item>
                <ProDescriptions.Item label="来源单据">
                  {data.source_code} ({data.source_type})
                </ProDescriptions.Item>
                <ProDescriptions.Item label="发票状态">
                  {data.invoice_received ? (
                    <span style={{ color: 'green' }}>已收票 ({data.invoice_number})</span>
                  ) : (
                    <span style={{ color: 'orange' }}>未收票</span>
                  )}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="业务状态">{data.status}</ProDescriptions.Item>
                <ProDescriptions.Item label="审核状态">{data.review_status}</ProDescriptions.Item>
                <ProDescriptions.Item label="备注" span={3}>
                  {data.notes || '-'}
                </ProDescriptions.Item>
              </ProDescriptions>
              <Row gutter={24} style={{ marginTop: 16 }}>
                <Col xs={24} sm={8}>
                  <Statistic title="应付总额" value={data.total_amount} precision={2} prefix="¥" />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title="已付金额" value={data.paid_amount} precision={2} prefix="¥" styles={{ content: {color: '#3f8600' } }} />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title="剩余应付" value={data.remaining_amount} precision={2} prefix="¥" styles={{ content: {color: '#cf1322' } }} />
                </Col>
              </Row>
            </DetailDrawerSection>

            <DetailDrawerSection title="生命周期">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lc = getPayableLifecycle(data as unknown as Record<string, unknown>);
                  const mainStages = lc.mainStages ?? [];
                  if (mainStages.length === 0) return null;
                  return (
                    <UniLifecycleStepper
                      steps={mainStages}
                      showLabels
                      status={lc.status}
                      nextStepSuggestions={lc.nextStepSuggestions}
                    />
                  );
                })()}
                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--ant-color-border-secondary)',
                  }}
                >
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    上下游单据
                  </div>
                  {documentTracking.loading && (
                    <div style={{ padding: '8px 0' }}>
                      <Spin size="small" />
                    </div>
                  )}
                  {documentTracking.error && (
                    <Typography.Text type="danger">{documentTracking.error}</Typography.Text>
                  )}
                  {documentTracking.data && (
                    <DocumentTrackingRelationsBody
                      data={documentTracking.data}
                      onDocumentClick={(docType, docId) =>
                        message.info(`打开关联单据 ${docType} #${docId}`)
                      }
                    />
                  )}
                </div>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息" marginBottom={0}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联明细（需对接来源订单/明细 API）" />
            </DetailDrawerSection>
          </Col>

          <Col flex="30%" style={{ minWidth: 0 }}>
            <DetailDrawerSection title="操作记录" marginBottom={0} style={{ height: '100%' }}>
              {documentTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {documentTracking.error && !documentTracking.loading && (
                <Typography.Text type="danger">{documentTracking.error}</Typography.Text>
              )}
              {documentTracking.data && !documentTracking.loading && (
                <DocumentTrackingTimelineBody data={documentTracking.data} />
              )}
              {!documentTracking.loading && !documentTracking.data && !documentTracking.error && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
              )}
            </DetailDrawerSection>
          </Col>
        </Row>,
      )}

      <ModalForm
        title="登记付款"
        open={paymentModalVisible}
        onOpenChange={setPaymentModalVisible}
        onFinish={handlePayment}
        initialValues={{
          payment_date: dayjs(),
          payment_amount: data.remaining_amount,
          payment_method: '银行转账',
        }}
      >
        <ProFormMoney
          name="payment_amount"
          label="本次付款金额"
          rules={[{ required: true }]}
          fieldProps={{ max: data.remaining_amount }}
        />
        <ProFormDatePicker name="payment_date" label="付款日期" rules={[{ required: true }]} width="md" />
        <ProFormSelect
          name="payment_method"
          label="付款方式"
          options={[
            { label: '银行转账', value: '银行转账' },
            { label: '现金', value: '现金' },
            { label: '支票', value: '支票' },
            { label: '承兑汇票', value: '承兑汇票' },
            { label: '其他', value: '其他' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormTextArea name="notes" label="备注" />
      </ModalForm>
    </>
  );
};

export default PayableDetail;
