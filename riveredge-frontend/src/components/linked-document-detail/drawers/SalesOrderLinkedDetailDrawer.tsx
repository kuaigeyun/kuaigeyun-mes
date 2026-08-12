/**
 * 关联单据：销售订单原版详情（自取数 + SalesOrderDetailDrawer 插槽壳）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { SalesOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/sales-management/sales-orders/components/SalesOrderDetailDrawer';
import { getSalesOrder, type SalesOrder } from '../../../apps/kuaizhizao/services/sales-order';
import { useAuditRequired } from '../../../hooks/useAuditRequired';

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
  const { message } = App.useApp();
  const auditRequired = useAuditRequired('kuaizhizao:sales-order');
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOrder(null);
    try {
      const data = await getSalesOrder(documentId, true, true);
      setOrder(data);
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string };
      message.error(err?.message || err?.detail || t('app.kuaizhizao.quotation.loadSalesOrderFailed'));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, onClose, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <SalesOrderDetailDrawer
      open={open}
      onClose={onClose}
      order={order}
      loading={loading}
      zIndex={zIndex}
      auditRequired={auditRequired}
      trackingRefreshKey={refreshKey}
      onWorkflowSuccess={() => {
        setRefreshKey((k) => k + 1);
      }}
    />
  );
}
