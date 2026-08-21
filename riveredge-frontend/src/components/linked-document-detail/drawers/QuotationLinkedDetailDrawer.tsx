/**
 * 关联单据：报价单原版详情（只取数；单一 DetailDrawerTemplate，禁止加载/有数据两棵壳）。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Result, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { DetailDrawerTemplate, DRAWER_CONFIG, detailDrawerDescriptionItems } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { AmountDisplay } from '../../permission';
import { MaterialUnitLabel } from '../../material-unit-label';
import { getQuotation, type Quotation } from '../../../apps/kuaizhizao/services/quotation';
import { getQuotationLifecycle } from '../../../apps/kuaizhizao/utils/quotationLifecycle';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { formatQuantity } from '../../../utils/format';
import { normalizeUserDisplayName } from '../../../utils/userDisplay';
import { useOptionalLinkedDocumentDetail } from '../LinkedDocumentDetailContext';
import { alignDescriptionColumns } from '../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

export type QuotationLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

const PLACEHOLDER: Quotation = { id: 0 };

export function QuotationLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: QuotationLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const linked = useOptionalLinkedDocumentDetail();
  const auditRequired = useAuditRequired('quotation', false);
  const [detail, setDetail] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDetail((prev) => (prev?.id === documentId ? prev : null));
    try {
      setDetail(await getQuotation(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('app.kuaizhizao.quotation.detailFailed');
      setDetail(null);
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const contentReady = Boolean(detail);
  const showError = Boolean(loadError) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = detail ?? PLACEHOLDER;

  const lifecycle = useMemo(
    () => (contentReady ? getQuotationLifecycle(effective, auditRequired, t) : null),
    [contentReady, effective, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length) && !effective.conversion_downstream_missing;
  const tracking = useDocumentTracking(
    open && contentReady ? 'quotation' : undefined,
    effective.id,
    refreshKey,
  );

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns<Quotation>([
        { title: t('app.kuaizhizao.quotation.colQuotationCode'), dataIndex: 'quotation_code' },
        { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name' },
        { title: t('app.kuaizhizao.quotation.colQuotationDate'), dataIndex: 'quotation_date', valueType: 'date' },
        { title: t('app.kuaizhizao.quotation.form.validUntil'), dataIndex: 'valid_until', valueType: 'date' },
        {
          title: t('app.kuaizhizao.quotation.form.quoteQuantity'),
          dataIndex: 'total_quantity',
          render: (_, record) => formatQuantity(record.total_quantity),
        },
        {
          title: t('app.kuaizhizao.quotation.colTotalAmount'),
          dataIndex: 'total_amount',
          render: (_, record) => <AmountDisplay value={record.total_amount} fieldName="total_amount" />,
        },
        {
          title: t('app.kuaizhizao.quotation.colSalesman'),
          dataIndex: 'salesman_name',
          render: (_, record) => normalizeUserDisplayName(record.salesman_name) || '-',
        },
        { title: t('app.kuaizhizao.quotation.form.linkedSalesOrder'), dataIndex: 'sales_order_code' },
        { title: t('common.remark'), dataIndex: 'notes', span: 3 },
      ] as ProDescriptionsItemProps<Quotation>[]),
    [t],
  );

  const title = detail?.quotation_code
    ? t('app.kuaizhizao.quotation.detailTitleWithCode', { code: detail.quotation_code })
    : t('app.kuaizhizao.quotation.detailTitle');

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={loadError}
            extra={
              <Button type="primary" onClick={() => setRefreshKey((k) => k + 1)}>
                {t('common.retry', { defaultValue: '重试' })}
              </Button>
            }
          />
        ) : undefined
      }
      collaborationTitleSuffix={
        contentReady && showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('common.next')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={contentReady ? effective : null}
      basic={
        contentReady ? (
          <Descriptions column={3} size="small" items={detailDrawerDescriptionItems(basicColumns, effective)} />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaboration={
        contentReady && lifecycle ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : null
      }
      lines={
        contentReady ? (
          <Table
            size="small"
            rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
            pagination={false}
            scroll={{ x: 1060 }}
            dataSource={effective.items ?? []}
            columns={[
              { title: t('app.kuaizhizao.quotation.colMaterialCode'), dataIndex: 'material_code', width: 120 },
              { title: t('app.kuaizhizao.quotation.colMaterialName'), dataIndex: 'material_name', width: 140 },
              {
                title: t('common.unit'),
                dataIndex: 'material_unit',
                width: 72,
                render: (v) => <MaterialUnitLabel value={v} />,
              },
              {
                title: t('app.kuaizhizao.quotation.form.quoteQuantity'),
                dataIndex: 'quote_quantity',
                width: 100,
                align: 'right',
                render: (v) => formatQuantity(v),
              },
              {
                title: t('app.kuaizhizao.quotation.import.unitPrice'),
                dataIndex: 'unit_price',
                width: 100,
                align: 'right',
                render: (v) => <AmountDisplay value={v} fieldName="unit_price" />,
              },
            ]}
          />
        ) : null
      }
      timeline={
        contentReady ? (
          tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null
        ) : null
      }
      traceDocument={
        contentReady && effective.id != null
          ? {
              documentType: 'quotation',
              documentId: effective.id,
              selfDocumentId: effective.id,
              renderBriefActions: (doc) =>
                doc.document_type === 'sales_order' ? (
                  <Typography.Link
                    onClick={() => {
                      linked?.openLinkedDocumentDetail('sales_order', doc.document_id);
                    }}
                  >
                    {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
                  </Typography.Link>
                ) : null,
            }
          : undefined
      }
    />
  );
}
