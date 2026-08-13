/**
 * 关联单据：采购订单原版详情（只取数 + PurchaseOrderDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { PurchaseOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/purchase-management/purchase-orders/components/PurchaseOrderDetailDrawer';
import { getPurchaseOrder, type PurchaseOrder } from '../../../apps/kuaizhizao/services/purchase';

export type PurchaseOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function PurchaseOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PurchaseOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setOrder(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setOrder((prev) => (prev?.id === documentId ? prev : null));
    try {
      setOrder(await getPurchaseOrder(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('app.kuaizhizao.purchaseOrder.detailFailed');
      setOrder(null);
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
    <PurchaseOrderDetailDrawer
      open={open}
      onClose={onClose}
      order={order}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
