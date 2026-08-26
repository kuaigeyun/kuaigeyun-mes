import React, { useEffect, useMemo, useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { Button, Statistic, Row, Col, Spin, Empty, Typography, Space } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import { useLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import { receivableService } from '../../../services/finance/receivable';
import { Receivable } from '../../../types/finance/receivable';
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
import { getReceivableLifecycle } from '../../../utils/receivableLifecycle';
import { FinanceArApInvoiceStatusDetail } from '../../../utils/financeInvoiceStatusUi';
import { renderRefundExecutionMarker } from '../../../utils/financeUiLabels';
import { MarkerTag } from '../../../../../constants/statusBadges';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

const P = 'app.kuaicaiwu.receivable';
const RECEIPT_RESOURCE = 'kuaicaiwu:receipt';

const ReceivableDetail: React.FC = () => {
  const { t } = useTranslation();
  const amountDecimals = useNumericPrecisionPlaces('amount');
  const linked = useLinkedDocumentDetail();
  const receiptPerms = useResourcePermissions(RECEIPT_RESOURCE);
  const salesInvoicePerms = useResourcePermissions('kuaicaiwu:sales-invoice');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<Receivable>();
  const [loading, setLoading] = useState(false);

  const pageTitle = data?.receivable_code
    ? `${t(`${P}.detailTitle`)} - ${data.receivable_code}`
    : t(`${P}.detailTitle`);

  useEffect(() => {
    if (!data?.receivable_code) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: data.receivable_code },
      }),
    );
  }, [data?.receivable_code, location.pathname, location.search]);

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

  const documentTracking = useDocumentTracking(
    data?.id != null ? 'receivable' : undefined,
    data?.id
  );

  const linkedSalesInvoices = useMemo(
    () =>
      documentTracking.data?.relations?.downstream?.filter(
        (rel) => rel.type === 'sales_invoice' && !rel.is_deleted,
      ) ?? [],
    [documentTracking.data],
  );

  const openReceiptFromReceivable = () => {
    if (!data?.id) return;
    navigate('/apps/kuaicaiwu/finance-management/receipts', {
      state: { pullReceivableId: data.id },
    });
  };

  const openInvoiceFromReceivable = () => {
    if (!data?.id) return;
    navigate('/apps/kuaicaiwu/finance-management/sales-invoices', {
      state: { pullReceivableId: data.id },
    });
  };

  const pageActions = data ? (
    <>
      <Button onClick={() => navigate(-1)}>{t('common.back')}</Button>
      <UniWorkflowActions
        record={data}
        apiPrefix="/apps/kuaicaiwu/receivables"
        entityType="receivable"
        entityName={t(`${P}.entityName`)}
        statusField="status"
        reviewStatusField="review_status"
        draftStatuses={['草稿', 'draft']}
        pendingStatuses={['待审核']}
        approvedStatuses={['已审核']}
        rejectedStatuses={['已驳回', '驳回']}
        theme="default"
        onSuccess={loadData}
      />
      {salesInvoicePerms.canCreate ? (
        <Button onClick={openInvoiceFromReceivable}>{t(`${P}.createInvoice`)}</Button>
      ) : null}
      {data.status !== '已结清' && receiptPerms.canCreate ? (
        <Button type="primary" onClick={openReceiptFromReceivable}>
          {t(`${P}.recordReceipt`)}
        </Button>
      ) : null}
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

  return renderShell(
        <Row gutter={PAGE_SPACING.BLOCK_GAP} wrap={false} align="stretch">
          <Col flex="70%" style={{ minWidth: 0 }}>
            <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
              <ProDescriptions column={3} dataSource={data as unknown as Record<string, unknown>} loading={loading}>
                <ProDescriptions.Item label={t(`${P}.col.customerName`)}>{data.customer_name}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.systemCode')}>{data.receivable_code}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.businessDate')}>{data.business_date}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.dueDate')}>{data.due_date}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.sourceDoc')}>
                  {data.source_code} ({data.source_type})
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t(`${P}.col.invoiceStatus`)}>
                  <FinanceArApInvoiceStatusDetail
                    kind="receivable"
                    invoiceStatus={data.invoice_status}
                    invoicedAmount={data.invoiced_amount}
                    remainingInvoiceAmount={data.remaining_invoice_amount}
                    linkedInvoices={linkedSalesInvoices}
                    onInvoiceClick={linked.openLinkedDocumentDetail}
                    t={t}
                  />
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.businessStatus')}>{data.status}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.financeUi.refundExecution.label')}>
                  {(() => {
                    const { label, color } = renderRefundExecutionMarker(data.refund_execution_status, t);
                    return <MarkerTag color={color}>{label}</MarkerTag>;
                  })()}
                </ProDescriptions.Item>
                <ProDescriptions.Item label={t('app.kuaicaiwu.common.reviewStatus')}>{data.review_status}</ProDescriptions.Item>
                <ProDescriptions.Item label={t('common.remark')} span={3}>
                  {data.notes || '-'}
                </ProDescriptions.Item>
              </ProDescriptions>
              <Row gutter={24} style={{ marginTop: 16 }}>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.totalAmount`)} value={data.total_amount} precision={amountDecimals} prefix="¥" />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.receivedAmount`)} value={data.received_amount} precision={amountDecimals} prefix="¥" styles={{ content: {color: '#3f8600' } }} />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.remainingAmount`)} value={data.remaining_amount} precision={amountDecimals} prefix="¥" styles={{ content: {color: '#cf1322' } }} />
                </Col>
              </Row>
              {Number(data.refunded_amount ?? 0) > 0 ? (
                <Row gutter={24} style={{ marginTop: 16 }}>
                  <Col xs={24} sm={8}>
                    <Statistic
                      title={t(`${P}.col.refundedAmount`)}
                      value={data.refunded_amount ?? 0}
                      precision={amountDecimals}
                      prefix="¥"
                      styles={{ content: { color: '#d48806' } }}
                    />
                  </Col>
                </Row>
              ) : null}
              <Row gutter={24} style={{ marginTop: 16 }}>
                <Col xs={24} sm={8}>
                  <Statistic title={t(`${P}.col.invoicedAmount`)} value={data.invoiced_amount ?? 0} precision={amountDecimals} prefix="¥" />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title={t(`${P}.col.remainingInvoiceAmount`)}
                    value={data.remaining_invoice_amount ?? 0}
                    precision={amountDecimals}
                    prefix="¥"
                    styles={{
                      content: {
                        color: Number(data.remaining_invoice_amount ?? 0) > 0 ? '#1677ff' : 'inherit',
                        fontWeight: Number(data.remaining_invoice_amount ?? 0) > 0 ? 'bold' : 'normal',
                      },
                    }}
                  />
                </Col>
              </Row>
            </DetailDrawerSection>

            <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(() => {
                  const lc = getReceivableLifecycle(data as unknown as Record<string, unknown>, t);
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
                      onDocumentClick={(docType, docId) => linked.openLinkedDocumentDetail(docType, docId)}
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
      );
};

export default ReceivableDetail;
