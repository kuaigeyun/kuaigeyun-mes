/**
 * 关联单据：需求计算原版详情（只取数 + DemandComputationDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { DemandComputationDetailDrawer } from '../../../apps/kuaizhizao/pages/plan-management/demand-computation/components/DemandComputationDetailDrawer';
import {
  getDemandComputation,
  type DemandComputation,
} from '../../../apps/kuaizhizao/services/demand-computation';

export type DemandComputationLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function DemandComputationLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: DemandComputationLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<DemandComputation | null>(null);
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
      setDetail(await getDemandComputation(documentId, true));
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
    <DemandComputationDetailDrawer
      open={open}
      onClose={onClose}
      computation={detail}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
    />
  );
}
