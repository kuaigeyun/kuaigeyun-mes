import React, { useEffect, useMemo, useState } from 'react';
import { ProDescriptions, ModalForm, ProFormMoney, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { Button, message, Statistic, Row, Col, Spin, Empty, Typography, Space } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { getPaymentMethodOptions } from '../../../utils/financeSharedOptions';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaicaiwu.payable';

const PayableDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<Payable>();
  const [loading, setLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);

  const pageTitle = data?.payable_code
    ? `${t(`${P}.detailTitle`)} · ${data.payable_code}`
    : t(`${P}.detailTitle`);

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
        payment_date: formatDateTime(values.payment_date, 'YYYY-MM-DD'),
        payment_method: values.payment_method || '银行转账',
        notes: values.notes,
      });
      message.success(t(`${P}.paymentSuccess`));
      setPaymentModalVisible(false);
      loadData();
    } catch {
      // Error handled by interceptor
    }
  };

  const pageActions = data ? (
    <>
      <Button onClick={() => navigate(-1)}>{t('app.kuaicaiwu.common.back')}</Button>
      <UniWorkflowActions
        record={data}
        entityName={t(`${P}.entityName`)}
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
          {t(`${P}.recordPayment`)}
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
    return renderShell(<Empty description={t(`${P}.detailNotFound`)} />);
  }

  return (
    <>
      {renderShell(
        <Row gutter={PAGE_SPACING.BLOCK_GAP} wrap={false} align="stretch">
          <Col flex="70%" style={{ minWidth: 0 }}>
            <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
              <ProDescriptions column={3} dataSource={data as unknown as Record<string, unknown>} loading={loading}>
                <ProDescriptions.Item label={t(`${P}.col.supplierName`)}>{data.supplier_name}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.systemCode')}>{data.payable_code}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.businessDate')}>{data.business_date}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.dueDate')}>{data.due_date}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.sourceDoc')}>
                  {data.source_code} ({data.source_type})
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.invoiceDate')}>
                  {data.invoice_received ? (
                    <span style={{ color: 'green' }}>{t(`${P}.invoiceStatus.received`, { number: data.invoice_number })}</span>
                  ) : (
                    <span style={{ color: 'orange' }}>{t(`${P}.invoiceStatus.notReceived`)}</span>
                  )}
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.businessStatus')}>{data.status}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.reviewStatus')}>{data.review_status}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.notes')} span={3}>
                  {data.notes || '-'}
                </ProDescriptions.Item>
              </ProDescriptions>
              <Row gutter={24} style={{ marginTop: 16 }}>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.totalAmount`)} value={data.total_amount} precision={2} prefix="¥" />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.paidAmount`)} value={data.paid_amount} precision={2} prefix="¥" styles={{ content: {color: '#3f8600' } }} />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.remainingAmount`)} value={data.remaining_amount} precision={2} prefix="¥" styles={{ content: {color: '#cf1322' } }} />
                </Col>
              </Row>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lc = getPayableLifecycle(data as unknown as Record<string, unknown>, t);
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
                    {t('app.kuaicaiwu.common.upstreamDownstream')}
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
                        message.info(t('app.kuaicaiwu.common.openLinkedDoc', { docType, docId }))
                      }
                    />
                  )}
                </div>
              </div>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionLines')} marginBottom={0}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.noLineItems`)} />
            </DetailDrawerSection>
          </Col>

          <Col flex="30%" style={{ minWidth: 0 }}>
            <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')} marginBottom={0} style={{ height: '100%' }}>
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaicaiwu.common.noActivityLog')} />
              )}
            </DetailDrawerSection>
          </Col>
        </Row>,
      )}

      <ModalForm
        title={t(`${P}.recordPayment`)}
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
          label={t(`${P}.paymentAmount`)}
          rules={[{ required: true }]}
          fieldProps={{ max: data.remaining_amount }}
        />
        <ProFormDatePicker name="payment_date" label={t(`${P}.paymentDate`)} rules={[{ required: true }]} width="md" />
        <ProFormSelect
          name="payment_method"
          label={t(`${P}.paymentMethod`)}
          options={paymentMethodOptions}
          rules={[{ required: true }]}
        />
        <ProFormTextArea name="notes" label={t('app.kuaicaiwu.common.notes')} />
      </ModalForm>
    </>
  );
};

export default PayableDetail;
