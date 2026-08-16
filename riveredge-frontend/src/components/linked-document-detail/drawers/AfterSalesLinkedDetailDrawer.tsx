/**
 * 关联单据：售后原版详情（只取数 + 已有售后抽屉）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { AfterSalesTicketDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/tickets/components/AfterSalesTicketDetailDrawer';
import { InstallExecutionDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/install-execution/components/InstallExecutionDetailDrawer';
import { ServiceAssetDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/service-assets/components/ServiceAssetDetailDrawer';
import { RepairOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/repair-orders/components/RepairOrderDetailDrawer';
import { DispatchOrderDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/dispatch-orders/components/DispatchOrderDetailDrawer';
import { SparePartRequisitionDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/spare-part-requisitions/components/SparePartRequisitionDetailDrawer';
import { ServiceSettlementDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/service-settlements/components/ServiceSettlementDetailDrawer';
import { CustomerReturnVisitDetailDrawer } from '../../../apps/kuaizhizao/pages/after-sales-service/return-visits/components/CustomerReturnVisitDetailDrawer';
import { afterSalesTicketApi, type AfterSalesTicket } from '../../../apps/kuaizhizao/services/after-sales-ticket';
import { installExecutionApi, type InstallExecution } from '../../../apps/kuaizhizao/services/install-execution';
import {
  afterSalesSparePartRequisitionApi,
  customerReturnVisitApi,
  repairOrderApi,
  serviceAssetApi,
  serviceDispatchApi,
  serviceSettlementApi,
  type AfterSalesSparePartRequisition,
  type CustomerReturnVisit,
  type RepairOrder,
  type ServiceAsset,
  type ServiceDispatchOrder,
  type ServiceSettlement,
} from '../../../apps/kuaizhizao/services/after-sales-service';
import { getApiErrorMessage } from '../../../utils/errorHandler';

export type AfterSalesLinkedDetailDrawerProps = {
  open: boolean;
  documentType: string;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

type AfterSalesRecord =
  | AfterSalesTicket
  | InstallExecution
  | ServiceAsset
  | RepairOrder
  | ServiceDispatchOrder
  | AfterSalesSparePartRequisition
  | ServiceSettlement
  | CustomerReturnVisit;

async function loadAfterSalesRecord(
  documentType: string,
  documentId: number,
): Promise<AfterSalesRecord> {
  switch (documentType) {
    case 'after_sales_ticket':
      return afterSalesTicketApi.get(documentId);
    case 'install_execution':
      return installExecutionApi.get(documentId);
    case 'service_asset':
      return serviceAssetApi.get(documentId);
    case 'repair_order':
      return repairOrderApi.get(documentId);
    case 'service_dispatch':
      return serviceDispatchApi.get(documentId);
    case 'spare_part_requisition':
      return afterSalesSparePartRequisitionApi.get(documentId);
    case 'service_settlement':
      return serviceSettlementApi.get(documentId);
    case 'customer_return_visit':
      return customerReturnVisitApi.get(documentId);
    default:
      throw new Error(`Unsupported after-sales document type: ${documentType}`);
  }
}

export function AfterSalesLinkedDetailDrawer({
  open,
  documentType,
  documentId,
  onClose,
  zIndex,
}: AfterSalesLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [record, setRecord] = useState<AfterSalesRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setRecord(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setRecord((prev) => (prev && 'id' in prev && prev.id === documentId ? prev : null));
    try {
      setRecord(await loadAfterSalesRecord(documentType, documentId));
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, t('app.kuaizhizao.afterSalesService.detail.loadFailed'));
      setRecord(null);
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [documentId, documentType, message, open, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const shared = {
    open,
    onClose,
    loading,
    error: loadError,
    onRetry: () => setRefreshKey((k) => k + 1),
    zIndex,
  };

  switch (documentType) {
    case 'after_sales_ticket':
      return (
        <AfterSalesTicketDetailDrawer
          {...shared}
          record={record as AfterSalesTicket | null}
        />
      );
    case 'install_execution':
      return (
        <InstallExecutionDetailDrawer
          {...shared}
          record={record as InstallExecution | null}
        />
      );
    case 'service_asset':
      return (
        <ServiceAssetDetailDrawer {...shared} record={record as ServiceAsset | null} />
      );
    case 'repair_order':
      return (
        <RepairOrderDetailDrawer {...shared} record={record as RepairOrder | null} />
      );
    case 'service_dispatch':
      return (
        <DispatchOrderDetailDrawer
          {...shared}
          record={record as ServiceDispatchOrder | null}
        />
      );
    case 'spare_part_requisition':
      return (
        <SparePartRequisitionDetailDrawer
          {...shared}
          record={record as AfterSalesSparePartRequisition | null}
        />
      );
    case 'service_settlement':
      return (
        <ServiceSettlementDetailDrawer
          {...shared}
          record={record as ServiceSettlement | null}
        />
      );
    case 'customer_return_visit':
      return (
        <CustomerReturnVisitDetailDrawer
          {...shared}
          record={record as CustomerReturnVisit | null}
        />
      );
    default:
      return null;
  }
}
