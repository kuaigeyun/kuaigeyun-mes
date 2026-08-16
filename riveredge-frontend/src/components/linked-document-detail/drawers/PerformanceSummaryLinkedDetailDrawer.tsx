/**
 * 关联单据：绩效汇总原版详情（只取数 + PerformanceSummaryDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PerformanceSummaryDetailDrawer } from '../../../apps/kuaizhizao/pages/performance/summaries/components/PerformanceSummaryDetailDrawer';
import { employeePerformanceApi } from '../../../apps/kuaizhizao/services/performance';
import type { PerformanceDetail } from '../../../apps/kuaizhizao/types/performance';
import { useDocumentTracking } from '../../document-tracking-panel/useDocumentTracking';

export type PerformanceSummaryLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function PerformanceSummaryLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PerformanceSummaryLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tracking = useDocumentTracking(
    open && trackingId != null ? 'performance_summary' : undefined,
    trackingId ?? undefined,
    refreshKey,
  );

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setLoadError(null);
      setTrackingId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    try {
      const summary = await employeePerformanceApi.getSummary(documentId);
      const next = await employeePerformanceApi.getDetail({
        period: summary.period,
        employee_id: summary.employee_id,
      });
      setDetail(next);
      setTrackingId(summary.id);
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('common.loadFailed');
      setDetail(null);
      setTrackingId(null);
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PerformanceSummaryDetailDrawer
      open={open}
      onClose={onClose}
      record={detail}
      loading={loading}
      error={loadError}
      onRetry={() => void load()}
      zIndex={zIndex}
      trackingId={trackingId}
      tracking={tracking}
      navigate={navigate}
    />
  );
}
