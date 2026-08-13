/**
 * 关联单据：生产工单原版详情（只取数 + WorkOrderDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  WorkOrderDetailDrawer,
  type WorkOrderDetailRecord,
} from '../../../apps/kuaizhizao/pages/production-execution/work-orders/components/WorkOrderDetailDrawer';
import { workOrderApi } from '../../../apps/kuaizhizao/services/work-order';

export type WorkOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

function asOperations(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)) {
    return (raw as { items: unknown[] }).items;
  }
  return [];
}

export function WorkOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: WorkOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [detail, setDetail] = useState<WorkOrderDetailRecord | null>(null);
  const [operations, setOperations] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setOperations([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDetail((prev) => (prev?.id === documentId ? prev : null));
    try {
      const wo = (await workOrderApi.get(String(documentId))) as WorkOrderDetailRecord;
      const ops = asOperations(await workOrderApi.getOperations(String(documentId)));
      setDetail(wo);
      setOperations(ops);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      const msg = err?.message || err?.detail || t('common.loadFailed');
      setDetail(null);
      setOperations([]);
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
    <WorkOrderDetailDrawer
      open={open}
      onClose={onClose}
      workOrder={detail}
      operations={operations}
      operationsReadOnly
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
