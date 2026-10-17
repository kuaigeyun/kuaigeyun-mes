/**
 * 关联单据详情抽屉（当前页嵌套打开，不跳转列表）。
 * 唯一入口：openLinkedDocumentDetail(type, id, options?)。
 * 内容：各单据原版 DetailDrawerTemplate 插槽壳（禁止 Brief / plainBody 另写）。
 */

import React, { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react';
import type { DrawerProps } from 'antd';
import { Spin, theme } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  canOpenLinkedDocumentDetail,
  normalizeLinkedDocumentType,
} from '../../apps/kuaizhizao/utils/linkedDocumentDetail';
import { DetailDrawerChromeProvider } from '../layout-templates';

const SalesOrderLinkedDetailDrawer = lazy(() =>
  import('./drawers/SalesOrderLinkedDetailDrawer').then((m) => ({ default: m.SalesOrderLinkedDetailDrawer })),
);
const PurchaseOrderLinkedDetailDrawer = lazy(() =>
  import('./drawers/PurchaseOrderLinkedDetailDrawer').then((m) => ({ default: m.PurchaseOrderLinkedDetailDrawer })),
);
const QuotationLinkedDetailDrawer = lazy(() =>
  import('./drawers/QuotationLinkedDetailDrawer').then((m) => ({ default: m.QuotationLinkedDetailDrawer })),
);
const SalesDeliveryLinkedDetailDrawer = lazy(() =>
  import('./drawers/SalesDeliveryLinkedDetailDrawer').then((m) => ({ default: m.SalesDeliveryLinkedDetailDrawer })),
);
const PurchaseReceiptLinkedDetailDrawer = lazy(() =>
  import('./drawers/PurchaseReceiptLinkedDetailDrawer').then((m) => ({
    default: m.PurchaseReceiptLinkedDetailDrawer,
  })),
);
const SalesForecastLinkedDetailDrawer = lazy(() =>
  import('./drawers/SalesForecastLinkedDetailDrawer').then((m) => ({ default: m.SalesForecastLinkedDetailDrawer })),
);
const DemandLinkedDetailDrawer = lazy(() =>
  import('./drawers/DemandLinkedDetailDrawer').then((m) => ({ default: m.DemandLinkedDetailDrawer })),
);
const PurchaseRequisitionLinkedDetailDrawer = lazy(() =>
  import('./drawers/PurchaseRequisitionLinkedDetailDrawer').then((m) => ({
    default: m.PurchaseRequisitionLinkedDetailDrawer,
  })),
);
const DemandComputationLinkedDetailDrawer = lazy(() =>
  import('./drawers/DemandComputationLinkedDetailDrawer').then((m) => ({
    default: m.DemandComputationLinkedDetailDrawer,
  })),
);
const WorkOrderLinkedDetailDrawer = lazy(() =>
  import('./drawers/WorkOrderLinkedDetailDrawer').then((m) => ({ default: m.WorkOrderLinkedDetailDrawer })),
);
const FreightOrderLinkedDetailDrawer = lazy(() =>
  import('./drawers/FreightOrderLinkedDetailDrawer').then((m) => ({ default: m.FreightOrderLinkedDetailDrawer })),
);
const ReportingRecordLinkedDetailDrawer = lazy(() =>
  import('./drawers/ReportingRecordLinkedDetailDrawer').then((m) => ({
    default: m.ReportingRecordLinkedDetailDrawer,
  })),
);
const PerformanceSummaryLinkedDetailDrawer = lazy(() =>
  import('./drawers/PerformanceSummaryLinkedDetailDrawer').then((m) => ({
    default: m.PerformanceSummaryLinkedDetailDrawer,
  })),
);
const AfterSalesLinkedDetailDrawer = lazy(() =>
  import('./drawers/AfterSalesLinkedDetailDrawer').then((m) => ({ default: m.AfterSalesLinkedDetailDrawer })),
);
const DeliveryNoticeLinkedDetailDrawer = lazy(() =>
  import('./drawers/DeliveryNoticeLinkedDetailDrawer').then((m) => ({ default: m.DeliveryNoticeLinkedDetailDrawer })),
);
const HubOutboundLinkedDetailDrawer = lazy(() =>
  import('./drawers/HubOutboundLinkedDetailDrawer').then((m) => ({ default: m.HubOutboundLinkedDetailDrawer })),
);
const HubInboundLinkedDetailDrawer = lazy(() =>
  import('./drawers/HubInboundLinkedDetailDrawer').then((m) => ({ default: m.HubInboundLinkedDetailDrawer })),
);
const QualityInspectionLinkedDetailDrawer = lazy(() =>
  import('./drawers/QualityInspectionLinkedDetailDrawer').then((m) => ({
    default: m.QualityInspectionLinkedDetailDrawer,
  })),
);
const ShipmentNoticeLinkedDetailDrawer = lazy(() =>
  import('./drawers/ShipmentNoticeLinkedDetailDrawer').then((m) => ({ default: m.ShipmentNoticeLinkedDetailDrawer })),
);
const ReceiptNoticeLinkedDetailDrawer = lazy(() =>
  import('./drawers/ReceiptNoticeLinkedDetailDrawer').then((m) => ({ default: m.ReceiptNoticeLinkedDetailDrawer })),
);
const SalesContractLinkedDetailDrawer = lazy(() =>
  import('./drawers/SalesContractLinkedDetailDrawer').then((m) => ({ default: m.SalesContractLinkedDetailDrawer })),
);
const ReworkOrderLinkedDetailDrawer = lazy(() =>
  import('./drawers/ReworkOrderLinkedDetailDrawer').then((m) => ({ default: m.ReworkOrderLinkedDetailDrawer })),
);
const PaymentLinkedDetailDrawer = lazy(() =>
  import('./drawers/PaymentLinkedDetailDrawer').then((m) => ({ default: m.PaymentLinkedDetailDrawer })),
);

/** 高于列表详情抽屉、报价内嵌关联，以及在线消息壳（z-index 1050） */
const LINKED_DRAWER_Z_OFFSET = 80;
/** 在线消息右下角壳层，关联抽屉须压过它 */
const UNI_IM_SHELL_Z_INDEX = 1050;

export type OpenLinkedDocumentDetailOptions = {
  /** 停靠侧；在线消息等从右侧浮层打开时传 left，避免挡住聊天窗 */
  placement?: DrawerProps['placement'];
};

type OpenFn = (
  documentType: string,
  documentId: number,
  options?: OpenLinkedDocumentDetailOptions,
) => boolean;

type CtxValue = {
  openLinkedDocumentDetail: OpenFn;
};

const LinkedDocumentDetailContext = createContext<CtxValue | null>(null);

export function useLinkedDocumentDetail(): CtxValue {
  const ctx = useContext(LinkedDocumentDetailContext);
  if (!ctx) {
    throw new Error('useLinkedDocumentDetail must be used within LinkedDocumentDetailProvider');
  }
  return ctx;
}

/** 无 Provider 时不抛错（如单测）；有则打开抽屉 */
export function useOptionalLinkedDocumentDetail(): CtxValue | null {
  return useContext(LinkedDocumentDetailContext);
}

type Target = {
  documentType: string;
  documentId: number;
  placement?: DrawerProps['placement'];
};

function LinkedDocumentDetailHost({
  target,
  onClose,
}: {
  target: Target | null;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const zIndex = Math.max(
    token.zIndexPopupBase + LINKED_DRAWER_Z_OFFSET,
    UNI_IM_SHELL_Z_INDEX + 10,
  );
  const open = Boolean(target);
  const documentType = target?.documentType ?? '';
  const documentId = target?.documentId ?? 0;
  const chrome = useMemo(
    () => ({
      placement: target?.placement ?? 'right',
      zIndex,
    }),
    [target?.placement, zIndex],
  );

  if (!open || documentId <= 0) return null;

  let drawer: React.ReactNode = null;
  switch (documentType) {
    case 'sales_order':
      drawer = (
        <SalesOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'purchase_order':
      drawer = (
        <PurchaseOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'quotation':
      drawer = (
        <QuotationLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'sales_delivery':
      drawer = (
        <SalesDeliveryLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'purchase_receipt':
      drawer = (
        <PurchaseReceiptLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'sales_forecast':
      drawer = (
        <SalesForecastLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'demand':
      drawer = (
        <DemandLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'purchase_requisition':
      drawer = (
        <PurchaseRequisitionLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'demand_computation':
      drawer = (
        <DemandComputationLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'work_order':
      drawer = (
        <WorkOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'freight_order':
      drawer = (
        <FreightOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'delivery_notice':
      drawer = (
        <DeliveryNoticeLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'shipment_notice':
      drawer = (
        <ShipmentNoticeLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'sales_contract':
      drawer = (
        <SalesContractLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'receipt_notice':
      drawer = (
        <ReceiptNoticeLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'rework_order':
      drawer = (
        <ReworkOrderLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'production_picking':
    case 'outsource_issue':
    case 'purchase_return':
      drawer = (
        <HubOutboundLinkedDetailDrawer
          open
          documentType={documentType}
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'finished_goods_receipt':
    case 'production_return':
    case 'sales_return':
    case 'outsource_receipt':
    case 'outsource_material_return':
    case 'outsource_product_return':
      drawer = (
        <HubInboundLinkedDetailDrawer
          open
          documentType={documentType}
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'incoming_inspection':
    case 'finished_goods_inspection':
      drawer = (
        <QualityInspectionLinkedDetailDrawer
          open
          documentType={documentType}
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'reporting_record':
      drawer = (
        <ReportingRecordLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'performance_summary':
      drawer = (
        <PerformanceSummaryLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'payment':
      drawer = (
        <PaymentLinkedDetailDrawer
          open
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    case 'after_sales_ticket':
    case 'install_execution':
    case 'service_asset':
    case 'repair_order':
    case 'service_dispatch':
    case 'spare_part_requisition':
    case 'service_settlement':
    case 'customer_return_visit':
      drawer = (
        <AfterSalesLinkedDetailDrawer
          open
          documentType={documentType}
          documentId={documentId}
          onClose={onClose}
          zIndex={zIndex}
        />
      );
      break;
    default:
      return null;
  }

  return (
    <DetailDrawerChromeProvider value={chrome}>
      <Suspense
        fallback={
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Spin size="large" />
          </div>
        }
      >
        {drawer}
      </Suspense>
    </DetailDrawerChromeProvider>
  );
}

export function LinkedDocumentDetailProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState<Target | null>(null);

  const openLinkedDocumentDetail = useCallback<OpenFn>(
    (documentType, documentId, options) => {
      const type = normalizeLinkedDocumentType(documentType);
      const id = Number(documentId);
      if (!canOpenLinkedDocumentDetail(type) || !Number.isFinite(id) || id <= 0) return false;
      if (type === 'delivery_project') {
        navigate(`/apps/kuaizhizao/delivery-project/projects/${id}`);
        return true;
      }
      setTarget({
        documentType: type,
        documentId: id,
        placement: options?.placement,
      });
      return true;
    },
    [navigate],
  );

  const onClose = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ openLinkedDocumentDetail }), [openLinkedDocumentDetail]);

  return (
    <LinkedDocumentDetailContext.Provider value={value}>
      {children}
      <LinkedDocumentDetailHost target={target} onClose={onClose} />
    </LinkedDocumentDetailContext.Provider>
  );
}

/** 供非 React 点击处复用：优先抽屉，无 Provider 时返回 false */
export function openLinkedDocumentDetailOrFalse(
  ctx: CtxValue | null,
  documentType: string,
  documentId: number,
  options?: OpenLinkedDocumentDetailOptions,
): boolean {
  if (!ctx) return false;
  return ctx.openLinkedDocumentDetail(documentType, documentId, options);
}
