/**
 * 关联单据：采购申请原版详情（只读插槽壳）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Descriptions, Spin, Table, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DetailDrawerTemplate, DRAWER_CONFIG } from '../../layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../document-tracking-panel';
import { UniLifecycleStepper } from '../../uni-lifecycle';
import {
  getPurchaseRequisition,
  type PurchaseRequisition,
} from '../../../apps/kuaizhizao/services/purchase-requisition';
import { getPurchaseRequisitionLifecycle } from '../../../apps/kuaizhizao/utils/purchaseRequisitionLifecycle';
import { formatPurchaseRequisitionSourceType } from '../../../apps/kuaizhizao/utils/purchaseRequisitionSourceType';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { formatDateTime, formatQuantity } from '../../../utils/format';
import { SourceDocumentCode } from '../../linked-document-code/SourceDocumentCode';

export type PurchaseRequisitionLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function PurchaseRequisitionLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PurchaseRequisitionLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const auditRequired = useAuditRequired('purchase_requisition', false);
  const [detail, setDetail] = useState<PurchaseRequisition | null>(null);
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
      setDetail(await getPurchaseRequisition(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('common.loadFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const lifecycle = useMemo(
    () => (detail ? getPurchaseRequisitionLifecycle(detail, auditRequired) : null),
    [detail, auditRequired],
  );
  const nextSteps = lifecycle?.nextStepSuggestions;
  const tracking = useDocumentTracking(
    open && detail?.id ? 'purchase_requisition' : undefined,
    detail?.id,
    refreshKey,
  );

  const title = detail?.requisition_code
    ? t('app.kuaizhizao.purchaseRequisition.detailTitle', { code: detail.requisition_code })
    : t('app.kuaizhizao.purchaseRequisition.entityName');

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
        nextSteps?.length ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {t('components.uniLifecycle.nextStep')}：
            {nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
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
            {
              key: 'requisition_code',
              label: t('app.kuaizhizao.purchaseRequisition.col.code'),
              children: detail.requisition_code || '-',
            },
            {
              key: 'requisition_name',
              label: t('app.kuaizhizao.purchaseRequisition.col.name'),
              children: detail.requisition_name || '-',
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <Tag>{lifecycle?.stageName || detail.status || '-'}</Tag>,
            },
            {
              key: 'source_type',
              label: t('app.kuaizhizao.purchaseRequisition.col.sourceType'),
              children: formatPurchaseRequisitionSourceType(detail.source_type, t),
            },
            {
              key: 'source_code',
              label: t('app.kuaizhizao.purchaseRequisition.col.sourceCode'),
              children: (
                <SourceDocumentCode
                  sourceType={detail.source_type}
                  sourceId={detail.source_id}
                  sourceCode={detail.source_code}
                />
              ),
            },
            {
              key: 'applicant_name',
              label: t('app.kuaizhizao.purchaseRequisition.form.applicant'),
              children: detail.applicant_name || '-',
            },
            {
              key: 'requisition_date',
              label: t('app.kuaizhizao.purchaseRequisition.form.date'),
              children: detail.requisition_date
                ? formatDateTime(detail.requisition_date, 'YYYY-MM-DD')
                : '-',
            },
            {
              key: 'required_date',
              label: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
              children: detail.required_date
                ? formatDateTime(detail.required_date, 'YYYY-MM-DD')
                : '-',
            },
            {
              key: 'notes',
              label: t('common.notes'),
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
          scroll={{ x: 900 }}
          dataSource={detail.items ?? []}
          columns={[
            {
              title: t('app.kuaizhizao.purchaseRequisition.col.materialCode'),
              dataIndex: 'material_code',
              width: 120,
            },
            {
              title: t('app.kuaizhizao.purchaseRequisition.col.materialName'),
              dataIndex: 'material_name',
              width: 150,
            },
            {
              title: t('app.kuaizhizao.purchaseRequisition.col.quantity'),
              dataIndex: 'quantity',
              width: 100,
              align: 'right',
              render: (v) => formatQuantity(v),
            },
            {
              title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
              dataIndex: 'required_date',
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
        documentType: 'purchase_requisition',
        documentId: detail.id!,
        selfDocumentId: detail.id!,
      }}
    />
  );
}
