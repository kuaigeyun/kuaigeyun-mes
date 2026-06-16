import React, { useEffect, useMemo, useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { Button, Spin, Empty, Typography, Timeline, Space } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import {
  DetailDrawerSection,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { formatChineseInvoiceType } from '../../../utils/financeSharedOptions';

const P = 'app.kuaicaiwu.purchaseInvoice';

const PurchaseInvoiceDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<PurchaseInvoice>();
  const [loading, setLoading] = useState(false);

  const pageTitle = useMemo(() => {
    const num = String(data?.invoice_number ?? '').trim();
    return num ? t(`${P}.detailTitleWithNumber`, { number: num }) : t(`${P}.detailTitle`);
  }, [data?.invoice_number, t]);

  const tabTitle = useMemo(() => {
    const num = String(data?.invoice_number ?? '').trim();
    return num || t(`${P}.detailTitle`);
  }, [data?.invoice_number, t]);

  useEffect(() => {
    if (!data) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: tabTitle },
      }),
    );
  }, [data, tabTitle, location.pathname, location.search]);

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

  const pageActions = data ? (
    <>
      <Button onClick={() => navigate(-1)}>{t('app.kuaicaiwu.common.back')}</Button>
      {data.review_status === '待审核' && (
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

  const lc = getChineseInvoiceLifecycle(data as unknown as Record<string, unknown>, t);

  return renderShell(
    <>
      <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
        <ProDescriptions column={3} dataSource={data as unknown as Record<string, unknown>} loading={loading}>
          <ProDescriptions.Item label={t(`${P}.col.purchaseOrder`)}>{data.purchase_order_code || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.supplier')}>{data.supplier_name}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.invoiceNumber`)}>{data.invoice_number || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.invoiceDate')}>{data.invoice_date}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.invoiceType`)}>{formatChineseInvoiceType(data.invoice_type, t)}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.invoiceAmount`)}>{data.invoice_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.taxAmount`)}>{data.tax_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.totalAmount`)}>{data.total_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.taxRate`)}>{data.tax_rate}%</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.businessStatus')}>{data.status}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.reviewStatus')}>{data.review_status}</ProDescriptions.Item>
          <ProDescriptions.Item label={t(`${P}.col.linkedPayable`)}>{data.payable_code || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label={t('app.kuaicaiwu.common.notes')} span={3}>
            {data.notes || '-'}
          </ProDescriptions.Item>
        </ProDescriptions>
      </DetailDrawerSection>

      <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
        <UniLifecycle
          percent={lc.percent}
          stageName={lc.stageName}
          status={lc.status}
          subStages={lc.subStages}
          showLabel
          size="small"
          showCircleTooltip={false}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          {t(`${P}.lifecycleHint`)}
        </Typography.Paragraph>
      </DetailDrawerSection>

      <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.noLines`)} />
      </DetailDrawerSection>

      <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')} marginBottom={0}>
        <Timeline
          items={[
            { color: 'green', children: t(`${P}.activityCreated`, { time: data.created_at }) },
            ...(data.updated_at && data.updated_at !== data.created_at
              ? [{ color: 'blue', children: t(`${P}.activityUpdated`, { time: data.updated_at }) }]
              : []),
          ]}
        />
      </DetailDrawerSection>
    </>,
  );
};

export default PurchaseInvoiceDetail;
