/**
 * 关联单据：销售出库单原版详情（只取数 + OutboundDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  OutboundDetailDrawer,
  type OutboundDetailRecord,
} from '../../../apps/kuaizhizao/pages/warehouse-management/outbound/components/OutboundDetailDrawer';
import { warehouseApi } from '../../../apps/kuaizhizao/services/production';

export type SalesDeliveryLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function SalesDeliveryLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: SalesDeliveryLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [order, setOrder] = useState<OutboundDetailRecord | null>(null);
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
      const raw = (await warehouseApi.salesDelivery.get(String(documentId))) as OutboundDetailRecord;
      setOrder({ ...raw, outbound_type: 'sales_delivery' });
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg =
        err?.message || err?.detail || t('app.kuaizhizao.warehouseOutbound.msg.loadDetailFailed');
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
    <OutboundDetailDrawer
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
