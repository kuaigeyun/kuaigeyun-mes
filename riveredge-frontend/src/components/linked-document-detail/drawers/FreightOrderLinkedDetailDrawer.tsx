/**
 * 关联单据：货运单原版详情（只取数 + FreightOrderDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { FreightOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/logistics-management/freight-orders/components/FreightOrderDetailDrawer';
import { getFreightOrder, type FreightOrder } from '../../../apps/kuaizhizao/services/logistics';
import { getApiErrorMessage } from '../../../utils/errorHandler';

export type FreightOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function FreightOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: FreightOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [order, setOrder] = useState<FreightOrder | null>(null);
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
      setOrder(await getFreightOrder(documentId));
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, t('app.kuaizhizao.logistics.message.loadDetailFailed'));
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
    <FreightOrderDetailDrawer
      open={open}
      onClose={onClose}
      order={order}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
    />
  );
}
