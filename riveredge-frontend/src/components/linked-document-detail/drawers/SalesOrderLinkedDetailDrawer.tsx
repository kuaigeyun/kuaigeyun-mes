/**
 * 关联单据：销售订单原版详情（自取数 + SalesOrderDetailDrawer 插槽壳）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SalesOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/sales-management/sales-orders/components/SalesOrderDetailDrawer';
import { getSalesOrder, type SalesOrder } from '../../../apps/kuaizhizao/services/sales-order';
import { useAuditRequired } from '../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../hooks/useResourcePermissions';
import { resolveLinkedDocumentLoadError } from '../../../utils/errorHandler';

export type SalesOrderLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function SalesOrderLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: SalesOrderLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const auditRequired = useAuditRequired('kuaizhizao:sales-order');
  const salesOrderPerms = useResourcePermissions('kuaizhizao:sales-order');
  const showReadonlyActions =
    salesOrderPerms.canPrint ||
    salesOrderPerms.canUpdate ||
    salesOrderPerms.canAction?.('submit') ||
    salesOrderPerms.canAction?.('audit');
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorStatus, setLoadErrorStatus] = useState<'403' | 'error'>('error');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setOrder(null);
      setLoadError(null);
      setLoadErrorStatus('error');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setLoadErrorStatus('error');
    // 同单刷新时保留旧数据，避免壳层闪空；换单时再清空
    setOrder((prev) => (prev?.id === documentId ? prev : null));
    try {
      const data = await getSalesOrder(documentId, true, true);
      setOrder(data);
    } catch (e: unknown) {
      const resolved = resolveLinkedDocumentLoadError(e, {
        fallback: t('app.kuaizhizao.quotation.loadSalesOrderFailed'),
        permissionMessage: t('components.linkedDocumentDetail.noPermission', {
          resource: t('components.linkedDocumentDetail.resource.salesOrder'),
        }),
      });
      setOrder(null);
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
    <SalesOrderDetailDrawer
      open={open}
      onClose={onClose}
      order={order}
      loading={loading}
      error={loadError}
      errorStatus={loadErrorStatus}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      auditRequired={auditRequired}
      showReadonlyActions={Boolean(showReadonlyActions)}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => {
        setRefreshKey((k) => k + 1);
      }}
    />
  );
}
