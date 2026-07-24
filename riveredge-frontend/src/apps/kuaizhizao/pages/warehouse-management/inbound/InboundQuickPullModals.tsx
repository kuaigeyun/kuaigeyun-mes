import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Empty, Form, Modal, Select, Spin, Table, Tag, Typography } from 'antd';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  listPurchaseReceiptPullCandidates,
  previewPushToReceipt,
  type DocumentPushPreview,
} from '../../../services/purchase';
import {
  formatPullPercent,
  renderLifecycleSubStageTag,
} from './inboundPullModalUtils';
import { formatQuantity } from '../../../../../utils/format';
import { listSalesOrders, previewPushSalesOrderToSalesReturn, type PushPreviewResponse } from '../../../services/sales-order';
import {
  receiptNoticeApi,
  type ReceiptNotice,
  type ReceiptNoticeNotifyPreviewResponse,
} from '../../../services/receipt-notice';
import { warehouseApi } from '../../../services/warehouse-execution';
import {
  workOrderApi,
  outsourceWorkOrderApi,
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import { type InboundOutsourcePullType } from './inboundCreateConfig';

type OutsourceInboundCapabilityKey =
  | 'push_outsource_receipt'
  | 'push_outsource_material_return'
  | 'push_outsource_product_return';

function inboundOutsourceCapabilityKey(pullType: InboundOutsourcePullType): OutsourceInboundCapabilityKey {
  if (pullType === 'outsource_material_return') return 'push_outsource_material_return';
  if (pullType === 'outsource_product_return') return 'push_outsource_product_return';
  return 'push_outsource_receipt';
}

function inboundOutsourcePreviewLineKey(pullType: InboundOutsourcePullType, itemId: number): string {
  if (pullType === 'outsource_material_return') return `issue-${itemId}`;
  if (pullType === 'outsource_product_return') return `receipt-${itemId}`;
  return String(itemId);
}
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import {
  inboundOutsourceEntryPath,
  inboundPoEntryPath,
  inboundProductionReturnEntryPath,
  inboundSalesReturnEntryPath,
  inboundWorkOrderEntryPath,
} from './inboundPaths';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  purchaseOrderCapabilityReasonMessage,
  receiptNoticeCapabilityReasonMessage,
  salesOrderCapabilityReasonMessage,
  workOrderCapabilityReasonMessage,
  outsourceWorkOrderCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  buildDocumentCreateDraftKey,
  setDocumentFormDraft,
} from '../../../../../utils/documentFormDraftCache';

export type {
  InboundPullDirectConfirmTarget,
  PurchaseReceiptEntryHandoff,
} from './inboundPullEntryTypes';

export type InboundQuickPullKey =
  | 'purchase_order'
  | 'receipt_notice'
  | 'work_order'
  | 'production_return'
  | 'sales_return'
  | 'outsource';

export type InboundQuickPullModalsRef = {
  open: (key: InboundQuickPullKey) => void;
};

type PullReceiptNoticeCandidate = ReceiptNotice & {
  id: number;
};

type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
  total_quantity?: number;
  delivery_progress?: number | null;
  capabilities?: {
    push_sales_return?: { allowed?: boolean; reason?: string | null };
  };
};

type PullPurchaseOrderCandidate = {
  id: number;
  order_code?: string;
  supplier_name?: string;
  status?: string;
  order_date?: string;
  delivery_date?: string;
  items_count?: number;
  total_quantity?: number;
  ordered_total?: number;
  received_total?: number;
  outstanding_total?: number;
  lifecycle?: {
    current_stage_name?: string;
    sub_stages?: Array<{ key: string; label: string; status: string }>;
  };
  capabilities?: {
    push_receipt?: { allowed?: boolean; reason?: string | null };
  };
};

type PullWorkOrderCandidate = {
  id: number;
  code?: string;
  product_name?: string;
  sales_order_code?: string;
  status?: string;
  quantity?: number;
  completed_quantity?: number;
  updated_at?: string;
  capabilities?: {
    push_finished_goods_receipt?: { allowed?: boolean; reason?: string | null };
    push_production_return?: { allowed?: boolean; reason?: string | null };
  };
};

type ProductionReturnPreviewPicking = {
  picking_id: number;
  picking_code: string;
  status: string;
  lines: Array<{
    picking_item_id?: number;
    material_id?: number;
    material_code?: string;
    material_name?: string;
    source_doc_quantity?: number;
    source_received_quantity?: number;
    source_pending_quantity?: number;
  }>;
};

type ProductionReturnPreviewResponse = {
  work_order_id: number;
  work_order_code: string;
  pickings: ProductionReturnPreviewPicking[];
  message?: string | null;
};

type PullOutsourceWoCandidate = {
  id: number;
  code?: string;
  product_name?: string;
  supplier_name?: string;
  status?: string;
  quantity?: number;
  received_quantity?: number;
  issued_quantity?: number;
  updated_at?: string;
  capabilities?: {
    push_outsource_receipt?: { allowed?: boolean; reason?: string | null };
    push_outsource_material_return?: { allowed?: boolean; reason?: string | null };
    push_outsource_product_return?: { allowed?: boolean; reason?: string | null };
  };
};

type InboundQuickPullModalsProps = {
  onSuccess: () => void;
};

const InboundQuickPullModals = forwardRef<InboundQuickPullModalsRef, InboundQuickPullModalsProps>(
  ({ onSuccess }, ref) => {
    const { t } = useTranslation();
    const { message: messageApi } = App.useApp();
    const navigate = useNavigate();
    const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_purchase_order');
    const pullFromReceiptNoticeAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_receipt_notice');
    const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order');
    const pullFromProductionReturnAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order_for_production_return');
    const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_sales_order');
    const pullFromOutsourceWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_outsource_work_order');

    const [outsourcePullType, setOutsourcePullType] = useState<InboundOutsourcePullType>('outsource_receipt');

    const pullPoQueryCloseRef = useRef<(() => void) | null>(null);
    const pullRnQueryCloseRef = useRef<(() => void) | null>(null);
    const pullWoQueryCloseRef = useRef<(() => void) | null>(null);
    const pullPrQueryCloseRef = useRef<(() => void) | null>(null);
    const pullSrQueryCloseRef = useRef<(() => void) | null>(null);
    const pullOibQueryCloseRef = useRef<(() => void) | null>(null);
    const outsourcePullTypeRef = useRef<InboundOutsourcePullType>('outsource_receipt');
    const [pullPoPreviewOpen, setPullPoPreviewOpen] = useState(false);
    const [pullPoPreviewLoading, setPullPoPreviewLoading] = useState(false);
    const [pullPoPreviewConfirming, setPullPoPreviewConfirming] = useState(false);
    const [pullPoPreviewData, setPullPoPreviewData] = useState<DocumentPushPreview | null>(null);
    const [pullPoPreviewOrderId, setPullPoPreviewOrderId] = useState<number | null>(null);
    const [pullPoSelectedItemIds, setPullPoSelectedItemIds] = useState<number[]>([]);
    const [pullRnPreviewOpen, setPullRnPreviewOpen] = useState(false);
    const [pullRnPreviewLoading, setPullRnPreviewLoading] = useState(false);
    const [pullRnPreviewConfirming, setPullRnPreviewConfirming] = useState(false);
    const [pullRnPreviewData, setPullRnPreviewData] = useState<ReceiptNoticeNotifyPreviewResponse | null>(null);
    const [pullRnPreviewTarget, setPullRnPreviewTarget] = useState<ReceiptNotice | null>(null);
    const [pullWoPreviewOpen, setPullWoPreviewOpen] = useState(false);
    const [pullWoPreviewLoading, setPullWoPreviewLoading] = useState(false);
    const [pullWoPreviewData, setPullWoPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullWoPreviewWorkOrderId, setPullWoPreviewWorkOrderId] = useState<number | null>(null);
    const [pullPrPreviewOpen, setPullPrPreviewOpen] = useState(false);
    const [pullPrPreviewLoading, setPullPrPreviewLoading] = useState(false);
    const [pullPrPreviewConfirming, setPullPrPreviewConfirming] = useState(false);
    const [pullPrPreviewData, setPullPrPreviewData] = useState<ProductionReturnPreviewResponse | null>(null);
    const [pullPrPreviewWorkOrderId, setPullPrPreviewWorkOrderId] = useState<number | null>(null);
    const [pullPrPreviewPickingId, setPullPrPreviewPickingId] = useState<number | null>(null);
    const [pullPrSelectedItemIds, setPullPrSelectedItemIds] = useState<number[]>([]);
    const [pullSrPreviewOpen, setPullSrPreviewOpen] = useState(false);
    const [pullSrPreviewLoading, setPullSrPreviewLoading] = useState(false);
    const [pullSrPreviewConfirming, setPullSrPreviewConfirming] = useState(false);
    const [pullSrPreviewData, setPullSrPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullSrPreviewOrderId, setPullSrPreviewOrderId] = useState<number | null>(null);
    const [pullSrSelectedItemIds, setPullSrSelectedItemIds] = useState<number[]>([]);
    const [pullOibPreviewOpen, setPullOibPreviewOpen] = useState(false);
    const [pullOibPreviewLoading, setPullOibPreviewLoading] = useState(false);
    const [pullOibPreviewConfirming, setPullOibPreviewConfirming] = useState(false);
    const [pullOibPreviewData, setPullOibPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullOibPreviewWorkOrderId, setPullOibPreviewWorkOrderId] = useState<number | null>(null);
    const [pullOibPreviewPullType, setPullOibPreviewPullType] = useState<InboundOutsourcePullType>('outsource_receipt');
    const [pullOibSelectedItemIds, setPullOibSelectedItemIds] = useState<number[]>([]);

    const resetPullOibPreviewModal = useCallback(() => {
      setPullOibPreviewOpen(false);
      setPullOibPreviewData(null);
      setPullOibPreviewWorkOrderId(null);
      setPullOibSelectedItemIds([]);
    }, []);

    const resetPullWoPreviewModal = useCallback(() => {
      setPullWoPreviewOpen(false);
      setPullWoPreviewData(null);
      setPullWoPreviewWorkOrderId(null);
    }, []);

    const resetPullPrPreviewModal = useCallback(() => {
      setPullPrPreviewOpen(false);
      setPullPrPreviewData(null);
      setPullPrPreviewWorkOrderId(null);
      setPullPrPreviewPickingId(null);
      setPullPrSelectedItemIds([]);
    }, []);

    const resetPullSrPreviewModal = useCallback(() => {
      setPullSrPreviewOpen(false);
      setPullSrPreviewData(null);
      setPullSrPreviewOrderId(null);
      setPullSrSelectedItemIds([]);
    }, []);

    const resetPullPoPreviewModal = useCallback(() => {
      setPullPoPreviewOpen(false);
      setPullPoPreviewData(null);
      setPullPoPreviewOrderId(null);
      setPullPoSelectedItemIds([]);
    }, []);

    const resetPullRnPreviewModal = useCallback(() => {
      setPullRnPreviewOpen(false);
      setPullRnPreviewData(null);
      setPullRnPreviewTarget(null);
    }, []);

    const showPullPoPreview = useCallback(
      (orderId: number) => {
        pullPoQueryCloseRef.current?.();
        setPullPoPreviewOpen(true);
        setPullPoPreviewLoading(true);
        setPullPoPreviewConfirming(false);
        setPullPoPreviewData(null);
        setPullPoPreviewOrderId(orderId);
        setPullPoSelectedItemIds([]);
        previewPushToReceipt(orderId)
          .then((res) => {
            setPullPoPreviewData(res);
            setPullPoSelectedItemIds(
              (res.items || [])
                .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                .map((row) => Number(row.item_id)),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.po.previewFailed')));
            resetPullPoPreviewModal();
          })
          .finally(() => setPullPoPreviewLoading(false));
      },
      [messageApi, resetPullPoPreviewModal, t],
    );

    const handlePullPoPreviewConfirm = useCallback(async () => {
      if (!pullPoPreviewOrderId || !pullPoPreviewData) return;
      if (pullPoPreviewData.has_blocking_issues) return;
      const rowById = new Map(
        (pullPoPreviewData.items || []).map((row) => [Number(row.item_id), row]),
      );
      const selectedIds = pullPoSelectedItemIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.max_push_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectLinesFirst'));
        return;
      }
      const quantities: Record<number, number> = {};
      (pullPoPreviewData.items || []).forEach((row) => {
        quantities[Number(row.item_id)] = 0;
      });
      selectedIds.forEach((id) => {
        quantities[id] = Number(rowById.get(id)?.max_push_quantity ?? 0);
      });
      const entryPath = inboundPoEntryPath(pullPoPreviewOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-po-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { quantities });
      resetPullPoPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullPoPreviewData,
      pullPoPreviewOrderId,
      pullPoSelectedItemIds,
      resetPullPoPreviewModal,
      t,
    ]);

    const showPullRnPreview = useCallback(
      (notice: ReceiptNotice) => {
        if (!notice.id) return;
        pullRnQueryCloseRef.current?.();
        setPullRnPreviewOpen(true);
        setPullRnPreviewLoading(true);
        setPullRnPreviewConfirming(false);
        setPullRnPreviewData(null);
        setPullRnPreviewTarget(notice);
        receiptNoticeApi
          .previewNotify(String(notice.id))
          .then((res) => setPullRnPreviewData(res))
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.receiptNotice.notifyPreviewFailed')));
            resetPullRnPreviewModal();
          })
          .finally(() => setPullRnPreviewLoading(false));
      },
      [messageApi, resetPullRnPreviewModal, t],
    );

    const handlePullRnPreviewConfirm = useCallback(async () => {
      if (!pullRnPreviewTarget?.id || !pullRnPreviewData) return;
      if (pullRnPreviewData.has_blocking_issues) return;
      setPullRnPreviewConfirming(true);
      try {
        const res = (await receiptNoticeApi.notify(String(pullRnPreviewTarget.id))) as ReceiptNotice;
        messageApi.success(
          res?.purchase_receipt_code
            ? t('app.kuaizhizao.receiptNotice.notifySuccessWithDraft', { receiptCode: res.purchase_receipt_code })
            : t('app.kuaizhizao.receiptNotice.notifySuccess'),
        );
        resetPullRnPreviewModal();
        onSuccess();
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.notifyFailed')));
      } finally {
        setPullRnPreviewConfirming(false);
      }
    }, [messageApi, onSuccess, pullRnPreviewData, pullRnPreviewTarget, resetPullRnPreviewModal, t]);

    const mapWorkOrderInboundPreview = useCallback(
      (preview: {
        work_order_code?: string;
        lines?: Array<{
          material_id?: number;
          material_code?: string;
          material_name?: string;
          source_doc_quantity?: number | string;
          source_received_quantity?: number | string;
          source_pending_quantity?: number | string;
        }>;
        message?: string | null;
      }): PushPreviewResponse => {
        const items = (preview.lines ?? []).map((line) => ({
          item_id: Number(line.material_id),
          material_code: String(line.material_code ?? ''),
          material_name: String(line.material_name ?? ''),
          quantity: Number(line.source_doc_quantity ?? 0),
          pushed_quantity: Number(line.source_received_quantity ?? 0),
          max_push_quantity: Number(line.source_pending_quantity ?? 0),
        }));
        const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
        let blockingReason: string | null = null;
        if (!items.length || pushableCount === 0) {
          blockingReason = preview.message || t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewNoLines');
        }
        return {
          target_type: 'finished_goods_receipt',
          summary: t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewSummary', {
            code: preview.work_order_code ?? '',
            pushable: pushableCount,
            total: items.length,
          }),
          items,
          tip: t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewTip'),
          has_blocking_issues: !!blockingReason,
          blocking_reason: blockingReason,
        };
      },
      [t],
    );

    const showPullWoPreview = useCallback(
      (workOrderId: number) => {
        pullWoQueryCloseRef.current?.();
        setPullWoPreviewOpen(true);
        setPullWoPreviewLoading(true);
        setPullWoPreviewData(null);
        setPullWoPreviewWorkOrderId(workOrderId);
        warehouseApi.finishedGoodsReceipt
          .previewFromWorkOrder(workOrderId)
          .then((res) => setPullWoPreviewData(mapWorkOrderInboundPreview(res as Parameters<typeof mapWorkOrderInboundPreview>[0])))
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewFailed')));
            resetPullWoPreviewModal();
          })
          .finally(() => setPullWoPreviewLoading(false));
      },
      [mapWorkOrderInboundPreview, messageApi, resetPullWoPreviewModal, t],
    );

    const handlePullWoPreviewConfirm = useCallback(() => {
      if (!pullWoPreviewWorkOrderId || !pullWoPreviewData) return;
      if (pullWoPreviewData.has_blocking_issues) return;
      const firstLine = pullWoPreviewData.items?.[0];
      const receiptQty = Number(firstLine?.max_push_quantity ?? 0);
      const entryPath = inboundWorkOrderEntryPath(pullWoPreviewWorkOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-work-order-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { receiptQty });
      resetPullWoPreviewModal();
      navigate(entryPath);
    }, [navigate, pullWoPreviewData, pullWoPreviewWorkOrderId, resetPullWoPreviewModal]);

    const pullPrPreviewLines = useMemo(() => {
      if (!pullPrPreviewData || pullPrPreviewPickingId == null) return [];
      const picking = pullPrPreviewData.pickings.find((row) => row.picking_id === pullPrPreviewPickingId);
      return picking?.lines ?? [];
    }, [pullPrPreviewData, pullPrPreviewPickingId]);

    const pullPrPreviewBlocking = useMemo(() => {
      if (!pullPrPreviewData) return { has_blocking_issues: true, blocking_reason: null as string | null, summary: '' };
      const allLines = pullPrPreviewData.pickings.flatMap((picking) => picking.lines);
      const pushableCount = allLines.filter((line) => Number(line.source_pending_quantity ?? 0) > 0).length;
      let blockingReason: string | null = null;
      if (!pullPrPreviewData.pickings.length || pushableCount === 0) {
        blockingReason = pullPrPreviewData.message || t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewNoLines');
      }
      return {
        has_blocking_issues: !!blockingReason,
        blocking_reason: blockingReason,
        summary: t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewSummary', {
          code: pullPrPreviewData.work_order_code ?? '',
          pushable: pushableCount,
          total: allLines.length,
        }),
      };
    }, [pullPrPreviewData, t]);

    const showPullPrPreview = useCallback(
      (workOrderId: number) => {
        pullPrQueryCloseRef.current?.();
        setPullPrPreviewOpen(true);
        setPullPrPreviewLoading(true);
        setPullPrPreviewConfirming(false);
        setPullPrPreviewData(null);
        setPullPrPreviewWorkOrderId(workOrderId);
        setPullPrPreviewPickingId(null);
        setPullPrSelectedItemIds([]);
        warehouseApi.productionReturn
          .previewFromWorkOrder(workOrderId)
          .then((res) => {
            const raw = (res as ProductionReturnPreviewResponse);
            setPullPrPreviewData(raw);
            const firstPicking = (raw.pickings || []).find((picking) =>
              (picking.lines || []).some((line) => Number(line.source_pending_quantity ?? 0) > 0),
            );
            if (firstPicking) {
              setPullPrPreviewPickingId(firstPicking.picking_id);
              setPullPrSelectedItemIds(
                (firstPicking.lines || [])
                  .filter((line) => Number(line.source_pending_quantity ?? 0) > 0)
                  .map((line) => Number(line.picking_item_id)),
              );
            }
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewFailed')));
            resetPullPrPreviewModal();
          })
          .finally(() => setPullPrPreviewLoading(false));
      },
      [messageApi, resetPullPrPreviewModal, t],
    );

    const handlePullPrPreviewConfirm = useCallback(() => {
      if (!pullPrPreviewWorkOrderId || !pullPrPreviewData) return;
      if (pullPrPreviewBlocking.has_blocking_issues) return;
      if (!pullPrPreviewPickingId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.productionReturn.selectPickingFirst'));
        return;
      }
      const rowById = new Map(
        pullPrPreviewLines.map((line) => [Number(line.picking_item_id), line]),
      );
      const selectedIds = pullPrSelectedItemIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.source_pending_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.productionReturn.selectLinesFirst'));
        return;
      }
      const lineReturnQty: Record<number, number> = {};
      selectedIds.forEach((id) => {
        lineReturnQty[id] = Number(rowById.get(id)?.source_pending_quantity ?? 0);
      });
      const entryPath = inboundProductionReturnEntryPath(pullPrPreviewWorkOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-production-return-pull', entryPath, '');
      const picking = pullPrPreviewData.pickings.find((row) => row.picking_id === pullPrPreviewPickingId);
      setDocumentFormDraft(draftKey, {
        pickingId: pullPrPreviewPickingId,
        pickingCode: picking?.picking_code,
        lineReturnQty,
      });
      resetPullPrPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullPrPreviewBlocking.has_blocking_issues,
      pullPrPreviewData,
      pullPrPreviewLines,
      pullPrPreviewPickingId,
      pullPrPreviewWorkOrderId,
      pullPrSelectedItemIds,
      resetPullPrPreviewModal,
      t,
    ]);

    const showPullSrPreview = useCallback(
      (orderId: number) => {
        pullSrQueryCloseRef.current?.();
        setPullSrPreviewOpen(true);
        setPullSrPreviewLoading(true);
        setPullSrPreviewConfirming(false);
        setPullSrPreviewData(null);
        setPullSrPreviewOrderId(orderId);
        setPullSrSelectedItemIds([]);
        previewPushSalesOrderToSalesReturn(orderId)
          .then((res) => {
            setPullSrPreviewData(res);
            setPullSrSelectedItemIds(
              (res.items || [])
                .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                .map((row) => Number(row.item_id)),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.salesReturn.previewFailed')));
            resetPullSrPreviewModal();
          })
          .finally(() => setPullSrPreviewLoading(false));
      },
      [messageApi, resetPullSrPreviewModal, t],
    );

    const handlePullSrPreviewConfirm = useCallback(() => {
      if (!pullSrPreviewOrderId || !pullSrPreviewData) return;
      if (pullSrPreviewData.has_blocking_issues) return;
      const rowById = new Map(
        (pullSrPreviewData.items || []).map((row) => [Number(row.item_id), row]),
      );
      const selectedIds = pullSrSelectedItemIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.max_push_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.selectLinesFirst'));
        return;
      }
      const quantities: Record<number, number> = {};
      const maxQuantities: Record<number, number> = {};
      (pullSrPreviewData.items || []).forEach((row) => {
        const itemId = Number(row.item_id);
        quantities[itemId] = 0;
        maxQuantities[itemId] = Number(row.max_push_quantity ?? 0);
      });
      selectedIds.forEach((id) => {
        quantities[id] = Number(rowById.get(id)?.max_push_quantity ?? 0);
      });
      const entryPath = inboundSalesReturnEntryPath(pullSrPreviewOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-sales-return-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { quantities, maxQuantities });
      resetPullSrPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullSrPreviewData,
      pullSrPreviewOrderId,
      pullSrSelectedItemIds,
      resetPullSrPreviewModal,
      t,
    ]);

    const loadWorkOrderListPage = useCallback(async (keyword: string, page: number, pageSize: number) => {
      const res = await workOrderApi.list({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        keyword: keyword.trim() || undefined,
      });
      const list = Array.isArray(res)
        ? res
        : (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? [];
      const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
      const candidates = rows
        .filter((wo) => !wo.row_kind || wo.row_kind === 'work_order')
        .map((wo) => ({
          id: Number(wo.id),
          code: wo.code != null ? String(wo.code) : undefined,
          product_name: String(wo.product_name ?? wo.name ?? ''),
          sales_order_code: wo.sales_order_code != null ? String(wo.sales_order_code) : undefined,
          status: wo.status != null ? String(wo.status) : undefined,
          quantity: Number(wo.quantity ?? 0) || undefined,
          completed_quantity: Number(wo.completed_quantity ?? 0) || undefined,
          updated_at: wo.updated_at != null ? String(wo.updated_at) : undefined,
          capabilities: wo.capabilities as PullWorkOrderCandidate['capabilities'],
        }));
      const total = Number((res as { total?: number })?.total ?? candidates.length);
      return { data: candidates, total };
    }, []);

    const loadOutsourceWorkOrderListPage = useCallback(async (keyword: string, page: number, pageSize: number) => {
      const res = await outsourceWorkOrderApi.list({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        keyword: keyword.trim() || undefined,
      });
      const rows = Array.isArray(res)
        ? res
        : (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? [];
      const candidates = (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        code: r.code != null ? String(r.code) : undefined,
        product_name: String(r.product_name ?? r.productName ?? ''),
        supplier_name: r.supplier_name != null ? String(r.supplier_name) : undefined,
        status: r.status != null ? String(r.status) : undefined,
        quantity: Number(r.quantity ?? 0) || undefined,
        received_quantity: Number(r.received_quantity ?? 0) || undefined,
        issued_quantity: Number(r.issued_quantity ?? 0) || undefined,
        updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
        capabilities: r.capabilities as PullOutsourceWoCandidate['capabilities'],
      }));
      const total = Number((res as { total?: number })?.total ?? candidates.length);
      return { data: candidates, total };
    }, []);

    const mapOutsourceInboundPreview = useCallback(
      (
        pullType: InboundOutsourcePullType,
        preview: {
          lines?: Array<Record<string, unknown>>;
          message?: string | null;
          outsource_work_order_code?: string;
        },
      ): PushPreviewResponse => {
        const lines = preview.lines ?? [];
        let items: PushPreviewResponse['items'] = [];
        if (pullType === 'outsource_receipt') {
          items = lines.map((line) => ({
            item_id: Number(line.product_id ?? 0),
            material_code: String(line.product_code ?? ''),
            material_name: String(line.product_name ?? ''),
            quantity: Number(line.ordered_quantity ?? 0),
            pushed_quantity: Number(line.received_quantity ?? 0),
            max_push_quantity: Number(line.pending_quantity ?? 0),
          }));
        } else if (pullType === 'outsource_material_return') {
          items = lines.map((line) => ({
            item_id: Number(line.issue_id ?? 0),
            material_code: String(line.material_code ?? ''),
            material_name: String(line.material_name ?? ''),
            quantity: Number(line.issued_quantity ?? 0),
            pushed_quantity: Number(line.returned_quantity ?? 0),
            max_push_quantity: Number(line.returnable_quantity ?? 0),
          }));
        } else {
          items = lines.map((line) => ({
            item_id: Number(line.receipt_id ?? 0),
            material_code: String(line.product_code ?? line.receipt_code ?? ''),
            material_name: String(line.product_name ?? ''),
            quantity: Number(line.received_quantity ?? 0),
            pushed_quantity: Number(line.returned_quantity ?? 0),
            max_push_quantity: Number(line.returnable_quantity ?? 0),
          }));
        }
        const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
        let blockingReason: string | null = null;
        if (!items.length || pushableCount === 0) {
          blockingReason = preview.message || t('app.kuaizhizao.warehouseInbound.pull.outsource.previewNoLines');
        }
        const summaryKey =
          pullType === 'outsource_receipt'
            ? 'app.kuaizhizao.warehouseInbound.pull.outsource.receiptPreviewSummary'
            : pullType === 'outsource_material_return'
              ? 'app.kuaizhizao.warehouseInbound.pull.outsource.materialReturnPreviewSummary'
              : 'app.kuaizhizao.warehouseInbound.pull.outsource.productReturnPreviewSummary';
        return {
          target_type: pullType,
          summary: t(summaryKey, {
            code: preview.outsource_work_order_code ?? '',
            pushable: pushableCount,
            total: items.length,
          }),
          items,
          tip: t('app.kuaizhizao.warehouseInbound.pull.outsource.previewTip'),
          has_blocking_issues: !!blockingReason,
          blocking_reason: blockingReason,
        };
      },
      [t],
    );

    const showPullOibPreview = useCallback(
      (outsourceWorkOrderId: number, pullType: InboundOutsourcePullType) => {
        pullOibQueryCloseRef.current?.();
        setPullOibPreviewOpen(true);
        setPullOibPreviewLoading(true);
        setPullOibPreviewConfirming(false);
        setPullOibPreviewData(null);
        setPullOibPreviewWorkOrderId(outsourceWorkOrderId);
        setPullOibPreviewPullType(pullType);
        setPullOibSelectedItemIds([]);
        const previewPromise =
          pullType === 'outsource_receipt'
            ? outsourceMaterialReceiptApi.receiptPreview(outsourceWorkOrderId)
            : pullType === 'outsource_material_return'
              ? outsourceMaterialReturnApi.returnPreview(outsourceWorkOrderId)
              : outsourceProductReturnApi.returnPreview(outsourceWorkOrderId);
        previewPromise
          .then((res) => {
            const raw = (res as { data?: unknown })?.data ?? res;
            const mapped = mapOutsourceInboundPreview(pullType, raw as Parameters<typeof mapOutsourceInboundPreview>[1]);
            setPullOibPreviewData(mapped);
            if (pullType !== 'outsource_receipt') {
              setPullOibSelectedItemIds(
                (mapped.items || [])
                  .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                  .map((row) => Number(row.item_id)),
              );
            }
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.outsource.previewFailed')));
            resetPullOibPreviewModal();
          })
          .finally(() => setPullOibPreviewLoading(false));
      },
      [mapOutsourceInboundPreview, messageApi, resetPullOibPreviewModal, t],
    );

    const handlePullOibPreviewConfirm = useCallback(() => {
      if (!pullOibPreviewWorkOrderId || !pullOibPreviewData) return;
      if (pullOibPreviewData.has_blocking_issues) return;
      const entryPath = inboundOutsourceEntryPath(pullOibPreviewWorkOrderId, pullOibPreviewPullType);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:inbound-outsource-pull', entryPath, '');
      if (pullOibPreviewPullType === 'outsource_receipt') {
        const firstLine = pullOibPreviewData.items?.[0];
        const qty = Number(firstLine?.max_push_quantity ?? 0);
        setDocumentFormDraft(draftKey, {
          receiptLine: {
            receiptQuantity: qty,
            qualifiedQuantity: qty,
            unqualifiedQuantity: 0,
          },
        });
      } else {
        const rowById = new Map(
          (pullOibPreviewData.items || []).map((row) => [Number(row.item_id), row]),
        );
        const selectedIds = pullOibSelectedItemIds.filter((id) => {
          const row = rowById.get(id);
          return row && Number(row.max_push_quantity ?? 0) > 0;
        });
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.outsource.selectLinesFirst'));
          return;
        }
        const previewQtyByKey: Record<string, number> = {};
        selectedIds.forEach((id) => {
          previewQtyByKey[inboundOutsourcePreviewLineKey(pullOibPreviewPullType, id)] = Number(
            rowById.get(id)?.max_push_quantity ?? 0,
          );
        });
        setDocumentFormDraft(draftKey, { previewQtyByKey });
      }
      resetPullOibPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullOibPreviewData,
      pullOibPreviewPullType,
      pullOibPreviewWorkOrderId,
      pullOibSelectedItemIds,
      resetPullOibPreviewModal,
      t,
    ]);

    const pullDocumentScopeOptions = useMemo(
      () => [
        { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
        { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
      ],
      [t],
    );

    const isPullInboundPoSelectable = useCallback(
      (record: PullPurchaseOrderCandidate) => record.capabilities?.push_receipt?.allowed === true,
      [],
    );

    const isPullInboundSalesReturnSelectable = useCallback(
      (record: PullSalesOrderCandidate) => record.capabilities?.push_sales_return?.allowed === true,
      [],
    );

    const isPullInboundReceiptNoticeSelectable = useCallback(
      (record: PullReceiptNoticeCandidate) => record.capabilities?.notify?.allowed === true,
      [],
    );

    const isPullInboundWorkOrderSelectable = useCallback(
      (record: PullWorkOrderCandidate) => record.capabilities?.push_finished_goods_receipt?.allowed === true,
      [],
    );

    const isPullInboundProductionReturnSelectable = useCallback(
      (record: PullWorkOrderCandidate) => record.capabilities?.push_production_return?.allowed === true,
      [],
    );

    const isPullInboundOutsourceSelectable = useCallback((record: PullOutsourceWoCandidate) => {
      const capKey = inboundOutsourceCapabilityKey(outsourcePullTypeRef.current);
      return record.capabilities?.[capKey]?.allowed === true;
    }, []);

    const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const res = await listPurchaseReceiptPullCandidates({
            skip: 0,
            limit: 200,
            keyword: keyword.trim() || undefined,
          });
          const data = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullPurchaseOrderCandidate[] }).data)
            : [];
          const filtered = filterByPullScope(data, scope, isPullInboundPoSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.po.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundPoSelectable(record),
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectOnlyOne'));
          return;
        }
        showPullPoPreview(selectedId);
      },
    });
    pullPoQueryCloseRef.current = pullFromPurchaseOrderQuery.closeModal;

    const pullFromReceiptNoticeQuery = useUniPullQuery<PullReceiptNoticeCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const res = await receiptNoticeApi.list({
            skip: 0,
            limit: 200,
            keyword: keyword.trim() || undefined,
          });
          const data = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullReceiptNoticeCandidate[] }).data)
            : Array.isArray(res)
              ? (res as PullReceiptNoticeCandidate[])
              : [];
          const filtered = filterByPullScope(data, scope, isPullInboundReceiptNoticeSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundReceiptNoticeSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selected = rows[0];
        if (!selected?.id) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.selectRequired'));
          return;
        }
        if (selected.capabilities?.notify?.allowed !== true) {
          const reason = receiptNoticeCapabilityReasonMessage(selected.capabilities?.notify?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.receiptNotice.notifyPreviewBlocked'));
          return;
        }
        showPullRnPreview(selected);
      },
    });
    pullRnQueryCloseRef.current = pullFromReceiptNoticeQuery.closeModal;

    const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const { data } = await loadWorkOrderListPage(keyword, 1, 200);
          const filtered = filterByPullScope(data, scope, isPullInboundWorkOrderSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundWorkOrderSelectable(record),
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectRequired'));
          return;
        }
        const selected = rows[0];
        if (selected?.capabilities?.push_finished_goods_receipt?.allowed !== true) {
          const reason = workOrderCapabilityReasonMessage(selected?.capabilities?.push_finished_goods_receipt?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewBlocked'));
          return;
        }
        showPullWoPreview(selectedId);
      },
    });
    pullWoQueryCloseRef.current = pullFromWorkOrderQuery.closeModal;

    const pullFromProductionReturnQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const { data } = await loadWorkOrderListPage(keyword, 1, 200);
          const filtered = filterByPullScope(data, scope, isPullInboundProductionReturnSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.productionReturn.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundProductionReturnSelectable(record),
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.productionReturn.selectRequired'));
          return;
        }
        const selected = rows[0];
        if (selected?.capabilities?.push_production_return?.allowed !== true) {
          const reason = workOrderCapabilityReasonMessage(selected?.capabilities?.push_production_return?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewBlocked'));
          return;
        }
        showPullPrPreview(selectedId);
      },
    });
    pullPrQueryCloseRef.current = pullFromProductionReturnQuery.closeModal;

    const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const res = await listSalesOrders({
            skip: 0,
            limit: 200,
            keyword: keyword.trim() || undefined,
          });
          const orders = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullSalesOrderCandidate[] }).data)
            : [];
          const filtered = filterByPullScope(orders, scope, isPullInboundSalesReturnSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundSalesReturnSelectable(record),
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.selectRequired'));
          return;
        }
        const selected = rows[0];
        if (selected?.capabilities?.push_sales_return?.allowed !== true) {
          const reason = salesOrderCapabilityReasonMessage(selected?.capabilities?.push_sales_return?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.warehouseInbound.pull.salesReturn.previewBlocked'));
          return;
        }
        showPullSrPreview(selectedId);
      },
    });
    pullSrQueryCloseRef.current = pullFromSalesOrderQuery.closeModal;

    const pullFromOutsourceWorkOrderQuery = useUniPullQuery<PullOutsourceWoCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onClose: () => {
        setOutsourcePullType('outsource_receipt');
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const { data } = await loadOutsourceWorkOrderListPage(keyword, 1, 200);
          const filtered = filterByPullScope(data, scope, isPullInboundOutsourceSelectable);
          return paginatePullRows(filtered, page, pageSize);
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.outsource.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullInboundOutsourceSelectable(record),
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.outsource.selectRequired'));
          return;
        }
        const pullType = outsourcePullTypeRef.current;
        const selected = rows[0];
        const capKey = inboundOutsourceCapabilityKey(pullType);
        if (selected?.capabilities?.[capKey]?.allowed !== true) {
          const reason = outsourceWorkOrderCapabilityReasonMessage(selected?.capabilities?.[capKey]?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.warehouseInbound.pull.outsource.previewBlocked'));
          return;
        }
        showPullOibPreview(selectedId, pullType);
      },
    });
    pullOibQueryCloseRef.current = pullFromOutsourceWorkOrderQuery.closeModal;
    outsourcePullTypeRef.current = outsourcePullType;

    const outsourcePullTypeOptions = useMemo(
      (): { label: string; value: InboundOutsourcePullType }[] => [
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.receipt'), value: 'outsource_receipt' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.materialReturn'), value: 'outsource_material_return' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.productReturn'), value: 'outsource_product_return' },
      ],
      [t],
    );

    useImperativeHandle(ref, () => ({
      open: (key: InboundQuickPullKey) => {
        if (key === 'purchase_order') {
          pullFromPurchaseOrderQuery.openModal();
          return;
        }
        if (key === 'receipt_notice') {
          pullFromReceiptNoticeQuery.openModal();
          return;
        }
        if (key === 'work_order') {
          pullFromWorkOrderQuery.openModal();
          return;
        }
        if (key === 'production_return') {
          pullFromProductionReturnQuery.openModal();
          return;
        }
        if (key === 'sales_return') {
          pullFromSalesOrderQuery.openModal();
          return;
        }
        setOutsourcePullType('outsource_receipt');
        pullFromOutsourceWorkOrderQuery.openModal();
      },
    }));

    const poPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.poCode'), dataIndex: 'order_code', width: 160, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.supplier'), dataIndex: 'supplier_name', width: 160, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.orderStatus'), dataIndex: 'status', width: 100, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.purchaseQty'),
          dataIndex: 'ordered_total',
          width: 100,
          align: 'right' as const,
          render: (_: unknown, r: PullPurchaseOrderCandidate) => formatQuantity(r.ordered_total ?? r.total_quantity),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.receivedQty'),
          dataIndex: 'received_total',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.outstandingQty'),
          dataIndex: 'outstanding_total',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.receiptProgress'),
          key: 'receipt_stage',
          width: 130,
          align: 'center' as const,
          render: (_: unknown, r: PullPurchaseOrderCandidate) =>
            renderLifecycleSubStageTag(t, r.lifecycle?.sub_stages, 'purchase_receipt'),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.deliveryDate'),
          dataIndex: 'delivery_date',
          width: 110,
          render: (v: unknown) => v || '—',
        },
      ],
      [t],
    );

    const receiptNoticePullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.noticeCode'), dataIndex: 'notice_code', width: 180, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.poCode'), dataIndex: 'purchase_order_code', width: 180, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.supplier'), dataIndex: 'supplier_name', width: 180, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.targetWarehouse'),
          dataIndex: 'warehouse_name',
          width: 150,
          ellipsis: true,
          render: (v: unknown) => v || '-',
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.noticeStatus'), dataIndex: 'status', width: 120, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 180,
          render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.linkedReceipt'),
          key: 'linked_receipt',
          width: 170,
          ellipsis: true,
          render: (_: unknown, r: PullReceiptNoticeCandidate) =>
            r.purchase_receipt_code ? (
              <Tag color="gold">{r.purchase_receipt_code}</Tag>
            ) : (
              '—'
            ),
        },
      ],
      [t],
    );

    const workOrderPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderCode'), dataIndex: 'code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.product'), dataIndex: 'product_name', width: 160, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.sourceSalesOrder'),
          dataIndex: 'sales_order_code',
          width: 140,
          ellipsis: true,
          render: (v: unknown) => v || '—',
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderStatus'), dataIndex: 'status', width: 100, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.completionProgress'),
          key: 'completion',
          width: 180,
          align: 'right' as const,
          render: (_: unknown, r: PullWorkOrderCandidate) => formatPullPercent(r.completed_quantity, r.quantity),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 168,
          render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
      ],
      [t],
    );

    const productionReturnPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderCode'), dataIndex: 'code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.product'), dataIndex: 'product_name', width: 160, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.sourceSalesOrder'),
          dataIndex: 'sales_order_code',
          width: 140,
          ellipsis: true,
          render: (v: unknown) => v || '—',
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderStatus'), dataIndex: 'status', width: 100, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.completionProgress'),
          key: 'completion',
          width: 120,
          align: 'center' as const,
          render: (_: unknown, r: PullWorkOrderCandidate) => formatPullPercent(r.completed_quantity, r.quantity),
        },
      ],
      [t],
    );

    const salesReturnPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.salesOrderCode'), dataIndex: 'order_code', width: 160, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.customer'), dataIndex: 'customer_name', width: 180, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.orderStatus'), dataIndex: 'status', width: 110, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.orderQty'),
          dataIndex: 'total_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.deliveryProgress'),
          dataIndex: 'delivery_progress',
          width: 100,
          align: 'center' as const,
          render: (v: unknown) => (v != null && Number.isFinite(Number(v)) ? `${Number(v)}%` : '—'),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.deliveryDate'),
          dataIndex: 'delivery_date',
          width: 110,
          render: (v: unknown) => (v ? String(v).slice(0, 10) : '-'),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 168,
          render: (v: unknown) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
      ],
      [t],
    );

    const outsourcePullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.outsourceWoCode'), dataIndex: 'code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.product'), dataIndex: 'product_name', width: 150, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.outsourceSupplier'), dataIndex: 'supplier_name', width: 150, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.col.status'), dataIndex: 'status', width: 90, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.plannedOutsourceQty'),
          dataIndex: 'quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.receivedOutsourceQty'),
          dataIndex: 'received_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.issuedQty'),
          dataIndex: 'issued_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.pendingOutsourceReceipt'),
          key: 'pending_receipt',
          width: 100,
          align: 'right' as const,
          render: (_: unknown, r: PullOutsourceWoCandidate) => {
            const pending = Math.max(0, Number(r.quantity || 0) - Number(r.received_quantity || 0));
            return formatQuantity(pending);
          },
        },
      ],
      [t],
    );

    return (
      <>
        <UniPullQueryModal<PullPurchaseOrderCandidate>
          title={pullFromPurchaseOrderAction.label}
          open={pullFromPurchaseOrderQuery.open}
          onCancel={pullFromPurchaseOrderQuery.closeModal}
          onOk={pullFromPurchaseOrderQuery.handleConfirm}
          rowKey="id"
          columns={poPullColumns}
          dataSource={pullFromPurchaseOrderQuery.dataSource}
          loading={pullFromPurchaseOrderQuery.loading}
          confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
          selectionType={pullFromPurchaseOrderQuery.selectionType}
          selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
          searchDraft={pullFromPurchaseOrderQuery.searchDraft}
          onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
          onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
          onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
          appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.po.searchPlaceholder')}
          page={pullFromPurchaseOrderQuery.page}
          pageSize={pullFromPurchaseOrderQuery.pageSize}
          total={pullFromPurchaseOrderQuery.total}
          onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
          scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
          scope={pullFromPurchaseOrderQuery.scope}
          onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          width={1280}
          tableScroll={{ x: 1200, y: 360 }}
        />

        <Modal
          title={pullFromPurchaseOrderAction.label}
          open={pullPoPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullPoPreviewModal}
          okText={t('app.kuaizhizao.warehouseInbound.action.inbound')}
          cancelText={t('common.cancel')}
          confirmLoading={pullPoPreviewConfirming}
          onOk={() => void handlePullPoPreviewConfirm()}
          okButtonProps={{
            disabled:
              pullPoPreviewLoading ||
              !pullPoPreviewData ||
              !!pullPoPreviewData?.has_blocking_issues,
          }}
        >
          {pullPoPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullPoPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPoPreviewData.summary}</p>
              {pullPoPreviewData.has_blocking_issues && pullPoPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={purchaseOrderCapabilityReasonMessage(pullPoPreviewData.blocking_reason, t)}
                />
              ) : null}
              {pullPoPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullPoPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  rowSelection={{
                    selectedRowKeys: pullPoSelectedItemIds.map(String),
                    onChange: (keys) => setPullPoSelectedItemIds(keys.map((k) => Number(k))),
                    getCheckboxProps: (row) => ({
                      disabled: Number(row.max_push_quantity ?? 0) <= 0,
                    }),
                  }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.po.previewNoLines')} />
              )}
              {pullPoPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullPoPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <Modal
          title={pullFromReceiptNoticeAction.label}
          open={pullRnPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullRnPreviewModal}
          okText={pullFromReceiptNoticeAction.label}
          cancelText={t('common.cancel')}
          confirmLoading={pullRnPreviewConfirming}
          onOk={() => void handlePullRnPreviewConfirm()}
          okButtonProps={{
            disabled: pullRnPreviewLoading || !pullRnPreviewData || !!pullRnPreviewData?.has_blocking_issues,
          }}
        >
          {pullRnPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullRnPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullRnPreviewData.summary}</p>
              {pullRnPreviewData.has_blocking_issues ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    (pullRnPreviewData.line_blocking_issues && pullRnPreviewData.line_blocking_issues.length > 0
                      ? pullRnPreviewData.line_blocking_issues.join('；')
                      : null) ||
                    receiptNoticeCapabilityReasonMessage(pullRnPreviewData.blocking_reason, t) ||
                    t('app.kuaizhizao.receiptNotice.notifyPreviewBlocked')
                  }
                />
              ) : null}
              {pullRnPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullRnPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.purchaseOrder.col.noticeQty'), dataIndex: 'notice_quantity', width: 90, align: 'right' , render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.receiptNotice.notifyPreviewNoLines')} />
              )}
              {pullRnPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullRnPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <Modal
          title={pullFromWorkOrderAction.label}
          open={pullWoPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullWoPreviewModal}
          okText={t('app.kuaizhizao.warehouseInbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          onOk={handlePullWoPreviewConfirm}
          okButtonProps={{
            disabled: pullWoPreviewLoading || !pullWoPreviewData || !!pullWoPreviewData?.has_blocking_issues,
          }}
        >
          {pullWoPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullWoPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullWoPreviewData.summary}</p>
              {pullWoPreviewData.has_blocking_issues && pullWoPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={workOrderCapabilityReasonMessage(pullWoPreviewData.blocking_reason, t) || pullWoPreviewData.blocking_reason}
                />
              ) : null}
              {pullWoPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullWoPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.warehouseInbound.col.plannedQty'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseInbound.col.receivedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseInbound.col.pendingQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.workOrder.previewNoLines')} />
              )}
              {pullWoPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullWoPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <Modal
          title={pullFromSalesOrderAction.label}
          open={pullSrPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullSrPreviewModal}
          okText={t('app.kuaizhizao.warehouseInbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          confirmLoading={pullSrPreviewConfirming}
          onOk={() => void (async () => {
            setPullSrPreviewConfirming(true);
            try {
              handlePullSrPreviewConfirm();
            } finally {
              setPullSrPreviewConfirming(false);
            }
          })()}
          okButtonProps={{
            disabled: pullSrPreviewLoading || !pullSrPreviewData || !!pullSrPreviewData?.has_blocking_issues,
          }}
        >
          {pullSrPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullSrPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullSrPreviewData.summary}</p>
              {pullSrPreviewData.has_blocking_issues && pullSrPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={salesOrderCapabilityReasonMessage(pullSrPreviewData.blocking_reason, t)}
                />
              ) : null}
              {pullSrPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullSrPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  rowSelection={{
                    selectedRowKeys: pullSrSelectedItemIds.map(String),
                    onChange: (keys) => setPullSrSelectedItemIds(keys.map((k) => Number(k))),
                    getCheckboxProps: (row) => ({
                      disabled: Number(row.max_push_quantity ?? 0) <= 0,
                    }),
                  }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.previewNoLines')} />
              )}
              {pullSrPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullSrPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <UniPullQueryModal<PullReceiptNoticeCandidate>
          title={pullFromReceiptNoticeAction.label}
          open={pullFromReceiptNoticeQuery.open}
          onCancel={() => {
            if (pullFromReceiptNoticeQuery.confirmLoading) return;
            pullFromReceiptNoticeQuery.closeModal();
          }}
          onOk={pullFromReceiptNoticeQuery.handleConfirm}
          rowKey="id"
          columns={receiptNoticePullColumns}
          dataSource={pullFromReceiptNoticeQuery.dataSource}
          loading={pullFromReceiptNoticeQuery.loading}
          confirmLoading={pullFromReceiptNoticeQuery.confirmLoading}
          selectionType={pullFromReceiptNoticeQuery.selectionType}
          selectedRowKeys={pullFromReceiptNoticeQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromReceiptNoticeQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromReceiptNoticeQuery.isRowDisabled}
          searchDraft={pullFromReceiptNoticeQuery.searchDraft}
          onSearchDraftChange={pullFromReceiptNoticeQuery.setSearchDraft}
          onSearchApply={pullFromReceiptNoticeQuery.handleSearchApply}
          onSearchClear={pullFromReceiptNoticeQuery.handleSearchClear}
          appliedKeyword={pullFromReceiptNoticeQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.searchPlaceholder')}
          page={pullFromReceiptNoticeQuery.page}
          pageSize={pullFromReceiptNoticeQuery.pageSize}
          total={pullFromReceiptNoticeQuery.total}
          onPageChange={pullFromReceiptNoticeQuery.handlePageChange}
          scopeOptions={pullFromReceiptNoticeQuery.scopeOptions}
          scope={pullFromReceiptNoticeQuery.scope}
          onScopeChange={pullFromReceiptNoticeQuery.handleScopeChange}
          width={1240}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          tableScroll={{ x: 1160, y: 360 }}
        />

        <UniPullQueryModal<PullWorkOrderCandidate>
          title={pullFromWorkOrderAction.label}
          open={pullFromWorkOrderQuery.open}
          onCancel={pullFromWorkOrderQuery.closeModal}
          onOk={pullFromWorkOrderQuery.handleConfirm}
          rowKey="id"
          columns={workOrderPullColumns}
          dataSource={pullFromWorkOrderQuery.dataSource}
          loading={pullFromWorkOrderQuery.loading}
          confirmLoading={pullFromWorkOrderQuery.confirmLoading}
          selectionType={pullFromWorkOrderQuery.selectionType}
          selectedRowKeys={pullFromWorkOrderQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromWorkOrderQuery.isRowDisabled}
          searchDraft={pullFromWorkOrderQuery.searchDraft}
          onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
          onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
          onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
          appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.searchPlaceholder')}
          page={pullFromWorkOrderQuery.page}
          pageSize={pullFromWorkOrderQuery.pageSize}
          total={pullFromWorkOrderQuery.total}
          onPageChange={pullFromWorkOrderQuery.handlePageChange}
          scopeOptions={pullFromWorkOrderQuery.scopeOptions}
          scope={pullFromWorkOrderQuery.scope}
          onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          tableScroll={{ x: 1100, y: 360 }}
        />

        <UniPullQueryModal<PullWorkOrderCandidate>
          title={pullFromProductionReturnAction.label}
          open={pullFromProductionReturnQuery.open}
          onCancel={pullFromProductionReturnQuery.closeModal}
          onOk={pullFromProductionReturnQuery.handleConfirm}
          rowKey="id"
          columns={productionReturnPullColumns}
          dataSource={pullFromProductionReturnQuery.dataSource}
          loading={pullFromProductionReturnQuery.loading}
          confirmLoading={pullFromProductionReturnQuery.confirmLoading}
          selectionType={pullFromProductionReturnQuery.selectionType}
          selectedRowKeys={pullFromProductionReturnQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromProductionReturnQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromProductionReturnQuery.isRowDisabled}
          searchDraft={pullFromProductionReturnQuery.searchDraft}
          onSearchDraftChange={pullFromProductionReturnQuery.setSearchDraft}
          onSearchApply={pullFromProductionReturnQuery.handleSearchApply}
          onSearchClear={pullFromProductionReturnQuery.handleSearchClear}
          appliedKeyword={pullFromProductionReturnQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.searchPlaceholder')}
          page={pullFromProductionReturnQuery.page}
          pageSize={pullFromProductionReturnQuery.pageSize}
          total={pullFromProductionReturnQuery.total}
          onPageChange={pullFromProductionReturnQuery.handlePageChange}
          scopeOptions={pullFromProductionReturnQuery.scopeOptions}
          scope={pullFromProductionReturnQuery.scope}
          onScopeChange={pullFromProductionReturnQuery.handleScopeChange}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          tableScroll={{ x: 1100, y: 360 }}
        />

        <Modal
          title={pullFromProductionReturnAction.label}
          open={pullPrPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullPrPreviewModal}
          okText={t('app.kuaizhizao.warehouseInbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          confirmLoading={pullPrPreviewConfirming}
          onOk={() => void (async () => {
            setPullPrPreviewConfirming(true);
            try {
              handlePullPrPreviewConfirm();
            } finally {
              setPullPrPreviewConfirming(false);
            }
          })()}
          okButtonProps={{
            disabled:
              pullPrPreviewLoading ||
              !pullPrPreviewData ||
              pullPrPreviewBlocking.has_blocking_issues ||
              !pullPrPreviewPickingId,
          }}
        >
          {pullPrPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullPrPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPrPreviewBlocking.summary}</p>
              {pullPrPreviewBlocking.has_blocking_issues && pullPrPreviewBlocking.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    workOrderCapabilityReasonMessage(pullPrPreviewBlocking.blocking_reason, t) ||
                    pullPrPreviewBlocking.blocking_reason
                  }
                />
              ) : null}
              {pullPrPreviewData.pickings.length > 0 ? (
                <>
                  <Form.Item label={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.pickingLabel')} style={{ marginBottom: 12 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={pullPrPreviewPickingId ?? undefined}
                      options={pullPrPreviewData.pickings.map((picking) => ({
                        value: picking.picking_id,
                        label: `${picking.picking_code} - ${picking.status}`,
                      }))}
                      onChange={(value) => {
                        const nextPickingId = Number(value);
                        setPullPrPreviewPickingId(nextPickingId);
                        const nextPicking = pullPrPreviewData.pickings.find((row) => row.picking_id === nextPickingId);
                        setPullPrSelectedItemIds(
                          (nextPicking?.lines || [])
                            .filter((line) => Number(line.source_pending_quantity ?? 0) > 0)
                            .map((line) => Number(line.picking_item_id)),
                        );
                      }}
                    />
                  </Form.Item>
                  {pullPrPreviewLines.length > 0 ? (
                    <Table
                      size="small"
                      dataSource={pullPrPreviewLines}
                      rowKey={(row) => String(row.picking_item_id)}
                      pagination={false}
                      scroll={{ x: 960 }}
                      rowSelection={{
                        selectedRowKeys: pullPrSelectedItemIds.map(String),
                        onChange: (keys) => setPullPrSelectedItemIds(keys.map((k) => Number(k))),
                        getCheckboxProps: (row) => ({
                          disabled: Number(row.source_pending_quantity ?? 0) <= 0,
                        }),
                      }}
                      columns={[
                        { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                        { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: t('app.kuaizhizao.warehouseInbound.col.pickedQty'), dataIndex: 'source_doc_quantity', width: 90, align: 'right' },
                        { title: t('app.kuaizhizao.warehouseInbound.col.returnedQty'), dataIndex: 'source_received_quantity', width: 90, align: 'right' },
                        { title: t('app.kuaizhizao.warehouseInbound.col.returnableQty'), dataIndex: 'source_pending_quantity', width: 90, align: 'right' },
                      ]}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewNoLines')} />
                  )}
                </>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewNoLines')} />
              )}
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {t('app.kuaizhizao.warehouseInbound.pull.productionReturn.previewTip')}
              </Typography.Paragraph>
            </div>
          ) : null}
        </Modal>

        <UniPullQueryModal<PullSalesOrderCandidate>
          title={pullFromSalesOrderAction.label}
          open={pullFromSalesOrderQuery.open}
          onCancel={pullFromSalesOrderQuery.closeModal}
          onOk={pullFromSalesOrderQuery.handleConfirm}
          rowKey="id"
          columns={salesReturnPullColumns}
          dataSource={pullFromSalesOrderQuery.dataSource}
          loading={pullFromSalesOrderQuery.loading}
          confirmLoading={pullFromSalesOrderQuery.confirmLoading}
          selectionType={pullFromSalesOrderQuery.selectionType}
          selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
          searchDraft={pullFromSalesOrderQuery.searchDraft}
          onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
          onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
          onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
          appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.searchPlaceholder')}
          page={pullFromSalesOrderQuery.page}
          pageSize={pullFromSalesOrderQuery.pageSize}
          total={pullFromSalesOrderQuery.total}
          onPageChange={pullFromSalesOrderQuery.handlePageChange}
          scopeOptions={pullFromSalesOrderQuery.scopeOptions}
          scope={pullFromSalesOrderQuery.scope}
          onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          width={1100}
          tableScroll={{ x: 900, y: 340 }}
        />

        <UniPullQueryModal<PullOutsourceWoCandidate>
          title={pullFromOutsourceWorkOrderAction.label}
          open={pullFromOutsourceWorkOrderQuery.open}
          onCancel={pullFromOutsourceWorkOrderQuery.closeModal}
          onOk={pullFromOutsourceWorkOrderQuery.handleConfirm}
          rowKey="id"
          columns={outsourcePullColumns}
          dataSource={pullFromOutsourceWorkOrderQuery.dataSource}
          loading={pullFromOutsourceWorkOrderQuery.loading}
          confirmLoading={pullFromOutsourceWorkOrderQuery.confirmLoading}
          selectionType={pullFromOutsourceWorkOrderQuery.selectionType}
          selectedRowKeys={pullFromOutsourceWorkOrderQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromOutsourceWorkOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromOutsourceWorkOrderQuery.isRowDisabled}
          searchDraft={pullFromOutsourceWorkOrderQuery.searchDraft}
          onSearchDraftChange={pullFromOutsourceWorkOrderQuery.setSearchDraft}
          onSearchApply={pullFromOutsourceWorkOrderQuery.handleSearchApply}
          onSearchClear={pullFromOutsourceWorkOrderQuery.handleSearchClear}
          appliedKeyword={pullFromOutsourceWorkOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.outsource.searchPlaceholder')}
          page={pullFromOutsourceWorkOrderQuery.page}
          pageSize={pullFromOutsourceWorkOrderQuery.pageSize}
          total={pullFromOutsourceWorkOrderQuery.total}
          onPageChange={pullFromOutsourceWorkOrderQuery.handlePageChange}
          scopeOptions={pullFromOutsourceWorkOrderQuery.scopeOptions}
          scope={pullFromOutsourceWorkOrderQuery.scope}
          onScopeChange={pullFromOutsourceWorkOrderQuery.handleScopeChange}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          filterExtra={(
            <ThemedSegmented
              block
              value={outsourcePullType}
              options={outsourcePullTypeOptions}
              onChange={(v) => {
                const nextType = v as InboundOutsourcePullType;
                setOutsourcePullType(nextType);
                outsourcePullTypeRef.current = nextType;
                pullFromOutsourceWorkOrderQuery.handleSelectedRowKeysChange([], []);
                pullFromOutsourceWorkOrderQuery.reloadCurrent();
              }}
            />
          )}
          tableScroll={{ x: 1050, y: 360 }}
        />

        <Modal
          title={
            pullOibPreviewPullType === 'outsource_receipt'
              ? t('app.kuaizhizao.warehouseInbound.pull.outsourceType.receipt')
              : pullOibPreviewPullType === 'outsource_material_return'
                ? t('app.kuaizhizao.warehouseInbound.pull.outsourceType.materialReturn')
                : t('app.kuaizhizao.warehouseInbound.pull.outsourceType.productReturn')
          }
          open={pullOibPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullOibPreviewModal}
          okText={t('app.kuaizhizao.warehouseInbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          confirmLoading={pullOibPreviewConfirming}
          onOk={() => void (async () => {
            setPullOibPreviewConfirming(true);
            try {
              handlePullOibPreviewConfirm();
            } finally {
              setPullOibPreviewConfirming(false);
            }
          })()}
          okButtonProps={{
            disabled: pullOibPreviewLoading || !pullOibPreviewData || !!pullOibPreviewData?.has_blocking_issues,
          }}
        >
          {pullOibPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullOibPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullOibPreviewData.summary}</p>
              {pullOibPreviewData.has_blocking_issues && pullOibPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    outsourceWorkOrderCapabilityReasonMessage(pullOibPreviewData.blocking_reason, t) ||
                    pullOibPreviewData.blocking_reason
                  }
                />
              ) : null}
              {pullOibPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullOibPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  rowSelection={
                    pullOibPreviewPullType === 'outsource_receipt'
                      ? undefined
                      : {
                          selectedRowKeys: pullOibSelectedItemIds.map(String),
                          onChange: (keys) => setPullOibSelectedItemIds(keys.map((k) => Number(k))),
                          getCheckboxProps: (row) => ({
                            disabled: Number(row.max_push_quantity ?? 0) <= 0,
                          }),
                        }
                  }
                  columns={[
                    {
                      title:
                        pullOibPreviewPullType === 'outsource_product_return'
                          ? t('app.kuaizhizao.warehouseInbound.col.productCode')
                          : t('app.kuaizhizao.salesOrder.materialCode'),
                      dataIndex: 'material_code',
                      width: 130,
                      ellipsis: true,
                    },
                    {
                      title:
                        pullOibPreviewPullType === 'outsource_product_return'
                          ? t('app.kuaizhizao.warehouseInbound.col.productName')
                          : t('app.kuaizhizao.salesOrder.materialName'),
                      dataIndex: 'material_name',
                      width: 160,
                      ellipsis: true,
                    },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.pull.outsource.previewNoLines')} />
              )}
              {pullOibPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullOibPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>
      </>
    );
  },
);

InboundQuickPullModals.displayName = 'InboundQuickPullModals';

export default InboundQuickPullModals;
