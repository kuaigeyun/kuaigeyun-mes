/**
 * 关联单据：采购入库单原版详情（只取数 + InboundDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  InboundDetailDrawer,
  type InboundDetailRecord,
} from '../../../apps/kuaizhizao/pages/warehouse-management/inbound/components/InboundDetailDrawer';
import { normalizeInboundHubDetail } from '../../../apps/kuaizhizao/pages/warehouse-management/inbound/inboundHubNormalize';
import { warehouseApi } from '../../../apps/kuaizhizao/services/production';

export type PurchaseReceiptLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function PurchaseReceiptLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PurchaseReceiptLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [order, setOrder] = useState<InboundDetailRecord | null>(null);
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
      const raw = (await warehouseApi.purchaseReceipt.get(String(documentId))) as Record<string, unknown>;
      setOrder(normalizeInboundHubDetail('purchase', raw) as InboundDetailRecord);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg =
        err?.message || err?.detail || t('app.kuaizhizao.warehouseInbound.msg.loadDetailFailed');
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
    <InboundDetailDrawer
      open={open}
      onClose={onClose}
      order={order}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
    />
  );
}
