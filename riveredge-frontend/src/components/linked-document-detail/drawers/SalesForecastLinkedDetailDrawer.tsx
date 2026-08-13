/**
 * 关联单据：销售预测原版详情（只取数 + SalesForecastDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { SalesForecastDetailDrawer } from '../../../apps/kuaizhizao/pages/sales-management/sales-forecasts/components/SalesForecastDetailDrawer';
import { getSalesForecast, type SalesForecast } from '../../../apps/kuaizhizao/services/sales-forecast';
import { useAuditRequired } from '../../../hooks/useAuditRequired';

export type SalesForecastLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function SalesForecastLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: SalesForecastLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const auditRequired = useAuditRequired('sales_forecast', false);
  const [detail, setDetail] = useState<SalesForecast | null>(null);
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
      setDetail(await getSalesForecast(documentId));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('common.loadFailed');
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
    <SalesForecastDetailDrawer
      open={open}
      onClose={onClose}
      forecast={detail}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      auditRequired={auditRequired}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
