import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Select } from 'antd';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import {
  UniPullQueryModal,
  isPullableScope,
  renderPullCapabilityTag,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { MaterialStackedCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { listPurchaseOrders } from '../../../services/purchase';
import { formatQuantity } from '../../../../../utils/format';
import { listSalesOrders } from '../../../services/sales-order';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import {
  warehouseApi,
  type OutsourceInboundPullLine,
  type ProductionReturnPullLine,
  type PurchaseReceiptNoticePullLine,
  type PurchaseReceiptOrderPullLine,
  type SalesReturnOrderPullLine,
  type WorkOrderFinishedGoodsPullLine,
} from '../../../services/warehouse-execution';
import {
  workOrderApi,
  outsourceWorkOrderApi,
} from '../../../services/production';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { type InboundOutsourcePullType } from './inboundCreateConfig';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

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

type PullReceiptNoticeCandidate = PurchaseReceiptNoticePullLine;
type PullSalesOrderCandidate = SalesReturnOrderPullLine;
type PullPurchaseOrderCandidate = PurchaseReceiptOrderPullLine;

type PullWorkOrderCandidate = WorkOrderFinishedGoodsPullLine;
type PullProductionReturnCandidate = ProductionReturnPullLine;
type PullOutsourceWoCandidate = OutsourceInboundPullLine;

type InboundQuickPullModalsProps = {
  onSuccess: () => void;
};

const InboundQuickPullModals = forwardRef<InboundQuickPullModalsRef, InboundQuickPullModalsProps>(
  ({ onSuccess }, ref) => {
    const { t } = useTranslation();
    const { message: messageApi } = App.useApp();
    const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_purchase_order');
    const pullFromReceiptNoticeAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_receipt_notice');
    const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order');
    const pullFromProductionReturnAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_work_order_for_production_return');
    const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_sales_order');
    const pullFromOutsourceWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'inbound.pull_from_outsource_work_order');

    const [outsourcePullType, setOutsourcePullType] = useState<InboundOutsourcePullType>('outsource_receipt');
    const [poPullWarehouseOptions, setPoPullWarehouseOptions] = useState<Array<{ label: string; value: number }>>([]);
    const [poPullLineWh, setPoPullLineWh] = useState<Record<number, number>>({});
    const [poPullBatchWarehouseId, setPoPullBatchWarehouseId] = useState<number | undefined>();

    const outsourcePullTypeRef = useRef<InboundOutsourcePullType>('outsource_receipt');
    const pullSourceOrderIdRef = useRef<number | undefined>(undefined);
    const pullSourceNoticeIdRef = useRef<number | undefined>(undefined);
    const pullSourceSalesOrderIdRef = useRef<number | undefined>(undefined);
    const pullSourceWorkOrderIdRef = useRef<number | undefined>(undefined);
    const pullSourceReturnWorkOrderIdRef = useRef<number | undefined>(undefined);
    const pullSourceOutsourceIdRef = useRef<number | undefined>(undefined);
    const [pullSourceOrderId, setPullSourceOrderId] = useState<number | undefined>();
    const [pullSourceNoticeId, setPullSourceNoticeId] = useState<number | undefined>();
    const [pullSourceSalesOrderId, setPullSourceSalesOrderId] = useState<number | undefined>();
    const [pullSourceOrderOptions, setPullSourceOrderOptions] = useState<Array<{ value: number; label: string }>>([]);
    const [pullSourceNoticeOptions, setPullSourceNoticeOptions] = useState<Array<{ value: number; label: string }>>([]);
    const [pullSourceSalesOrderOptions, setPullSourceSalesOrderOptions] = useState<Array<{ value: number; label: string }>>([]);
    const [pullSourceWorkOrderId, setPullSourceWorkOrderId] = useState<number | undefined>();
    const [pullSourceReturnWorkOrderId, setPullSourceReturnWorkOrderId] = useState<number | undefined>();
    const [pullSourceOutsourceId, setPullSourceOutsourceId] = useState<number | undefined>();
    const [pullSourceWorkOrderOptions, setPullSourceWorkOrderOptions] = useState<Array<{ value: number; label: string }>>([]);
    const [pullSourceOutsourceOptions, setPullSourceOutsourceOptions] = useState<Array<{ value: number; label: string }>>([]);

    const pullDocumentScopeOptions = useMemo(
      () => [
        { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
        { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
      ],
      [t],
    );

    const isPullLineSelectable = useCallback(
      (record: { remaining_quantity?: number }) => Number(record.remaining_quantity ?? 0) > 0,
      [],
    );


    const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceOrderIdRef.current = undefined;
        setPullSourceOrderId(undefined);
        setPoPullLineWh({});
        setPoPullBatchWarehouseId(undefined);
        void listPurchaseOrders({ skip: 0, limit: 100 })
          .then((res) => {
            setPullSourceOrderOptions(
              (res?.data ?? [])
                .filter((row) => row.id != null && row.order_code)
                .map((row) => ({ value: row.id!, label: String(row.order_code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.po.loadSourceFailed')));
            setPullSourceOrderOptions([]);
          });
        void masterWarehouseApi
          .list({ is_active: true, limit: 500 })
          .then((whRes) => {
            const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
            setPoPullWarehouseOptions(
              (Array.isArray(whList) ? whList : []).map((w) => {
                const row = w as { id: number; code?: string; name?: string };
                const label = `${row.code || ''} ${row.name || ''}`.trim() || String(row.id);
                return { label, value: row.id };
              }),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.po.loadWarehouseFailed')));
            setPoPullWarehouseOptions([]);
          });
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.purchaseReceipt.listPurchaseOrderPullLines({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            order_id: pullSourceOrderIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.po.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedRows = rows.filter((row) => isPullLineSelectable(row));
        const selectedIds = selectedRows.map((row) => Number(row.id)).filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectLinesFirst'));
          return;
        }
        const lineWarehouses: Record<number, number> = {};
        for (const row of selectedRows) {
          const id = Number(row.id);
          const wh = poPullLineWh[id] ?? (row.warehouse_id != null && Number(row.warehouse_id) > 0
            ? Number(row.warehouse_id)
            : undefined);
          if (wh == null || !(wh > 0)) {
            messageApi.error(
              t('app.kuaizhizao.warehouseInbound.msg.selectWarehouseForMaterial', {
                material: row.material_code || row.material_name || '-',
              }),
            );
            return;
          }
          lineWarehouses[id] = wh;
        }
        try {
          const res = await warehouseApi.purchaseReceipt.pullFromPurchaseOrderItems(selectedIds, {
            lineWarehouses,
          });
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromPurchaseOrderAction.sourceLabel,
                target: pullFromPurchaseOrderAction.targetLabel,
              }),
          );
          pullFromPurchaseOrderQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromPurchaseOrderAction.sourceLabel,
                target: pullFromPurchaseOrderAction.targetLabel,
              }),
            ),
          );
        }
      },
    });

    useEffect(() => {
      if (!pullFromPurchaseOrderQuery.open) return;
      const rows = pullFromPurchaseOrderQuery.dataSource;
      if (!rows.length) return;
      setPoPullLineWh((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const row of rows) {
          const id = Number(row.id);
          if (!(id > 0) || next[id] != null) continue;
          const suggested = Number(row.warehouse_id);
          if (Number.isFinite(suggested) && suggested > 0) {
            next[id] = suggested;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [pullFromPurchaseOrderQuery.open, pullFromPurchaseOrderQuery.dataSource]);

    const applyPoPullBatchWarehouse = useCallback(
      (warehouseId: number) => {
        setPoPullBatchWarehouseId(warehouseId);
        const targetIds =
          pullFromPurchaseOrderQuery.selectedRowKeys.length > 0
            ? pullFromPurchaseOrderQuery.selectedRowKeys.map((k) => Number(k)).filter((id) => id > 0)
            : pullFromPurchaseOrderQuery.dataSource.map((row) => Number(row.id)).filter((id) => id > 0);
        if (!targetIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.batchWarehouseNoLines'));
          return;
        }
        setPoPullLineWh((prev) => {
          const next = { ...prev };
          for (const id of targetIds) next[id] = warehouseId;
          return next;
        });
        messageApi.success(
          t('app.kuaizhizao.warehouseInbound.msg.batchWarehouseApplied', { count: targetIds.length }),
        );
      },
      [
        messageApi,
        pullFromPurchaseOrderQuery.dataSource,
        pullFromPurchaseOrderQuery.selectedRowKeys,
        t,
      ],
    );

    const pullFromReceiptNoticeQuery = useUniPullQuery<PullReceiptNoticeCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceNoticeIdRef.current = undefined;
        setPullSourceNoticeId(undefined);
        void receiptNoticeApi.list({ skip: 0, limit: 100 })
          .then((res) => {
            const rows = Array.isArray((res as { data?: Array<{ id?: number; notice_code?: string }> })?.data)
              ? (res as { data: Array<{ id?: number; notice_code?: string }> }).data
              : Array.isArray(res)
                ? (res as Array<{ id?: number; notice_code?: string }>)
                : [];
            setPullSourceNoticeOptions(
              rows
                .filter((row) => row.id != null && row.notice_code)
                .map((row) => ({ value: row.id!, label: String(row.notice_code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.loadSourceFailed')));
            setPullSourceNoticeOptions([]);
          });
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.purchaseReceipt.listReceiptNoticePullLines({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            notice_id: pullSourceNoticeIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedIds = rows
          .filter((row) => isPullLineSelectable(row))
          .map((row) => Number(row.id))
          .filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.selectLinesFirst'));
          return;
        }
        try {
          const res = await warehouseApi.purchaseReceipt.pullFromReceiptNoticeItems(selectedIds);
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromReceiptNoticeAction.sourceLabel,
                target: pullFromReceiptNoticeAction.targetLabel,
              }),
          );
          pullFromReceiptNoticeQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromReceiptNoticeAction.sourceLabel,
                target: pullFromReceiptNoticeAction.targetLabel,
              }),
            ),
          );
        }
      },
    });

    const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceWorkOrderIdRef.current = undefined;
        setPullSourceWorkOrderId(undefined);
        void workOrderApi.list({ skip: 0, limit: 100 })
          .then((res) => {
            const rows = Array.isArray((res as { data?: Array<{ id?: number; code?: string }> })?.data)
              ? (res as { data: Array<{ id?: number; code?: string }> }).data
              : Array.isArray((res as { items?: Array<{ id?: number; code?: string }> })?.items)
                ? (res as { items: Array<{ id?: number; code?: string }> }).items
                : Array.isArray(res)
                  ? (res as Array<{ id?: number; code?: string }>)
                  : [];
            setPullSourceWorkOrderOptions(
              rows
                .filter((row) => row.id != null && row.code)
                .map((row) => ({ value: row.id!, label: String(row.code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadSourceFailed')));
            setPullSourceWorkOrderOptions([]);
          });
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.finishedGoodsReceipt.listWorkOrderPullLines({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            work_order_id: pullSourceWorkOrderIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedIds = rows
          .filter((row) => isPullLineSelectable(row))
          .map((row) => Number(row.id))
          .filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectLinesFirst'));
          return;
        }
        try {
          const res = await warehouseApi.finishedGoodsReceipt.pullFromWorkOrders(selectedIds);
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromWorkOrderAction.sourceLabel,
                target: pullFromWorkOrderAction.targetLabel,
              }),
          );
          pullFromWorkOrderQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromWorkOrderAction.sourceLabel,
                target: pullFromWorkOrderAction.targetLabel,
              }),
            ),
          );
        }
      },
    });

    const pullFromProductionReturnQuery = useUniPullQuery<PullProductionReturnCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceReturnWorkOrderIdRef.current = undefined;
        setPullSourceReturnWorkOrderId(undefined);
        void workOrderApi.list({ skip: 0, limit: 100 })
          .then((res) => {
            const rows = Array.isArray((res as { data?: Array<{ id?: number; code?: string }> })?.data)
              ? (res as { data: Array<{ id?: number; code?: string }> }).data
              : Array.isArray((res as { items?: Array<{ id?: number; code?: string }> })?.items)
                ? (res as { items: Array<{ id?: number; code?: string }> }).items
                : Array.isArray(res)
                  ? (res as Array<{ id?: number; code?: string }>)
                  : [];
            setPullSourceWorkOrderOptions(
              rows
                .filter((row) => row.id != null && row.code)
                .map((row) => ({ value: row.id!, label: String(row.code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.productionReturn.loadSourceFailed')));
            setPullSourceWorkOrderOptions([]);
          });
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.productionReturn.listPickingItemPullLines({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            work_order_id: pullSourceReturnWorkOrderIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.productionReturn.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedIds = rows
          .filter((row) => isPullLineSelectable(row))
          .map((row) => Number(row.id))
          .filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.productionReturn.selectLinesFirst'));
          return;
        }
        try {
          const res = await warehouseApi.productionReturn.pullFromPickingItems(selectedIds);
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromProductionReturnAction.sourceLabel,
                target: pullFromProductionReturnAction.targetLabel,
              }),
          );
          pullFromProductionReturnQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromProductionReturnAction.sourceLabel,
                target: pullFromProductionReturnAction.targetLabel,
              }),
            ),
          );
        }
      },
    });

    const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceSalesOrderIdRef.current = undefined;
        setPullSourceSalesOrderId(undefined);
        void listSalesOrders({ skip: 0, limit: 100 })
          .then((res) => {
            const rows = Array.isArray((res as { data?: Array<{ id?: number; order_code?: string }> })?.data)
              ? (res as { data: Array<{ id?: number; order_code?: string }> }).data
              : [];
            setPullSourceSalesOrderOptions(
              rows
                .filter((row) => row.id != null && row.order_code)
                .map((row) => ({ value: row.id!, label: String(row.order_code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.salesReturn.loadSourceFailed')));
            setPullSourceSalesOrderOptions([]);
          });
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.salesReturn.listSalesOrderPullLines({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            sales_order_id: pullSourceSalesOrderIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.salesReturn.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedIds = rows
          .filter((row) => isPullLineSelectable(row))
          .map((row) => Number(row.id))
          .filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.selectLinesFirst'));
          return;
        }
        try {
          const res = await warehouseApi.salesReturn.pullFromSalesOrderItems(selectedIds);
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromSalesOrderAction.sourceLabel,
                target: pullFromSalesOrderAction.targetLabel,
              }),
          );
          pullFromSalesOrderQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromSalesOrderAction.sourceLabel,
                target: pullFromSalesOrderAction.targetLabel,
              }),
            ),
          );
        }
      },
    });

    const pullFromOutsourceWorkOrderQuery = useUniPullQuery<PullOutsourceWoCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      scopeOptions: pullDocumentScopeOptions,
      defaultScope: 'pullable',
      onOpen: () => {
        pullSourceOutsourceIdRef.current = undefined;
        setPullSourceOutsourceId(undefined);
        void outsourceWorkOrderApi.list({ skip: 0, limit: 100 })
          .then((res) => {
            const rows = Array.isArray((res as { data?: Array<{ id?: number; code?: string }> })?.data)
              ? (res as { data: Array<{ id?: number; code?: string }> }).data
              : Array.isArray(res)
                ? (res as Array<{ id?: number; code?: string }>)
                : [];
            setPullSourceOutsourceOptions(
              rows
                .filter((row) => row.id != null && row.code)
                .map((row) => ({ value: row.id!, label: String(row.code) })),
            );
          })
          .catch((error: unknown) => {
            messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.outsource.loadSourceFailed')));
            setPullSourceOutsourceOptions([]);
          });
      },
      onClose: () => {
        setOutsourcePullType('outsource_receipt');
      },
      loadData: async ({ keyword, page, pageSize, scope }) => {
        try {
          const listRes = await warehouseApi.outsourceInbound.listPullLines({
            pull_type: outsourcePullTypeRef.current,
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
            outsource_work_order_id: pullSourceOutsourceIdRef.current,
            pullable_only: isPullableScope(scope),
          });
          return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
        } catch (error: unknown) {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.warehouseInbound.pull.outsource.loadFailed')));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !isPullLineSelectable(record),
      onConfirm: async (_keys, rows) => {
        const selectedIds = rows
          .filter((row) => isPullLineSelectable(row))
          .map((row) => Number(row.id))
          .filter((id) => id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.outsource.selectLinesFirst'));
          return;
        }
        try {
          const res = await warehouseApi.outsourceInbound.pullFromItems(selectedIds, outsourcePullTypeRef.current);
          messageApi.success(
            res.message ||
              t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
                source: pullFromOutsourceWorkOrderAction.sourceLabel,
                target: pullFromOutsourceWorkOrderAction.targetLabel,
              }),
          );
          pullFromOutsourceWorkOrderQuery.closeModal();
          onSuccess();
        } catch (error: unknown) {
          messageApi.error(
            getApiErrorMessage(
              error,
              t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
                source: pullFromOutsourceWorkOrderAction.sourceLabel,
                target: pullFromOutsourceWorkOrderAction.targetLabel,
              }),
            ),
          );
        }
      },
    });
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
        { title: t('app.kuaizhizao.warehouseInbound.col.poCode'), dataIndex: 'order_code', width: 150, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullPurchaseOrderCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
          key: 'warehouse',
          width: 150,
          render: (_: unknown, record: PullPurchaseOrderCandidate) => (
            <Select
              style={{ width: '100%', minWidth: 118 }}
              size="small"
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaizhizao.warehouseInbound.field.select')}
              value={poPullLineWh[record.id]}
              options={poPullWarehouseOptions}
              onChange={(value) => {
                const nextId = Number(value);
                if (!(Number.isFinite(nextId) && nextId > 0)) return;
                setPoPullLineWh((prev) => ({ ...prev, [record.id]: nextId }));
              }}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 88,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 88,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 88,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.supplier'), dataIndex: 'supplier_name', width: 120, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 96,
          align: 'center' as const,
          render: (_: unknown, record: PullPurchaseOrderCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
        },
      ],
      [poPullLineWh, poPullWarehouseOptions, t],
    );

    const receiptNoticePullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.noticeCode'), dataIndex: 'notice_code', width: 168, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullReceiptNoticeCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.supplier'), dataIndex: 'supplier_name', width: 140, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, record: PullReceiptNoticeCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
        },
      ],
      [t],
    );

    const workOrderPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderCode'), dataIndex: 'work_order_code', width: 168, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullWorkOrderCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, record: PullWorkOrderCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
        },
      ],
      [t],
    );

    const productionReturnPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.workOrderCode'), dataIndex: 'work_order_code', width: 168, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseInbound.pull.productionReturn.pickingLabel'), dataIndex: 'picking_code', width: 168, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullProductionReturnCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, record: PullProductionReturnCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
        },
      ],
      [t],
    );

    const salesReturnPullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.salesOrderCode'), dataIndex: 'order_code', width: 168, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullSalesOrderCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.customer'), dataIndex: 'customer_name', width: 140, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, record: PullSalesOrderCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
        },
      ],
      [t],
    );

    const outsourcePullColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseInbound.col.outsourceWoCode'), dataIndex: 'outsource_work_order_code', width: 168, ellipsis: true },
        {
          title: t('app.kuaizhizao.salesOrder.materialName'),
          dataIndex: 'material_name',
          ellipsis: true,
          render: (_: unknown, record: PullOutsourceWoCandidate) => (
            <MaterialStackedCell
              material_name={record.material_name}
              material_code={record.material_code}
              material_spec={record.material_spec}
            />
          ),
        },
        {
          title: t('common.quantity'),
          dataIndex: 'suggested_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippedQty'),
          dataIndex: 'pushed_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        {
          title: t('app.kuaizhizao.salesOrder.colShippableQty'),
          dataIndex: 'remaining_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatQuantity(v),
        },
        { title: t('app.kuaizhizao.warehouseInbound.col.outsourceSupplier'), dataIndex: 'supplier_name', width: 140, ellipsis: true },
        {
          title: t('app.kuaizhizao.warehouseInbound.pull.gateStatus'),
          key: 'convert_status',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, record: PullOutsourceWoCandidate) =>
            renderPullCapabilityTag(
              Number(record.remaining_quantity ?? 0) > 0,
              t('app.kuaizhizao.warehouseInbound.pull.canCreate'),
              t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
            ),
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
          selectedRows={pullFromPurchaseOrderQuery.selectedRows}
          onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
          searchDraft={pullFromPurchaseOrderQuery.searchDraft}
          onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
          onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
          onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
          appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.po.searchPlaceholder')}
          filterExtra={(
            <>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('app.kuaizhizao.warehouseInbound.pull.po.sourceDocPlaceholder')}
                style={{ width: 200, flexShrink: 0 }}
                value={pullSourceOrderId}
                options={pullSourceOrderOptions}
                onChange={(value) => {
                  const nextId = Number(value);
                  const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                  pullSourceOrderIdRef.current = next;
                  setPullSourceOrderId(next);
                  pullFromPurchaseOrderQuery.handleSelectedRowKeysChange([], []);
                  pullFromPurchaseOrderQuery.handleSearchApply(pullFromPurchaseOrderQuery.appliedKeyword);
                }}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('app.kuaizhizao.warehouseInbound.pull.po.batchWarehousePlaceholder')}
                style={{ width: 180, flexShrink: 0 }}
                value={poPullBatchWarehouseId}
                options={poPullWarehouseOptions}
                onChange={(value) => {
                  if (value == null) {
                    setPoPullBatchWarehouseId(undefined);
                    return;
                  }
                  const nextId = Number(value);
                  if (Number.isFinite(nextId) && nextId > 0) {
                    applyPoPullBatchWarehouse(nextId);
                  }
                }}
              />
            </>
          )}
          getRowLabel={(row) => [row.order_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromPurchaseOrderQuery.page}
          pageSize={pullFromPurchaseOrderQuery.pageSize}
          total={pullFromPurchaseOrderQuery.total}
          onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
          scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
          scope={pullFromPurchaseOrderQuery.scope}
          onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.po.ok')}
          footerHint={t('app.kuaizhizao.warehouseInbound.pull.po.warehouseHint')}
        />


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
          selectedRows={pullFromReceiptNoticeQuery.selectedRows}
          onSelectedRowKeysChange={pullFromReceiptNoticeQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromReceiptNoticeQuery.isRowDisabled}
          searchDraft={pullFromReceiptNoticeQuery.searchDraft}
          onSearchDraftChange={pullFromReceiptNoticeQuery.setSearchDraft}
          onSearchApply={pullFromReceiptNoticeQuery.handleSearchApply}
          onSearchClear={pullFromReceiptNoticeQuery.handleSearchClear}
          appliedKeyword={pullFromReceiptNoticeQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.searchPlaceholder')}
          filterExtra={(
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.sourceDocPlaceholder')}
              style={{ width: 220, flexShrink: 0 }}
              value={pullSourceNoticeId}
              options={pullSourceNoticeOptions}
              onChange={(value) => {
                const nextId = Number(value);
                const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                pullSourceNoticeIdRef.current = next;
                setPullSourceNoticeId(next);
                pullFromReceiptNoticeQuery.handleSelectedRowKeysChange([], []);
                pullFromReceiptNoticeQuery.handleSearchApply(pullFromReceiptNoticeQuery.appliedKeyword);
              }}
            />
          )}
          getRowLabel={(row) => [row.notice_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromReceiptNoticeQuery.page}
          pageSize={pullFromReceiptNoticeQuery.pageSize}
          total={pullFromReceiptNoticeQuery.total}
          onPageChange={pullFromReceiptNoticeQuery.handlePageChange}
          scopeOptions={pullFromReceiptNoticeQuery.scopeOptions}
          scope={pullFromReceiptNoticeQuery.scope}
          onScopeChange={pullFromReceiptNoticeQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.ok')}
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
          selectedRows={pullFromWorkOrderQuery.selectedRows}
          onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromWorkOrderQuery.isRowDisabled}
          searchDraft={pullFromWorkOrderQuery.searchDraft}
          onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
          onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
          onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
          appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.searchPlaceholder')}
          filterExtra={(
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.sourceDocPlaceholder')}
              style={{ width: 220, flexShrink: 0 }}
              value={pullSourceWorkOrderId}
              options={pullSourceWorkOrderOptions}
              onChange={(value) => {
                const nextId = Number(value);
                const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                pullSourceWorkOrderIdRef.current = next;
                setPullSourceWorkOrderId(next);
                pullFromWorkOrderQuery.handleSelectedRowKeysChange([], []);
                pullFromWorkOrderQuery.handleSearchApply(pullFromWorkOrderQuery.appliedKeyword);
              }}
            />
          )}
          getRowLabel={(row) => [row.work_order_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromWorkOrderQuery.page}
          pageSize={pullFromWorkOrderQuery.pageSize}
          total={pullFromWorkOrderQuery.total}
          onPageChange={pullFromWorkOrderQuery.handlePageChange}
          scopeOptions={pullFromWorkOrderQuery.scopeOptions}
          scope={pullFromWorkOrderQuery.scope}
          onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.workOrder.ok')}
        />

        <UniPullQueryModal<PullProductionReturnCandidate>
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
          selectedRows={pullFromProductionReturnQuery.selectedRows}
          onSelectedRowKeysChange={pullFromProductionReturnQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromProductionReturnQuery.isRowDisabled}
          searchDraft={pullFromProductionReturnQuery.searchDraft}
          onSearchDraftChange={pullFromProductionReturnQuery.setSearchDraft}
          onSearchApply={pullFromProductionReturnQuery.handleSearchApply}
          onSearchClear={pullFromProductionReturnQuery.handleSearchClear}
          appliedKeyword={pullFromProductionReturnQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.searchPlaceholder')}
          filterExtra={(
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.sourceDocPlaceholder')}
              style={{ width: 220, flexShrink: 0 }}
              value={pullSourceReturnWorkOrderId}
              options={pullSourceWorkOrderOptions}
              onChange={(value) => {
                const nextId = Number(value);
                const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                pullSourceReturnWorkOrderIdRef.current = next;
                setPullSourceReturnWorkOrderId(next);
                pullFromProductionReturnQuery.handleSelectedRowKeysChange([], []);
                pullFromProductionReturnQuery.handleSearchApply(pullFromProductionReturnQuery.appliedKeyword);
              }}
            />
          )}
          getRowLabel={(row) => [row.work_order_code, row.picking_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromProductionReturnQuery.page}
          pageSize={pullFromProductionReturnQuery.pageSize}
          total={pullFromProductionReturnQuery.total}
          onPageChange={pullFromProductionReturnQuery.handlePageChange}
          scopeOptions={pullFromProductionReturnQuery.scopeOptions}
          scope={pullFromProductionReturnQuery.scope}
          onScopeChange={pullFromProductionReturnQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.ok')}
        />

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
          selectedRows={pullFromSalesOrderQuery.selectedRows}
          onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromSalesOrderQuery.isRowDisabled}
          searchDraft={pullFromSalesOrderQuery.searchDraft}
          onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
          onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
          onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
          appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.searchPlaceholder')}
          filterExtra={(
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.sourceDocPlaceholder')}
              style={{ width: 220, flexShrink: 0 }}
              value={pullSourceSalesOrderId}
              options={pullSourceSalesOrderOptions}
              onChange={(value) => {
                const nextId = Number(value);
                const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                pullSourceSalesOrderIdRef.current = next;
                setPullSourceSalesOrderId(next);
                pullFromSalesOrderQuery.handleSelectedRowKeysChange([], []);
                pullFromSalesOrderQuery.handleSearchApply(pullFromSalesOrderQuery.appliedKeyword);
              }}
            />
          )}
          getRowLabel={(row) => [row.order_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromSalesOrderQuery.page}
          pageSize={pullFromSalesOrderQuery.pageSize}
          total={pullFromSalesOrderQuery.total}
          onPageChange={pullFromSalesOrderQuery.handlePageChange}
          scopeOptions={pullFromSalesOrderQuery.scopeOptions}
          scope={pullFromSalesOrderQuery.scope}
          onScopeChange={pullFromSalesOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.ok')}
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
          selectedRows={pullFromOutsourceWorkOrderQuery.selectedRows}
          onSelectedRowKeysChange={pullFromOutsourceWorkOrderQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromOutsourceWorkOrderQuery.isRowDisabled}
          searchDraft={pullFromOutsourceWorkOrderQuery.searchDraft}
          onSearchDraftChange={pullFromOutsourceWorkOrderQuery.setSearchDraft}
          onSearchApply={pullFromOutsourceWorkOrderQuery.handleSearchApply}
          onSearchClear={pullFromOutsourceWorkOrderQuery.handleSearchClear}
          appliedKeyword={pullFromOutsourceWorkOrderQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.outsource.searchPlaceholder')}
          filterExtra={(
            <>
              <ThemedSegmented
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
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('app.kuaizhizao.warehouseInbound.pull.outsource.sourceDocPlaceholder')}
                style={{ width: 220, flexShrink: 0 }}
                value={pullSourceOutsourceId}
                options={pullSourceOutsourceOptions}
                onChange={(value) => {
                  const nextId = Number(value);
                  const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
                  pullSourceOutsourceIdRef.current = next;
                  setPullSourceOutsourceId(next);
                  pullFromOutsourceWorkOrderQuery.handleSelectedRowKeysChange([], []);
                  pullFromOutsourceWorkOrderQuery.handleSearchApply(pullFromOutsourceWorkOrderQuery.appliedKeyword);
                }}
              />
            </>
          )}
          getRowLabel={(row) => [row.outsource_work_order_code, row.material_code].filter(Boolean).join(' ')}
          page={pullFromOutsourceWorkOrderQuery.page}
          pageSize={pullFromOutsourceWorkOrderQuery.pageSize}
          total={pullFromOutsourceWorkOrderQuery.total}
          onPageChange={pullFromOutsourceWorkOrderQuery.handlePageChange}
          scopeOptions={pullFromOutsourceWorkOrderQuery.scopeOptions}
          scope={pullFromOutsourceWorkOrderQuery.scope}
          onScopeChange={pullFromOutsourceWorkOrderQuery.handleScopeChange}
          okText={t('app.kuaizhizao.warehouseInbound.pull.outsource.ok')}
        />
      </>
    );
  },
);

InboundQuickPullModals.displayName = 'InboundQuickPullModals';

export default InboundQuickPullModals;
