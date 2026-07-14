import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Empty, Modal, Select, Spin, Table, Tag, Typography } from 'antd';
import {
  listSalesOrders,
  previewPushSalesOrderToDelivery,
  type PushPreviewResponse,
} from '../../../services/sales-order';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import {
  shipmentNoticeApi,
  type ShipmentNotice,
  type ShipmentNoticeNotifyPreviewResponse,
} from '../../../services/shipment-notice';
import { outsourceWorkOrderApi, outsourceMaterialIssueApi } from '../../../services/production';
import { workOrderApi } from '../../../services/work-order';
import { formatDateTimeBySiteSetting, formatQuantity } from '../../../../../utils/format';
import {
  outboundOutsourceEntryPath,
  outboundSalesOrderEntryPath,
  outboundWorkOrderEntryPath,
} from './outboundPaths';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  salesOrderCapabilityReasonMessage,
  shipmentNoticeCapabilityReasonMessage,
  workOrderCapabilityReasonMessage,
  outsourceWorkOrderCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  buildDocumentCreateDraftKey,
  setDocumentFormDraft,
} from '../../../../../utils/documentFormDraftCache';

export type OutboundQuickPullKey = 'work_order' | 'sales_order' | 'shipment_notice' | 'outsource';

export type OutboundQuickPullModalsRef = {
  open: (key: OutboundQuickPullKey) => void;
};

type PullWorkOrderCandidate = {
  id: number;
  code?: string;
  product_name?: string;
  sales_order_code?: string;
  status?: string;
  quantity?: number;
  updated_at?: string;
  capabilities?: {
    push_production_picking?: { allowed?: boolean; reason?: string | null };
  };
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
    push_outsource_issue?: { allowed?: boolean; reason?: string | null };
  };
};
type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
  total_quantity?: number;
  capabilities?: {
    push_sales_delivery?: { allowed?: boolean; reason?: string | null };
  };
};

type PullShipmentNoticeCandidate = ShipmentNotice & {
  id: number;
};

type OutboundQuickPullModalsProps = {
  onSuccess: () => void;
};

const OutboundQuickPullModals = forwardRef<OutboundQuickPullModalsRef, OutboundQuickPullModalsProps>(
  ({ onSuccess }, ref) => {
    const { t } = useTranslation();
    const { message: messageApi } = App.useApp();
    const navigate = useNavigate();
    const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_work_order');
    const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_delivery.pull_from_sales_order');
    const pullFromShipmentNoticeAction = resolveKuaizhizaoDocumentAction(t, 'sales_delivery.pull_from_shipment_notice');
    const pullFromOutsourceWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_outsource_work_order');

    const pullSoQueryCloseRef = useRef<(() => void) | null>(null);
    const pullSnQueryCloseRef = useRef<(() => void) | null>(null);
    const pullWoQueryCloseRef = useRef<(() => void) | null>(null);
    const pullOsQueryCloseRef = useRef<(() => void) | null>(null);
    const [pullSoPreviewOpen, setPullSoPreviewOpen] = useState(false);
    const [pullSoPreviewLoading, setPullSoPreviewLoading] = useState(false);
    const [pullSoPreviewConfirming, setPullSoPreviewConfirming] = useState(false);
    const [pullSoPreviewData, setPullSoPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullSoPreviewOrderId, setPullSoPreviewOrderId] = useState<number | null>(null);
    const [pullSoSelectedItemIds, setPullSoSelectedItemIds] = useState<number[]>([]);
    const [pullSoWarehouseOptions, setPullSoWarehouseOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [pullSoLineWh, setPullSoLineWh] = useState<Record<number, number>>({});
    const [pullSnPreviewOpen, setPullSnPreviewOpen] = useState(false);
    const [pullSnPreviewLoading, setPullSnPreviewLoading] = useState(false);
    const [pullSnPreviewConfirming, setPullSnPreviewConfirming] = useState(false);
    const [pullSnPreviewData, setPullSnPreviewData] = useState<ShipmentNoticeNotifyPreviewResponse | null>(null);
    const [pullSnPreviewTarget, setPullSnPreviewTarget] = useState<ShipmentNotice | null>(null);
    const [pullWoPreviewOpen, setPullWoPreviewOpen] = useState(false);
    const [pullWoPreviewLoading, setPullWoPreviewLoading] = useState(false);
    const [pullWoPreviewData, setPullWoPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullWoPreviewWorkOrderId, setPullWoPreviewWorkOrderId] = useState<number | null>(null);
    const [pullOsPreviewOpen, setPullOsPreviewOpen] = useState(false);
    const [pullOsPreviewLoading, setPullOsPreviewLoading] = useState(false);
    const [pullOsPreviewConfirming, setPullOsPreviewConfirming] = useState(false);
    const [pullOsPreviewData, setPullOsPreviewData] = useState<PushPreviewResponse | null>(null);
    const [pullOsPreviewWorkOrderId, setPullOsPreviewWorkOrderId] = useState<number | null>(null);
    const [pullOsSelectedMaterialIds, setPullOsSelectedMaterialIds] = useState<number[]>([]);

    const resetPullWoPreviewModal = useCallback(() => {
      setPullWoPreviewOpen(false);
      setPullWoPreviewData(null);
      setPullWoPreviewWorkOrderId(null);
    }, []);

    const resetPullOsPreviewModal = useCallback(() => {
      setPullOsPreviewOpen(false);
      setPullOsPreviewData(null);
      setPullOsPreviewWorkOrderId(null);
      setPullOsSelectedMaterialIds([]);
    }, []);

    const resetPullSoPreviewModal = useCallback(() => {
      setPullSoPreviewOpen(false);
      setPullSoPreviewData(null);
      setPullSoPreviewOrderId(null);
      setPullSoSelectedItemIds([]);
      setPullSoWarehouseOptions([]);
      setPullSoLineWh({});
    }, []);

    const resetPullSnPreviewModal = useCallback(() => {
      setPullSnPreviewOpen(false);
      setPullSnPreviewData(null);
      setPullSnPreviewTarget(null);
    }, []);

    const showPullSoPreview = useCallback(
      (orderId: number) => {
        pullSoQueryCloseRef.current?.();
        setPullSoPreviewOpen(true);
        setPullSoPreviewLoading(true);
        setPullSoPreviewConfirming(false);
        setPullSoPreviewData(null);
        setPullSoPreviewOrderId(orderId);
        setPullSoSelectedItemIds([]);
        setPullSoLineWh({});
        Promise.all([
          previewPushSalesOrderToDelivery(orderId),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ])
          .then(([res, whRes]) => {
            setPullSoPreviewData(res);
            const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
            setPullSoWarehouseOptions(
              (Array.isArray(whList) ? whList : []).map((w) => {
                const row = w as { id: number; code?: string; name?: string };
                const label = `${row.code || ''} ${row.name || ''}`.trim() || String(row.id);
                return { label, value: row.id };
              }),
            );
            const lineWh: Record<number, number> = {};
            (res.items || []).forEach((row) => {
              const itemId = Number(row.item_id);
              const whId = Number(row.warehouse_id);
              if (Number.isFinite(itemId) && itemId > 0 && Number.isFinite(whId) && whId > 0) {
                lineWh[itemId] = whId;
              }
            });
            setPullSoLineWh(lineWh);
            setPullSoSelectedItemIds(
              (res.items || [])
                .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                .map((row) => Number(row.item_id)),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseOutbound.pull.soPreviewFailed')));
            resetPullSoPreviewModal();
          })
          .finally(() => setPullSoPreviewLoading(false));
      },
      [messageApi, resetPullSoPreviewModal, t],
    );

    const handlePullSoPreviewConfirm = useCallback(() => {
      if (!pullSoPreviewOrderId || !pullSoPreviewData) return;
      if (pullSoPreviewData.has_blocking_issues) return;
      const rowById = new Map(
        (pullSoPreviewData.items || []).map((row) => [Number(row.item_id), row]),
      );
      const selectedIds = pullSoSelectedItemIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.max_push_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.soSelectLinesFirst'));
        return;
      }
      const quantities: Record<number, number> = {};
      const maxQuantities: Record<number, number> = {};
      const lineWh: Record<number, number> = {};
      (pullSoPreviewData.items || []).forEach((row) => {
        const itemId = Number(row.item_id);
        quantities[itemId] = 0;
        maxQuantities[itemId] = Number(row.max_push_quantity ?? 0);
      });
      for (const id of selectedIds) {
        const row = rowById.get(id);
        const wh = pullSoLineWh[id];
        if (wh == null || !(wh > 0)) {
          messageApi.warning(
            t('app.kuaizhizao.salesOrder.pushShipmentSelectLineWarehouse', {
              material: row?.material_code || row?.material_name || id,
            }),
          );
          return;
        }
        quantities[id] = Number(row?.max_push_quantity ?? 0);
        lineWh[id] = wh;
      }
      const entryPath = outboundSalesOrderEntryPath(pullSoPreviewOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:outbound-sales-order-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { quantities, maxQuantities, lineWh });
      resetPullSoPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullSoPreviewData,
      pullSoPreviewOrderId,
      pullSoSelectedItemIds,
      pullSoLineWh,
      resetPullSoPreviewModal,
      t,
    ]);

    const showPullSnPreview = useCallback(
      (notice: ShipmentNotice) => {
        if (!notice.id) return;
        pullSnQueryCloseRef.current?.();
        setPullSnPreviewOpen(true);
        setPullSnPreviewLoading(true);
        setPullSnPreviewConfirming(false);
        setPullSnPreviewData(null);
        setPullSnPreviewTarget(notice);
        shipmentNoticeApi
          .previewNotify(String(notice.id), {
            warehouse_id: notice.warehouse_id,
          })
          .then((res) => setPullSnPreviewData(res))
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.notifyPreviewFailed')));
            resetPullSnPreviewModal();
          })
          .finally(() => setPullSnPreviewLoading(false));
      },
      [messageApi, resetPullSnPreviewModal, t],
    );

    const handlePullSnPreviewConfirm = useCallback(async () => {
      if (!pullSnPreviewTarget?.id || !pullSnPreviewData) return;
      if (pullSnPreviewData.has_blocking_issues) return;
      setPullSnPreviewConfirming(true);
      try {
        const warehouseId = pullSnPreviewData.warehouse_id ?? pullSnPreviewTarget.warehouse_id;
        const res = (await shipmentNoticeApi.notify(String(pullSnPreviewTarget.id), {
          warehouse_id: warehouseId != null ? Number(warehouseId) : undefined,
          warehouse_name: pullSnPreviewTarget.warehouse_name,
        })) as ShipmentNotice;
        messageApi.success(
          res?.sales_delivery_code
            ? t('app.kuaizhizao.shipmentNotice.notifySuccessWithDelivery', { deliveryCode: res.sales_delivery_code })
            : t('app.kuaizhizao.shipmentNotice.notifySuccess'),
        );
        resetPullSnPreviewModal();
        onSuccess();
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.shipmentNotice.notifyFailed')));
      } finally {
        setPullSnPreviewConfirming(false);
      }
    }, [messageApi, onSuccess, pullSnPreviewData, pullSnPreviewTarget, resetPullSnPreviewModal, t]);

    const showPullWoPreview = useCallback(
      (workOrderId: number) => {
        pullWoQueryCloseRef.current?.();
        setPullWoPreviewOpen(true);
        setPullWoPreviewLoading(true);
        setPullWoPreviewData(null);
        setPullWoPreviewWorkOrderId(workOrderId);
        workOrderApi
          .previewPushProductionPicking(workOrderId)
          .then((res) => setPullWoPreviewData(res as PushPreviewResponse))
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseOutbound.pull.woPreviewFailed')));
            resetPullWoPreviewModal();
          })
          .finally(() => setPullWoPreviewLoading(false));
      },
      [messageApi, resetPullWoPreviewModal, t],
    );

    const handlePullWoPreviewConfirm = useCallback(() => {
      if (!pullWoPreviewWorkOrderId || !pullWoPreviewData) return;
      if (pullWoPreviewData.has_blocking_issues) return;
      const issueQuantities: Record<number, number> = {};
      const maxQuantities: Record<number, number> = {};
      (pullWoPreviewData.items || []).forEach((row) => {
        const materialId = Number(row.item_id);
        maxQuantities[materialId] = Number(row.max_push_quantity ?? 0);
        issueQuantities[materialId] = 0;
      });
      const entryPath = outboundWorkOrderEntryPath(pullWoPreviewWorkOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:outbound-work-order-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { issueQuantities, maxQuantities });
      resetPullWoPreviewModal();
      navigate(entryPath);
    }, [navigate, pullWoPreviewData, pullWoPreviewWorkOrderId, resetPullWoPreviewModal]);

    const mapOutsourceIssuePreview = useCallback(
      (preview: {
        lines?: Array<{
          material_id?: number;
          material_code?: string;
          material_name?: string;
          required_quantity?: number | string;
          issued_quantity?: number | string;
          pending_quantity?: number | string;
        }>;
        message?: string | null;
        outsource_work_order_code?: string;
      }): PushPreviewResponse => {
        const items = (preview.lines ?? []).map((line) => ({
          item_id: Number(line.material_id),
          material_code: String(line.material_code ?? ''),
          material_name: String(line.material_name ?? ''),
          quantity: Number(line.required_quantity ?? 0),
          pushed_quantity: Number(line.issued_quantity ?? 0),
          max_push_quantity: Number(line.pending_quantity ?? 0),
        }));
        const pushableCount = items.filter((row) => Number(row.max_push_quantity ?? 0) > 0).length;
        let blockingReason: string | null = null;
        if (!items.length) {
          blockingReason = preview.message || t('app.kuaizhizao.warehouseOutbound.pull.osPreviewNoLines');
        } else if (pushableCount === 0) {
          blockingReason = preview.message || t('app.kuaizhizao.warehouseOutbound.pull.osPreviewNoLines');
        }
        return {
          target_type: 'outsource_material_issue',
          summary: t('app.kuaizhizao.warehouseOutbound.pull.osPreviewSummary', {
            code: preview.outsource_work_order_code ?? '',
            pushable: pushableCount,
            total: items.length,
          }),
          items,
          tip: t('app.kuaizhizao.warehouseOutbound.pull.osPreviewTip'),
          has_blocking_issues: !!blockingReason,
          blocking_reason: blockingReason,
        };
      },
      [t],
    );

    const showPullOsPreview = useCallback(
      (outsourceWorkOrderId: number) => {
        pullOsQueryCloseRef.current?.();
        setPullOsPreviewOpen(true);
        setPullOsPreviewLoading(true);
        setPullOsPreviewConfirming(false);
        setPullOsPreviewData(null);
        setPullOsPreviewWorkOrderId(outsourceWorkOrderId);
        setPullOsSelectedMaterialIds([]);
        outsourceMaterialIssueApi
          .issuePreview(outsourceWorkOrderId)
          .then((res) => {
            const raw = (res as { data?: unknown })?.data ?? res;
            const mapped = mapOutsourceIssuePreview(raw as Parameters<typeof mapOutsourceIssuePreview>[0]);
            setPullOsPreviewData(mapped);
            setPullOsSelectedMaterialIds(
              (mapped.items || [])
                .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                .map((row) => Number(row.item_id)),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseOutbound.pull.osPreviewFailed')));
            resetPullOsPreviewModal();
          })
          .finally(() => setPullOsPreviewLoading(false));
      },
      [mapOutsourceIssuePreview, messageApi, resetPullOsPreviewModal, t],
    );

    const handlePullOsPreviewConfirm = useCallback(() => {
      if (!pullOsPreviewWorkOrderId || !pullOsPreviewData) return;
      if (pullOsPreviewData.has_blocking_issues) return;
      const rowById = new Map(
        (pullOsPreviewData.items || []).map((row) => [Number(row.item_id), row]),
      );
      const selectedIds = pullOsSelectedMaterialIds.filter((id) => {
        const row = rowById.get(id);
        return row && Number(row.max_push_quantity ?? 0) > 0;
      });
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.osSelectLinesFirst'));
        return;
      }
      const issueQuantities: Record<number, number> = {};
      selectedIds.forEach((id) => {
        issueQuantities[id] = Number(rowById.get(id)?.max_push_quantity ?? 0);
      });
      const entryPath = outboundOutsourceEntryPath(pullOsPreviewWorkOrderId);
      const draftKey = buildDocumentCreateDraftKey('kuaizhizao:outbound-outsource-pull', entryPath, '');
      setDocumentFormDraft(draftKey, { issueQuantities });
      resetPullOsPreviewModal();
      navigate(entryPath);
    }, [
      messageApi,
      navigate,
      pullOsPreviewData,
      pullOsPreviewWorkOrderId,
      pullOsSelectedMaterialIds,
      resetPullOsPreviewModal,
      t,
    ]);

    const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim();
          const res = await workOrderApi.list({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: kw || undefined,
          });
          const list = Array.isArray(res)
            ? res
            : (res as { data?: unknown[]; items?: unknown[] })?.data
              ?? (res as { items?: unknown[] })?.items
              ?? [];
          const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
          const candidates = rows.map((wo) => ({
            id: Number(wo.id),
            code: String(wo.code ?? ''),
            product_name: String(wo.product_name ?? wo.name ?? ''),
            sales_order_code: String(wo.sales_order_code ?? ''),
            status: String(wo.status ?? ''),
            quantity: Number(wo.quantity ?? 0),
            updated_at: String(wo.updated_at ?? ''),
            capabilities: wo.capabilities as PullWorkOrderCandidate['capabilities'],
          }));
          const total = Number((res as { total?: number })?.total ?? candidates.length);
          return { data: candidates, total };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadWorkOrdersFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => record.capabilities?.push_production_picking?.allowed !== true,
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectWorkOrder'));
          return;
        }
        const selected = rows[0];
        if (selected?.capabilities?.push_production_picking?.allowed !== true) {
          const reason = workOrderCapabilityReasonMessage(selected?.capabilities?.push_production_picking?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.warehouseOutbound.pull.woPreviewBlocked'));
          return;
        }
        showPullWoPreview(selectedId);
      },
    });
    pullWoQueryCloseRef.current = pullFromWorkOrderQuery.closeModal;

    const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const res = await listSalesOrders({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
          });
          const data = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullSalesOrderCandidate[] }).data)
            : [];
          const total = Number((res as { total?: number })?.total ?? data.length);
          return { data, total };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadSalesOrdersFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => record.capabilities?.push_sales_delivery?.allowed !== true,
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectSalesOrder'));
          return;
        }
        showPullSoPreview(selectedId);
      },
    });
    pullSoQueryCloseRef.current = pullFromSalesOrderQuery.closeModal;

    const pullFromShipmentNoticeQuery = useUniPullQuery<PullShipmentNoticeCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const res = await shipmentNoticeApi.list({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
          });
          const data = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullShipmentNoticeCandidate[] }).data)
            : Array.isArray(res)
              ? (res as PullShipmentNoticeCandidate[])
              : [];
          const total = Number((res as { total?: number })?.total ?? data.length);
          return { data, total };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadShipmentNoticesFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => record.capabilities?.notify?.allowed !== true,
      onConfirm: async (_keys, rows) => {
        const selected = rows[0];
        if (!selected?.id) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectShipmentNotice'));
          return;
        }
        if (selected.capabilities?.notify?.allowed !== true) {
          const reason = shipmentNoticeCapabilityReasonMessage(selected.capabilities?.notify?.reason, t);
          messageApi.warning(reason || t('app.kuaizhizao.shipmentNotice.notifyPreviewBlocked'));
          return;
        }
        showPullSnPreview(selected);
      },
    });
    pullSnQueryCloseRef.current = pullFromShipmentNoticeQuery.closeModal;

    const pullFromOutsourceWorkOrderQuery = useUniPullQuery<PullOutsourceWoCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim();
          const res = await outsourceWorkOrderApi.list({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: kw || undefined,
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
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadOutsourceFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => record.capabilities?.push_outsource_issue?.allowed !== true,
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectOutsource'));
          return;
        }
        const selected = rows[0];
        if (selected?.capabilities?.push_outsource_issue?.allowed !== true) {
          const reason = outsourceWorkOrderCapabilityReasonMessage(
            selected?.capabilities?.push_outsource_issue?.reason,
            t,
          );
          messageApi.warning(reason || t('app.kuaizhizao.warehouseOutbound.pull.osPreviewBlocked'));
          return;
        }
        showPullOsPreview(selectedId);
      },
    });
    pullOsQueryCloseRef.current = pullFromOutsourceWorkOrderQuery.closeModal;

    useImperativeHandle(ref, () => ({
      open: (key: OutboundQuickPullKey) => {
        if (key === 'work_order') {
          pullFromWorkOrderQuery.openModal();
        } else if (key === 'sales_order') {
          pullFromSalesOrderQuery.openModal();
        } else if (key === 'shipment_notice') {
          pullFromShipmentNoticeQuery.openModal();
        } else {
          pullFromOutsourceWorkOrderQuery.openModal();
        }
      },
    }));

    const workOrderColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colWorkOrderCode'), dataIndex: 'code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colProduct'), dataIndex: 'product_name', ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colSalesOrder'), dataIndex: 'sales_order_code', width: 120, render: (v: string) => v || '—' },
        { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 90, align: 'center' as const },
        { title: t('app.kuaizhizao.warehouseOutbound.field.quantity'), dataIndex: 'quantity', width: 80, align: 'right' as const, render: formatQuantity },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 160,
          render: (v: string) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
      ],
      [t],
    );

    const salesOrderColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colOrderCode'), dataIndex: 'order_code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.customer'), dataIndex: 'customer_name', ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 90, align: 'center' as const },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colOrderQty'), dataIndex: 'total_quantity', width: 100, align: 'right' as const, render: formatQuantity },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 160,
          render: (v: string) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
      ],
      [t],
    );

    const shipmentNoticeColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colShipmentNoticeCode'), dataIndex: 'notice_code', width: 180, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colSalesOrderCode'), dataIndex: 'sales_order_code', width: 160, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.customer'), dataIndex: 'customer_name', width: 160, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.warehouse'), dataIndex: 'warehouse_name', width: 140, ellipsis: true, render: (v: string) => v || '—' },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colNoticeStatus'), dataIndex: 'status', width: 100, align: 'center' as const },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 160,
          render: (v: string) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
        {
          title: t('app.kuaizhizao.warehouseOutbound.pull.linkedDelivery'),
          key: 'linked_delivery',
          width: 170,
          ellipsis: true,
          render: (_: unknown, r: PullShipmentNoticeCandidate) =>
            r.sales_delivery_code ? (
              <Tag color="gold">{r.sales_delivery_code}</Tag>
            ) : (
              '—'
            ),
        },
      ],
      [t],
    );

    const outsourceColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colOutsourceCode'), dataIndex: 'code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colProduct'), dataIndex: 'product_name', width: 150, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colSupplier'), dataIndex: 'supplier_name', width: 150, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 90, align: 'center' as const },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colPlannedQty'), dataIndex: 'quantity', width: 100, align: 'right' as const, render: formatQuantity },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colIssuedQty'), dataIndex: 'issued_quantity', width: 100, align: 'right' as const, render: formatQuantity },
        {
          title: t('app.kuaizhizao.warehouseOutbound.pull.colPendingIssue'),
          key: 'pending_issue',
          width: 100,
          align: 'right' as const,
          render: (_: unknown, r: PullOutsourceWoCandidate) => {
            const pending = Math.max(0, Number(r.quantity || 0) - Number(r.issued_quantity || 0));
            return formatQuantity(pending);
          },
        },
      ],
      [t],
    );

    return (
      <>
        <UniPullQueryModal<PullWorkOrderCandidate>
          title={pullFromWorkOrderAction.label}
          open={pullFromWorkOrderQuery.open}
          onCancel={pullFromWorkOrderQuery.closeModal}
          onOk={pullFromWorkOrderQuery.handleConfirm}
          rowKey="id"
          columns={workOrderColumns}
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
          searchPlaceholder={t('app.kuaizhizao.warehouseOutbound.pull.searchWorkOrder')}
          page={pullFromWorkOrderQuery.page}
          pageSize={pullFromWorkOrderQuery.pageSize}
          total={pullFromWorkOrderQuery.total}
          onPageChange={pullFromWorkOrderQuery.handlePageChange}
          okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
          cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
          okButtonProps={{ disabled: pullFromWorkOrderQuery.selectedRowKeys.length === 0 }}
          width={1200}
          tableScroll={{ x: 1100, y: 360 }}
        />

        <UniPullQueryModal<PullSalesOrderCandidate>
          title={pullFromSalesOrderAction.label}
          open={pullFromSalesOrderQuery.open}
          onCancel={pullFromSalesOrderQuery.closeModal}
          onOk={pullFromSalesOrderQuery.handleConfirm}
          rowKey="id"
          columns={salesOrderColumns}
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
          searchPlaceholder={t('app.kuaizhizao.warehouseOutbound.pull.searchSalesOrder')}
          page={pullFromSalesOrderQuery.page}
          pageSize={pullFromSalesOrderQuery.pageSize}
          total={pullFromSalesOrderQuery.total}
          onPageChange={pullFromSalesOrderQuery.handlePageChange}
          okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
          cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
          okButtonProps={{ disabled: pullFromSalesOrderQuery.selectedRowKeys.length === 0 }}
          width={1200}
          tableScroll={{ x: 1000, y: 360 }}
        />

        <Modal
          title={pullFromSalesOrderAction.label}
          open={pullSoPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullSoPreviewModal}
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          confirmLoading={pullSoPreviewConfirming}
          onOk={() => void (async () => {
            setPullSoPreviewConfirming(true);
            try {
              handlePullSoPreviewConfirm();
            } finally {
              setPullSoPreviewConfirming(false);
            }
          })()}
          okButtonProps={{
            disabled:
              pullSoPreviewLoading ||
              !pullSoPreviewData ||
              !!pullSoPreviewData?.has_blocking_issues,
          }}
        >
          {pullSoPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullSoPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullSoPreviewData.summary}</p>
              {pullSoPreviewData.has_blocking_issues && pullSoPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={salesOrderCapabilityReasonMessage(pullSoPreviewData.blocking_reason, t)}
                />
              ) : null}
              {pullSoPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullSoPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 1180 }}
                  rowSelection={{
                    selectedRowKeys: pullSoSelectedItemIds.map(String),
                    onChange: (keys) => setPullSoSelectedItemIds(keys.map((k) => Number(k))),
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
                    {
                      title: (
                        <>
                          {t('app.kuaizhizao.salesOrder.pushShipmentLineWarehouse')}
                          <Typography.Text type="danger"> *</Typography.Text>
                        </>
                      ),
                      width: 160,
                      render: (_: unknown, row) => {
                        const itemId = Number(row.item_id);
                        const selected = pullSoSelectedItemIds.includes(itemId);
                        return (
                          <Select
                            style={{ width: '100%', minWidth: 140 }}
                            placeholder={t('app.kuaizhizao.shipmentNotice.selectOutboundWarehouse')}
                            showSearch
                            optionFilterProp="label"
                            disabled={!selected}
                            value={pullSoLineWh[itemId]}
                            options={pullSoWarehouseOptions}
                            onChange={(nv) => {
                              setPullSoLineWh((prev) => ({ ...prev, [itemId]: Number(nv) }));
                            }}
                          />
                        );
                      },
                    },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseOutbound.pull.soPreviewNoLines')} />
              )}
              {pullSoPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullSoPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <Modal
          title={pullFromShipmentNoticeAction.label}
          open={pullSnPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullSnPreviewModal}
          okText={pullFromShipmentNoticeAction.label}
          cancelText={t('common.cancel')}
          confirmLoading={pullSnPreviewConfirming}
          onOk={() => void handlePullSnPreviewConfirm()}
          okButtonProps={{
            disabled: pullSnPreviewLoading || !pullSnPreviewData || !!pullSnPreviewData?.has_blocking_issues,
          }}
        >
          {pullSnPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullSnPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullSnPreviewData.summary}</p>
              {pullSnPreviewData.has_blocking_issues ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    (pullSnPreviewData.line_blocking_issues && pullSnPreviewData.line_blocking_issues.length > 0
                      ? pullSnPreviewData.line_blocking_issues.join('；')
                      : null) ||
                    shipmentNoticeCapabilityReasonMessage(pullSnPreviewData.blocking_reason, t) ||
                    t('app.kuaizhizao.shipmentNotice.notifyPreviewBlocked')
                  }
                />
              ) : null}
              {pullSnPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullSnPreviewData.items}
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.notifyPreviewNoLines')} />
              )}
              {pullSnPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullSnPreviewData.tip}
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
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          onOk={handlePullWoPreviewConfirm}
          okButtonProps={{
            disabled:
              pullWoPreviewLoading ||
              !pullWoPreviewData ||
              !!pullWoPreviewData?.has_blocking_issues,
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
                  message={workOrderCapabilityReasonMessage(pullWoPreviewData.blocking_reason, t)}
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
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseOutbound.pull.colPickedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseOutbound.pull.colPickableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseOutbound.pull.woPreviewNoLines')} />
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
          title={pullFromOutsourceWorkOrderAction.label}
          open={pullOsPreviewOpen}
          destroyOnClose
          width={1100}
          onCancel={resetPullOsPreviewModal}
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
          cancelText={t('common.cancel')}
          confirmLoading={pullOsPreviewConfirming}
          onOk={() => void (async () => {
            setPullOsPreviewConfirming(true);
            try {
              handlePullOsPreviewConfirm();
            } finally {
              setPullOsPreviewConfirming(false);
            }
          })()}
          okButtonProps={{
            disabled:
              pullOsPreviewLoading ||
              !pullOsPreviewData ||
              !!pullOsPreviewData?.has_blocking_issues,
          }}
        >
          {pullOsPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullOsPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullOsPreviewData.summary}</p>
              {pullOsPreviewData.has_blocking_issues && pullOsPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    outsourceWorkOrderCapabilityReasonMessage(pullOsPreviewData.blocking_reason, t) ||
                    pullOsPreviewData.blocking_reason
                  }
                />
              ) : null}
              {pullOsPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullOsPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  rowSelection={{
                    selectedRowKeys: pullOsSelectedMaterialIds.map(String),
                    onChange: (keys) => setPullOsSelectedMaterialIds(keys.map((k) => Number(k))),
                    getCheckboxProps: (row) => ({
                      disabled: Number(row.max_push_quantity ?? 0) <= 0,
                    }),
                  }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseOutbound.pull.colIssuedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                    { title: t('app.kuaizhizao.warehouseOutbound.pull.colPendingIssue'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseOutbound.pull.osPreviewNoLines')} />
              )}
              {pullOsPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullOsPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <UniPullQueryModal<PullShipmentNoticeCandidate>
          title={pullFromShipmentNoticeAction.label}
          open={pullFromShipmentNoticeQuery.open}
          onCancel={() => {
            if (pullFromShipmentNoticeQuery.confirmLoading) return;
            pullFromShipmentNoticeQuery.closeModal();
          }}
          onOk={pullFromShipmentNoticeQuery.handleConfirm}
          rowKey="id"
          columns={shipmentNoticeColumns}
          dataSource={pullFromShipmentNoticeQuery.dataSource}
          loading={pullFromShipmentNoticeQuery.loading}
          confirmLoading={pullFromShipmentNoticeQuery.confirmLoading}
          selectionType={pullFromShipmentNoticeQuery.selectionType}
          selectedRowKeys={pullFromShipmentNoticeQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromShipmentNoticeQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromShipmentNoticeQuery.isRowDisabled}
          searchDraft={pullFromShipmentNoticeQuery.searchDraft}
          onSearchDraftChange={pullFromShipmentNoticeQuery.setSearchDraft}
          onSearchApply={pullFromShipmentNoticeQuery.handleSearchApply}
          onSearchClear={pullFromShipmentNoticeQuery.handleSearchClear}
          appliedKeyword={pullFromShipmentNoticeQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseOutbound.pull.searchShipmentNotice')}
          page={pullFromShipmentNoticeQuery.page}
          pageSize={pullFromShipmentNoticeQuery.pageSize}
          total={pullFromShipmentNoticeQuery.total}
          onPageChange={pullFromShipmentNoticeQuery.handlePageChange}
          okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
          cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
          okButtonProps={{ disabled: pullFromShipmentNoticeQuery.selectedRowKeys.length === 0 }}
          width={1240}
          tableScroll={{ x: 1100, y: 360 }}
        />

        <UniPullQueryModal<PullOutsourceWoCandidate>
          title={pullFromOutsourceWorkOrderAction.label}
          open={pullFromOutsourceWorkOrderQuery.open}
          onCancel={pullFromOutsourceWorkOrderQuery.closeModal}
          onOk={pullFromOutsourceWorkOrderQuery.handleConfirm}
          rowKey="id"
          columns={outsourceColumns}
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
          searchPlaceholder={t('app.kuaizhizao.warehouseOutbound.pull.searchOutsource')}
          page={pullFromOutsourceWorkOrderQuery.page}
          pageSize={pullFromOutsourceWorkOrderQuery.pageSize}
          total={pullFromOutsourceWorkOrderQuery.total}
          onPageChange={pullFromOutsourceWorkOrderQuery.handlePageChange}
          okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
          cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
          okButtonProps={{ disabled: pullFromOutsourceWorkOrderQuery.selectedRowKeys.length === 0 }}
          width={1200}
          tableScroll={{ x: 1050, y: 360 }}
        />
      </>
    );
  },
);

OutboundQuickPullModals.displayName = 'OutboundQuickPullModals';

export default OutboundQuickPullModals;
