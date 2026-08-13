/**
 * 关联单据：需求计划原版详情（只取数 + DemandDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { DemandDetailDrawer } from '../../../apps/kuaizhizao/pages/plan-management/demand-management/components/DemandDetailDrawer';
import { getDemand, type Demand } from '../../../apps/kuaizhizao/services/demand';

export type DemandLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function DemandLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: DemandLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<Demand | null>(null);
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
      setDetail(await getDemand(documentId, true, false));
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('app.kuaizhizao.demandManagement.detailFailed');
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
    <DemandDetailDrawer
      open={open}
      onClose={onClose}
      demand={detail}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
