/**
 * 关联单据：报价单原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import { AmountDisplay } from '../../permission';
import { MaterialUnitLabel } from '../../material-unit-label';
import { getQuotation, type Quotation } from '../../../apps/kuaizhizao/services/quotation';
import { getQuotationLifecycle } from '../../../apps/kuaizhizao/utils/quotationLifecycle';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { formatDateTime, formatQuantity } from '../../../utils/format';
import { normalizeUserDisplayName } from '../../../utils/userDisplay';
import { useOptionalLinkedDocumentDetail } from '../LinkedDocumentDetailContext';

export type QuotationLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

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
  const [refreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDetail(await getQuotation(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('app.kuaizhizao.quotation.detailFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getQuotationLifecycle(detail, auditRequired, t) : null),
    [detail, auditRequired, t],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const showNextInTitle = Boolean(nextSteps?.length) && !detail?.conversion_downstream_missing;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'quotation' : undefined,
    detail?.id,
    refreshKey,
  );

  const title = detail?.quotation_code
    ? t('app.kuaizhizao.quotation.detailTitleWithCode', { code: detail.quotation_code })
    : t('app.kuaizhizao.quotation.detailTitle');

  if (!open) return null;

  if (loading || !detail) {
    return (
      <DetailDrawerTemplate
        title={title}
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.HALF_WIDTH}
        zIndex={zIndex}
        plainBody={
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        }
      />
    );
  }

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      collaborationTitleSuffix={
        showNextInTitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
          </Typography.Text>
        ) : undefined
      }
      collaborationAuditRecord={detail as any}
      collaborationLifecycle={
        lifecycle ? (
          <UniLifecycleStepper
            steps={lifecycle.mainStages ?? []}
            status={lifecycle.status}
            showLabels
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions={Boolean(nextSteps?.length)}
          />
        ) : undefined
      }
      basic={
        <Descriptions
          column={3}
          size="small"
          items={[
            { key: 'quotation_code', label: t('app.kuaizhizao.quotation.colQuotationCode'), children: detail.quotation_code || '-' },
            {
              key: 'status',
              label: t('common.status'),
              children: <Tag>{lifecycle?.stageName || detail.status || '-'}</Tag>,
            },
            { key: 'customer_name', label: t('app.kuaizhizao.quotation.form.customer'), children: detail.customer_name || '-' },
            {
              key: 'quotation_date',
              label: t('app.kuaizhizao.quotation.colQuotationDate'),
              children: detail.quotation_date ? formatDateTime(detail.quotation_date, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'valid_until',
              label: t('app.kuaizhizao.quotation.form.validUntil'),
              children: detail.valid_until ? formatDateTime(detail.valid_until, 'YYYY-MM-DD') : '-',
            },
            {
              key: 'total_quantity',
              label: t('app.kuaizhizao.quotation.form.quoteQuantity'),
              children: formatQuantity(detail.total_quantity),
            },
            {
              key: 'total_amount',
              label: t('app.kuaizhizao.quotation.colTotalAmount'),
              children: <AmountDisplay value={detail.total_amount} fieldName="total_amount" />,
            },
            {
              key: 'salesman_name',
              label: t('app.kuaizhizao.quotation.colSalesman'),
              children: normalizeUserDisplayName(detail.salesman_name) || '-',
            },
            {
              key: 'sales_order_code',
              label: t('app.kuaizhizao.quotation.form.linkedSalesOrder'),
              children: detail.sales_order_code || '-',
            },
            {
              key: 'notes',
              label: t('app.kuaizhizao.salesOrder.notes'),
              children: detail.notes || '-',
              span: 3,
            },
          ]}
        />
      }
      lines={
        <Table
          size="small"
          rowKey={(r) => String(r.id ?? r.material_id ?? Math.random())}
          pagination={false}
          scroll={{ x: 1060 }}
          dataSource={detail.items ?? []}
          columns={[
            { title: t('app.kuaizhizao.quotation.colMaterialCode'), dataIndex: 'material_code', width: 120 },
            { title: t('app.kuaizhizao.quotation.colMaterialName'), dataIndex: 'material_name', width: 140 },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.unit'),
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
            {
              title: t('app.kuaizhizao.quotation.import.deliveryDate'),
              dataIndex: 'delivery_date',
              width: 120,
              render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
            },
          ]}
        />
      }
      timeline={
        <>
          {tracking.loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : null}
          {tracking.data && !tracking.loading ? <DocumentTrackingTimelineBody data={tracking.data} /> : null}
        </>
      }
      traceDocument={{
        documentType: 'quotation',
        documentId: detail.id!,
        selfDocumentId: detail.id!,
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
      }}
    />
  );
}
