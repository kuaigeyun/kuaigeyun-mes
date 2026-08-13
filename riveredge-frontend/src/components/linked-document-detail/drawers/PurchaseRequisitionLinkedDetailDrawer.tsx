/**
 * 关联单据：采购申请原版详情（只取数 + PurchaseRequisitionDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { PurchaseRequisitionDetailDrawer } from '../../../apps/kuaizhizao/pages/purchase-management/purchase-requisitions/components/PurchaseRequisitionDetailDrawer';
import { getPurchaseRequisition, type PurchaseRequisition } from '../../../apps/kuaizhizao/services/purchase-requisition';

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
  const [detail, setDetail] = useState<PurchaseRequisition | null>(null);
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
      setDetail(await getPurchaseRequisition(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('app.kuaizhizao.purchaseRequisition.detailFailed');
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

  return (
    <PurchaseRequisitionDetailDrawer
      open={open}
      onClose={onClose}
      requisition={detail}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
