/**
 * 关联单据：生产工单原版详情（只取数 + WorkOrderDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WorkOrderDetailDrawer,
  type WorkOrderDetailRecord,
} from '../../../apps/kuaizhizao/pages/production-execution/work-orders/components/WorkOrderDetailDrawer';
import { workOrderApi } from '../../../apps/kuaizhizao/services/work-order';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import { resolveLinkedDocumentLoadError } from '../../../utils/errorHandler';

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
  const workOrderPerms = useResourcePermissions('kuaizhizao:work-order');
  const showReadonlyActions =
    workOrderPerms.canPrint ||
    workOrderPerms.canUpdate ||
    workOrderPerms.canAction?.('submit') ||
    workOrderPerms.canAction?.('audit');
  const [detail, setDetail] = useState<WorkOrderDetailRecord | null>(null);
  const [operations, setOperations] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<'403' | 'error'>('error');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setDetail(null);
      setOperations([]);
      setLoadError(null);
      setLoadErrorStatus('error');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setLoadErrorStatus('error');
    setDetail((prev) => (prev?.id === documentId ? prev : null));
    try {
      const wo = (await workOrderApi.get(String(documentId))) as WorkOrderDetailRecord;
      const ops = asOperations(await workOrderApi.getOperations(String(documentId)));
      setDetail(wo);
      setOperations(ops);
    } catch (e: unknown) {
      const resolved = resolveLinkedDocumentLoadError(e, {
        fallback: t('common.loadFailed'),
        permissionMessage: t('components.linkedDocumentDetail.noPermission', {
          resource: t('components.linkedDocumentDetail.resource.workOrder'),
        }),
      });
      setDetail(null);
      setOperations([]);
      setLoadError(resolved.message);
      setLoadErrorStatus(resolved.status);
    } finally {
      setLoading(false);
    }
  }, [open, documentId, t]);

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
      errorStatus={loadErrorStatus}
      showReadonlyActions={Boolean(showReadonlyActions)}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => setRefreshKey((k) => k + 1)}
    />
  );
}
