import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { App, Tag } from 'antd';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  listPurchaseReceiptPullCandidates,
} from '../../../services/purchase';
import {
  formatPullPercent,
  formatPullQty,
  renderLifecycleSubStageTag,
  renderPullableTag,
} from './inboundPullModalUtils';
import { listSalesOrders } from '../../../services/sales-order';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import { workOrderApi, outsourceWorkOrderApi } from '../../../services/production';
import {
  OUTSOURCE_WORK_ORDER_ELIGIBLE_STATUSES,
  PRODUCTION_WORK_ORDER_ELIGIBLE_STATUSES,
  type InboundOutsourcePullType,
} from './inboundCreateConfig';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import {
  inboundOutsourceEntryPath,
  inboundPoEntryPath,
  inboundProductionReturnEntryPath,
  inboundSalesReturnEntryPath,
  inboundWorkOrderEntryPath,
} from './inboundPaths';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

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

type PullReceiptNoticeCandidate = {
  id: number;
  notice_code?: string;
  purchase_order_code?: string;
  supplier_name?: string;
  warehouse_name?: string;
  status?: string;
  updated_at?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  converted?: boolean;
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
  pullable?: boolean;
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

    const outsourcePullTypeOptions = useMemo(
      (): { label: string; value: InboundOutsourcePullType }[] => [
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.receipt'), value: 'outsource_receipt' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.materialReturn'), value: 'outsource_material_return' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.productReturn'), value: 'outsource_product_return' },
      ],
      [t],
    );

    const loadWorkOrderCandidates = useCallback(async (keyword: string = '') => {
      const kw = keyword.trim();
      const woRes = await workOrderApi.list({
        skip: 0,
        limit: 200,
        keyword: kw || undefined,
      });
      const woList = Array.isArray(woRes)
        ? woRes
        : (woRes as { data?: unknown[]; items?: unknown[] })?.data
          ?? (woRes as { items?: unknown[] })?.items
          ?? [];
      return (Array.isArray(woList) ? woList : [])
        .filter((wo: { status?: string; row_kind?: string }) =>
          PRODUCTION_WORK_ORDER_ELIGIBLE_STATUSES.includes(String(wo.status || ''))
          && (!wo.row_kind || wo.row_kind === 'work_order'),
        )
        .filter((wo: { code?: string; product_name?: string; name?: string; sales_order_code?: string }) => {
          if (!kw) return true;
          const text = `${wo.code || ''} ${wo.product_name || wo.name || ''} ${wo.sales_order_code || ''}`.toLowerCase();
          return text.includes(kw.toLowerCase());
        })
        .map((wo: {
          id?: number;
          code?: string;
          product_name?: string;
          name?: string;
          sales_order_code?: string;
          status?: string;
          quantity?: number;
          completed_quantity?: number;
          updated_at?: string;
        }) => ({
          id: Number(wo.id),
          code: wo.code,
          product_name: wo.product_name || wo.name,
          sales_order_code: wo.sales_order_code,
          status: wo.status,
          quantity: Number(wo.quantity ?? 0) || undefined,
          completed_quantity: Number(wo.completed_quantity ?? 0) || undefined,
          updated_at: wo.updated_at,
        }));
    }, []);

    const loadOutsourceWorkOrderCandidates = useCallback(async (keyword: string = '') => {
      const kw = keyword.trim();
      const res = await outsourceWorkOrderApi.list({
        skip: 0,
        limit: 200,
        keyword: kw || undefined,
      });
      const rows = Array.isArray(res)
        ? res
        : (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? [];
      return (Array.isArray(rows) ? rows : [])
        .filter((r: { status?: string }) =>
          OUTSOURCE_WORK_ORDER_ELIGIBLE_STATUSES.includes(String(r.status || '')),
        )
        .filter((r: { code?: string; product_name?: string; productName?: string; supplier_name?: string }) => {
          if (!kw) return true;
          const text = `${r.code || ''} ${r.product_name || r.productName || ''} ${r.supplier_name || ''}`.toLowerCase();
          return text.includes(kw.toLowerCase());
        })
        .map((r: {
          id?: number;
          code?: string;
          product_name?: string;
          productName?: string;
          supplier_name?: string;
          status?: string;
          quantity?: number;
          received_quantity?: number;
          issued_quantity?: number;
          updated_at?: string;
        }) => ({
          id: Number(r.id),
          code: r.code,
          product_name: r.product_name || r.productName,
          supplier_name: r.supplier_name,
          status: r.status,
          quantity: Number(r.quantity ?? 0) || undefined,
          received_quantity: Number(r.received_quantity ?? 0) || undefined,
          issued_quantity: Number(r.issued_quantity ?? 0) || undefined,
          updated_at: r.updated_at,
        }));
    }, []);

    const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
      rowKey: 'id',
      selectionType: 'checkbox',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const res = await listPurchaseReceiptPullCandidates({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: keyword.trim() || undefined,
          });
          const data = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: PullPurchaseOrderCandidate[] }).data)
            : [];
          const total = Number((res as { total?: number })?.total ?? data.length);
          return { data, total };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.po.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => record.pullable === false,
      onConfirm: async (keys, rows) => {
        const selectedIds = keys
          .map((key) => Number(key))
          .filter((id) => Number.isFinite(id) && id > 0);
        if (!selectedIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectAtLeastOne'));
          return;
        }
        const pullableRows = rows.filter((row) => row.pullable !== false);
        if (!pullableRows.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.allCompleted'));
          return;
        }
        if (pullableRows.length !== 1) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectOnlyOne'));
          return;
        }
        pullFromPurchaseOrderQuery.closeModal();
        navigate(inboundPoEntryPath(pullableRows[0].id));
      },
    });

    const pullFromReceiptNoticeQuery = useUniPullQuery<PullReceiptNoticeCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim().toLowerCase();
          const rnRes = await receiptNoticeApi.list({ skip: 0, limit: 200 });
          const rnData = (rnRes as { data?: unknown[]; items?: unknown[] })?.data
            ?? (rnRes as { items?: unknown[] })?.items
            ?? rnRes
            ?? [];
          const rnList = Array.isArray(rnData) ? rnData : [];
          const candidates = rnList
            .filter((n: { status?: string }) => ['待收货', '已通知'].includes(String(n?.status || '')))
            .filter((n: {
              notice_code?: string;
              purchase_order_code?: string;
              supplier_name?: string;
            }) => {
              if (!kw) return true;
              const text = `${n.notice_code || ''} ${n.purchase_order_code || ''} ${n.supplier_name || ''}`.toLowerCase();
              return text.includes(kw);
            })
            .map((n: {
              id?: number;
              notice_code?: string;
              purchase_order_code?: string;
              supplier_name?: string;
              warehouse_name?: string;
              status?: string;
              updated_at?: string;
              purchase_receipt_id?: number;
              purchase_receipt_code?: string;
            }) => ({
              id: Number(n.id),
              notice_code: n.notice_code,
              purchase_order_code: n.purchase_order_code,
              supplier_name: n.supplier_name,
              warehouse_name: n.warehouse_name,
              status: n.status,
              updated_at: n.updated_at,
              purchase_receipt_id: n.purchase_receipt_id,
              purchase_receipt_code: n.purchase_receipt_code,
              converted: !!n.purchase_receipt_id,
            }));
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !!record.converted,
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.selectRequired'));
          return;
        }
        const selected = rows[0];
        if (selected?.converted) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.alreadyConverted'));
          return;
        }
        try {
          const notice = (await receiptNoticeApi.get(String(selectedId))) as { purchase_order_id?: number };
          const poId = Number(notice?.purchase_order_id);
          if (!Number.isFinite(poId) || poId <= 0) {
            messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.noLinkedPo'));
            return;
          }
          pullFromReceiptNoticeQuery.closeModal();
          navigate(inboundPoEntryPath(poId));
        } catch (error: unknown) {
          const err = error as { response?: { data?: { detail?: string | { message?: string } } }; message?: string };
          const detail = err?.response?.data?.detail;
          const message =
            (typeof detail === 'string' ? detail : (detail as { message?: string })?.message)
            || err?.message
            || t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.loadFailed');
          messageApi.error(message);
        }
      },
    });

    const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const candidates = await loadWorkOrderCandidates(keyword);
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectRequired'));
          return;
        }
        pullFromWorkOrderQuery.closeModal();
        navigate(inboundWorkOrderEntryPath(selectedId));
      },
    });

    const pullFromProductionReturnQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const candidates = await loadWorkOrderCandidates(keyword);
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectRequired'));
          return;
        }
        pullFromProductionReturnQuery.closeModal();
        navigate(inboundProductionReturnEntryPath(selectedId));
      },
    });

    const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim();
          const res = await listSalesOrders({
            skip: (page - 1) * pageSize,
            limit: pageSize,
            keyword: kw || undefined,
          });
          const orders = Array.isArray((res as { data?: unknown[] })?.data)
            ? ((res as { data: unknown[] }).data)
            : [];
          const candidates = orders.map((order: Record<string, unknown>) => ({
            id: Number(order.id),
            order_code: String(order.order_code || ''),
            customer_name: String(order.customer_name || ''),
            status: String(order.status || ''),
            delivery_date: order.delivery_date ? String(order.delivery_date) : undefined,
            updated_at: order.updated_at ? String(order.updated_at) : undefined,
            total_quantity: Number(order.total_quantity ?? 0) || undefined,
            delivery_progress: order.delivery_progress != null ? Number(order.delivery_progress) : null,
          }));
          const total = Number((res as { total?: number })?.total ?? candidates.length);
          return { data: candidates, total };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.selectRequired'));
          return;
        }
        pullFromSalesOrderQuery.closeModal();
        navigate(inboundSalesReturnEntryPath(selectedId));
      },
    });

    const pullFromOutsourceWorkOrderQuery = useUniPullQuery<PullOutsourceWoCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      onClose: () => {
        setOutsourcePullType('outsource_receipt');
      },
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const candidates = await loadOutsourceWorkOrderCandidates(keyword);
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.outsource.loadFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.outsource.selectRequired'));
          return;
        }
        pullFromOutsourceWorkOrderQuery.closeModal();
        navigate(inboundOutsourceEntryPath(selectedId, outsourcePullType));
      },
    });

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
          render: (_: unknown, r: PullPurchaseOrderCandidate) => formatPullQty(r.ordered_total ?? r.total_quantity),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.receivedQty'),
          dataIndex: 'received_total',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatPullQty(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.outstandingQty'),
          dataIndex: 'outstanding_total',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatPullQty(v),
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
          title: t('app.kuaizhizao.warehouseInbound.col.pullable'),
          key: 'pullable',
          width: 100,
          align: 'center' as const,
          render: (_: unknown, r: PullPurchaseOrderCandidate) => renderPullableTag(t, r.pullable),
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
          render: (v: unknown) => formatDateTimeBySiteSetting(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.convertStatus'),
          key: 'convert_status',
          width: 170,
          align: 'center' as const,
          render: (_: unknown, r: PullReceiptNoticeCandidate) =>
            r.converted ? (
              <Tag color="gold">
                {t('app.kuaizhizao.warehouseInbound.pull.convertCreated', {
                  code: r.purchase_receipt_code || r.purchase_receipt_id,
                })}
              </Tag>
            ) : (
              <Tag color="success">{t('app.kuaizhizao.warehouseInbound.pull.convertAvailable')}</Tag>
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
          render: (v: unknown) => formatDateTimeBySiteSetting(v),
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
          render: (v: unknown) => formatPullQty(v),
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
          render: (v: unknown) => formatDateTimeBySiteSetting(v),
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
          render: (v: unknown) => formatPullQty(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.receivedOutsourceQty'),
          dataIndex: 'received_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatPullQty(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.issuedQty'),
          dataIndex: 'issued_quantity',
          width: 100,
          align: 'right' as const,
          render: (v: unknown) => formatPullQty(v),
        },
        {
          title: t('app.kuaizhizao.warehouseInbound.col.pendingOutsourceReceipt'),
          key: 'pending_receipt',
          width: 100,
          align: 'right' as const,
          render: (_: unknown, r: PullOutsourceWoCandidate) => {
            const pending = Math.max(0, Number(r.quantity || 0) - Number(r.received_quantity || 0));
            return formatPullQty(pending);
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
          okText={t('app.kuaizhizao.warehouseInbound.action.inbound')}
          width={1280}
          tableScroll={{ x: 1200, y: 360 }}
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
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
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
          searchDraft={pullFromProductionReturnQuery.searchDraft}
          onSearchDraftChange={pullFromProductionReturnQuery.setSearchDraft}
          onSearchApply={pullFromProductionReturnQuery.handleSearchApply}
          onSearchClear={pullFromProductionReturnQuery.handleSearchClear}
          appliedKeyword={pullFromProductionReturnQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.searchPlaceholder')}
          page={pullFromProductionReturnQuery.page}
          pageSize={pullFromProductionReturnQuery.pageSize}
          total={pullFromProductionReturnQuery.total}
          onPageChange={pullFromProductionReturnQuery.handlePageChange}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          tableScroll={{ x: 1100, y: 360 }}
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
          onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
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
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
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
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          filterExtra={(
            <ThemedSegmented
              block
              value={outsourcePullType}
              options={outsourcePullTypeOptions}
              onChange={(v) => setOutsourcePullType(v as InboundOutsourcePullType)}
            />
          )}
          tableScroll={{ x: 1050, y: 360 }}
        />
      </>
    );
  },
);

InboundQuickPullModals.displayName = 'InboundQuickPullModals';

export default InboundQuickPullModals;
