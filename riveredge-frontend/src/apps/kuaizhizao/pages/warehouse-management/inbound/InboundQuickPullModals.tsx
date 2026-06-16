import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Modal, Space, Table, Tag } from 'antd';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
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

    const [activeKey, setActiveKey] = useState<InboundQuickPullKey | null>(null);

    const [pullPoLoading, setPullPoLoading] = useState(false);
    const [pullPoKeyword, setPullPoKeyword] = useState('');
    const [pullPoCandidates, setPullPoCandidates] = useState<PullPurchaseOrderCandidate[]>([]);
    const [selectedPullPoIds, setSelectedPullPoIds] = useState<number[]>([]);

    const [pullReceiptNoticeLoading, setPullReceiptNoticeLoading] = useState(false);
    const [pullReceiptNoticeSubmitting, setPullReceiptNoticeSubmitting] = useState(false);
    const [pullReceiptNoticeKeyword, setPullReceiptNoticeKeyword] = useState('');
    const [pullReceiptNoticeCandidates, setPullReceiptNoticeCandidates] = useState<PullReceiptNoticeCandidate[]>([]);
    const [selectedPullReceiptNoticeId, setSelectedPullReceiptNoticeId] = useState<number | null>(null);

    const [pullWoLoading, setPullWoLoading] = useState(false);
    const [pullWoKeyword, setPullWoKeyword] = useState('');
    const [pullWoCandidates, setPullWoCandidates] = useState<PullWorkOrderCandidate[]>([]);
    const [selectedPullWoId, setSelectedPullWoId] = useState<number | null>(null);

    const [pullProductionReturnWoId, setPullProductionReturnWoId] = useState<number | null>(null);

    const [pullSalesOrderLoading, setPullSalesOrderLoading] = useState(false);
    const [pullSalesOrderKeyword, setPullSalesOrderKeyword] = useState('');
    const [pullSalesOrderCandidates, setPullSalesOrderCandidates] = useState<PullSalesOrderCandidate[]>([]);
    const [selectedPullSalesOrderId, setSelectedPullSalesOrderId] = useState<number | null>(null);

    const [pullOutsourceWoLoading, setPullOutsourceWoLoading] = useState(false);
    const [pullOutsourceWoKeyword, setPullOutsourceWoKeyword] = useState('');
    const [pullOutsourceWoCandidates, setPullOutsourceWoCandidates] = useState<PullOutsourceWoCandidate[]>([]);
    const [outsourcePullType, setOutsourcePullType] = useState<InboundOutsourcePullType>('outsource_receipt');
    const [selectedOutsourceWoId, setSelectedOutsourceWoId] = useState<number | undefined>();

    const outsourcePullTypeOptions = useMemo(
      (): { label: string; value: InboundOutsourcePullType }[] => [
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.receipt'), value: 'outsource_receipt' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.materialReturn'), value: 'outsource_material_return' },
        { label: t('app.kuaizhizao.warehouseInbound.pull.outsourceType.productReturn'), value: 'outsource_product_return' },
      ],
      [t],
    );

    const closeModal = useCallback(() => {
      setActiveKey(null);
      setSelectedPullReceiptNoticeId(null);
      setSelectedPullSalesOrderId(null);
      setSelectedOutsourceWoId(undefined);
      setOutsourcePullType('outsource_receipt');
      setSelectedPullPoIds([]);
      setSelectedPullWoId(null);
      setPullPoKeyword('');
      setPullWoKeyword('');
      setPullOutsourceWoKeyword('');
      setPullProductionReturnWoId(null);
    }, []);

    const loadPullPurchaseOrderCandidates = useCallback(async (keyword: string = '') => {
      setPullPoLoading(true);
      try {
        const res = await listPurchaseReceiptPullCandidates({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        setPullPoCandidates(res.data ?? []);
      } catch {
        setPullPoCandidates([]);
        messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.po.loadFailed'));
      } finally {
        setPullPoLoading(false);
      }
    }, [messageApi, t]);

    const loadPullWorkOrderCandidates = useCallback(async (keyword: string = '') => {
      setPullWoLoading(true);
      try {
        const kw = keyword.trim();
        const woRes = await workOrderApi.list({
          skip: 0,
          limit: 100,
          keyword: kw || undefined,
        });
        const woList = Array.isArray(woRes)
          ? woRes
          : (woRes as { data?: unknown[]; items?: unknown[] })?.data
            ?? (woRes as { items?: unknown[] })?.items
            ?? [];
        const candidates = (Array.isArray(woList) ? woList : [])
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
        setPullWoCandidates(candidates);
      } catch {
        setPullWoCandidates([]);
        messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.workOrder.loadFailed'));
      } finally {
        setPullWoLoading(false);
      }
    }, [messageApi, t]);

    const loadPullOutsourceWoCandidates = useCallback(async (keyword: string = '') => {
      setPullOutsourceWoLoading(true);
      try {
        const kw = keyword.trim();
        const res = await outsourceWorkOrderApi.list({
          skip: 0,
          limit: 100,
          keyword: kw || undefined,
        });
        const rows = Array.isArray(res)
          ? res
          : (res as { data?: unknown[]; items?: unknown[] })?.data
            ?? (res as { items?: unknown[] })?.items
            ?? [];
        const candidates = (Array.isArray(rows) ? rows : [])
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
        setPullOutsourceWoCandidates(candidates);
      } catch {
        setPullOutsourceWoCandidates([]);
        messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.outsource.loadFailed'));
      } finally {
        setPullOutsourceWoLoading(false);
      }
    }, [messageApi, t]);

    useImperativeHandle(ref, () => ({
      open: (key: InboundQuickPullKey) => {
        setActiveKey(key);
        if (key === 'purchase_order') {
          setPullPoKeyword('');
          setSelectedPullPoIds([]);
          void loadPullPurchaseOrderCandidates('');
        }
        if (key === 'receipt_notice') {
          setPullReceiptNoticeKeyword('');
          setSelectedPullReceiptNoticeId(null);
          void loadPullReceiptNoticeCandidates('');
        }
        if (key === 'work_order') {
          setPullWoKeyword('');
          setSelectedPullWoId(null);
          void loadPullWorkOrderCandidates('');
        }
        if (key === 'production_return') {
          setPullWoKeyword('');
          setPullProductionReturnWoId(null);
          void loadPullWorkOrderCandidates('');
        }
        if (key === 'sales_return') {
          setPullSalesOrderKeyword('');
          setSelectedPullSalesOrderId(null);
          void loadPullSalesOrderCandidates('');
        }
        if (key === 'outsource') {
          setOutsourcePullType('outsource_receipt');
          setSelectedOutsourceWoId(undefined);
          setPullOutsourceWoKeyword('');
          void loadPullOutsourceWoCandidates('');
        }
      },
    }));

    const loadPullReceiptNoticeCandidates = useCallback(async (keyword: string = '') => {
      setPullReceiptNoticeLoading(true);
      try {
        const kw = keyword.trim().toLowerCase();
        const rnRes = await receiptNoticeApi.list({ skip: 0, limit: 100 });
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
        setPullReceiptNoticeCandidates(candidates);
      } catch {
        setPullReceiptNoticeCandidates([]);
      } finally {
        setPullReceiptNoticeLoading(false);
      }
    }, []);

    const loadPullSalesOrderCandidates = useCallback(async (keyword: string = '') => {
      setPullSalesOrderLoading(true);
      try {
        const kw = keyword.trim();
        const res = await listSalesOrders({
          skip: 0,
          limit: 100,
          keyword: kw || undefined,
        });
        const orders = Array.isArray((res as { data?: unknown[] })?.data)
          ? ((res as { data: unknown[] }).data as any[])
          : [];
        const candidates = orders
          .filter((order: any) => {
            if (!kw) return true;
            const text = `${order.order_code || ''} ${order.customer_name || ''}`.toLowerCase();
            return text.includes(kw.toLowerCase());
          })
          .map((order: Record<string, unknown>) => ({
            id: Number(order.id),
            order_code: String(order.order_code || ''),
            customer_name: String(order.customer_name || ''),
            status: String(order.status || ''),
            delivery_date: order.delivery_date ? String(order.delivery_date) : undefined,
            updated_at: order.updated_at ? String(order.updated_at) : undefined,
            total_quantity: Number(order.total_quantity ?? 0) || undefined,
            delivery_progress:
              order.delivery_progress != null ? Number(order.delivery_progress) : null,
          }));
        setPullSalesOrderCandidates(candidates);
      } catch {
        setPullSalesOrderCandidates([]);
        messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.loadFailed'));
      } finally {
        setPullSalesOrderLoading(false);
      }
    }, [messageApi, t]);

    const getSelectedPullablePoIds = useCallback(() => {
      if (!selectedPullPoIds.length) return [];
      return selectedPullPoIds.filter((id) => {
        const row = pullPoCandidates.find((c) => c.id === id);
        return row?.pullable !== false;
      });
    }, [pullPoCandidates, selectedPullPoIds]);

    const handlePurchaseOrderOpenReceiptEntry = () => {
      const pullableIds = getSelectedPullablePoIds();
      if (!pullableIds.length) {
        if (!selectedPullPoIds.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectAtLeastOne'));
        } else {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.allCompleted'));
        }
        return;
      }
      if (pullableIds.length !== 1) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.po.selectOnlyOne'));
        return;
      }
      const poId = pullableIds[0];
      closeModal();
      navigate(inboundPoEntryPath(poId));
    };

    const handleReceiptNoticeConfirm = async () => {
      if (!selectedPullReceiptNoticeId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.selectRequired'));
        return;
      }
      const selected = pullReceiptNoticeCandidates.find((x) => x.id === selectedPullReceiptNoticeId);
      if (selected?.converted) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.alreadyConverted'));
        return;
      }
      setPullReceiptNoticeSubmitting(true);
      try {
        const notice = (await receiptNoticeApi.get(String(selectedPullReceiptNoticeId))) as {
          purchase_order_id?: number;
        };
        const poId = Number(notice?.purchase_order_id);
        if (!Number.isFinite(poId) || poId <= 0) {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.noLinkedPo'));
          return;
        }
        closeModal();
        navigate(inboundPoEntryPath(poId));
      } catch (error: unknown) {
        const err = error as { response?: { data?: { detail?: string | { message?: string } } }; message?: string };
        const detail = err?.response?.data?.detail;
        const message =
          (typeof detail === 'string' ? detail : (detail as { message?: string })?.message)
          || err?.message
          || t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.loadFailed');
        messageApi.error(message);
      } finally {
        setPullReceiptNoticeSubmitting(false);
      }
    };

    const handleWorkOrderOpenEntry = () => {
      if (!selectedPullWoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectRequired'));
        return;
      }
      closeModal();
      navigate(inboundWorkOrderEntryPath(selectedPullWoId));
    };

    const handleProductionReturnOpenEntry = () => {
      if (!pullProductionReturnWoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.workOrder.selectRequired'));
        return;
      }
      closeModal();
      navigate(inboundProductionReturnEntryPath(pullProductionReturnWoId));
    };

    const handleSalesReturnOpenEntry = () => {
      if (!selectedPullSalesOrderId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.salesReturn.selectRequired'));
        return;
      }
      closeModal();
      navigate(inboundSalesReturnEntryPath(selectedPullSalesOrderId));
    };

    const handleOutsourceOpenEntry = () => {
      if (!selectedOutsourceWoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.pull.outsource.selectRequired'));
        return;
      }
      closeModal();
      navigate(inboundOutsourceEntryPath(selectedOutsourceWoId, outsourcePullType));
    };

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
        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.po.title')}
          open={activeKey === 'purchase_order'}
          onCancel={closeModal}
          footer={[
            <Button key="cancel" onClick={closeModal}>
              {t('app.kuaizhizao.warehouseInbound.action.cancel')}
            </Button>,
            <Button key="receipt" type="primary" onClick={handlePurchaseOrderOpenReceiptEntry}>
              {t('app.kuaizhizao.warehouseInbound.action.inbound')}
            </Button>,
          ]}
          width={1280}
          destroyOnHidden
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.po.searchPlaceholder')}
              value={pullPoKeyword}
              onChange={(e) => setPullPoKeyword(e.target.value)}
              onSearch={(value) => {
                setPullPoKeyword(value);
                void loadPullPurchaseOrderCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullPurchaseOrderCandidate>
              rowKey="id"
              loading={pullPoLoading}
              dataSource={pullPoCandidates}
              pagination={false}
              scroll={{ x: 1200, y: 360 }}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedPullPoIds,
                onChange: (keys) => {
                  setSelectedPullPoIds(keys.map((k) => Number(k)).filter((id) => Number.isFinite(id)));
                },
                getCheckboxProps: (record) => ({ disabled: record.pullable === false }),
              }}
              onRow={(record) => ({
                onClick: () => {
                  if (record.pullable === false) return;
                  setSelectedPullPoIds((prev) =>
                    prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id],
                  );
                },
              })}
              columns={poPullColumns}
            />
          </Space>
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.title')}
          open={activeKey === 'receipt_notice'}
          onCancel={() => {
            if (pullReceiptNoticeSubmitting) return;
            closeModal();
          }}
          onOk={() => {
            void handleReceiptNoticeConfirm();
          }}
          confirmLoading={pullReceiptNoticeSubmitting}
          width={1240}
          okText={t('app.kuaizhizao.warehouseInbound.action.nextStep')}
          destroyOnHidden
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.receiptNotice.searchPlaceholder')}
              value={pullReceiptNoticeKeyword}
              onChange={(e) => setPullReceiptNoticeKeyword(e.target.value)}
              onSearch={(value) => {
                setPullReceiptNoticeKeyword(value);
                void loadPullReceiptNoticeCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullReceiptNoticeCandidate>
              rowKey="id"
              loading={pullReceiptNoticeLoading}
              dataSource={pullReceiptNoticeCandidates}
              pagination={false}
              scroll={{ x: 1160, y: 360 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedPullReceiptNoticeId ? [selectedPullReceiptNoticeId] : [],
                onChange: (keys) => {
                  const next = Number(keys?.[0]);
                  if (Number.isFinite(next)) setSelectedPullReceiptNoticeId(next);
                  else setSelectedPullReceiptNoticeId(null);
                },
                getCheckboxProps: (record) => ({ disabled: !!record.converted }),
              }}
              onRow={(record) => ({
                onClick: () => {
                  if (record.converted) return;
                  setSelectedPullReceiptNoticeId(record.id);
                },
              })}
              columns={receiptNoticePullColumns}
            />
          </Space>
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.workOrder.title')}
          open={activeKey === 'work_order'}
          onCancel={closeModal}
          onOk={handleWorkOrderOpenEntry}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          destroyOnHidden
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.searchPlaceholder')}
              value={pullWoKeyword}
              onChange={(e) => setPullWoKeyword(e.target.value)}
              onSearch={(value) => {
                setPullWoKeyword(value);
                void loadPullWorkOrderCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullWorkOrderCandidate>
              rowKey="id"
              loading={pullWoLoading}
              dataSource={pullWoCandidates}
              pagination={false}
              scroll={{ x: 1100, y: 360 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedPullWoId ? [selectedPullWoId] : [],
                onChange: (keys) => {
                  const next = Number(keys?.[0]);
                  if (Number.isFinite(next)) setSelectedPullWoId(next);
                  else setSelectedPullWoId(null);
                },
              }}
              onRow={(record) => ({
                onClick: () => setSelectedPullWoId(record.id),
              })}
              columns={workOrderPullColumns}
            />
          </Space>
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.productionReturn.title')}
          open={activeKey === 'production_return'}
          onCancel={closeModal}
          onOk={handleProductionReturnOpenEntry}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          destroyOnHidden
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.workOrder.searchPlaceholder')}
              value={pullWoKeyword}
              onChange={(e) => setPullWoKeyword(e.target.value)}
              onSearch={(value) => {
                setPullWoKeyword(value);
                void loadPullWorkOrderCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullWorkOrderCandidate>
              rowKey="id"
              loading={pullWoLoading}
              dataSource={pullWoCandidates}
              pagination={false}
              scroll={{ x: 1100, y: 360 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: pullProductionReturnWoId ? [pullProductionReturnWoId] : [],
                onChange: (keys) => {
                  const next = Number(keys?.[0]);
                  if (Number.isFinite(next)) setPullProductionReturnWoId(next);
                  else setPullProductionReturnWoId(null);
                },
              }}
              onRow={(record) => ({
                onClick: () => setPullProductionReturnWoId(record.id),
              })}
              columns={productionReturnPullColumns}
            />
          </Space>
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.title')}
          open={activeKey === 'sales_return'}
          onCancel={closeModal}
          onOk={handleSalesReturnOpenEntry}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          destroyOnHidden
          width={1100}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.salesReturn.searchPlaceholder')}
              value={pullSalesOrderKeyword}
              onChange={(e) => setPullSalesOrderKeyword(e.target.value)}
              onSearch={(value) => {
                setPullSalesOrderKeyword(value);
                void loadPullSalesOrderCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullSalesOrderCandidate>
              rowKey="id"
              loading={pullSalesOrderLoading}
              dataSource={pullSalesOrderCandidates}
              pagination={false}
              scroll={{ x: 900, y: 340 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedPullSalesOrderId ? [selectedPullSalesOrderId] : [],
                onChange: (keys) => {
                  const next = Number(keys?.[0]);
                  if (Number.isFinite(next)) setSelectedPullSalesOrderId(next);
                  else setSelectedPullSalesOrderId(null);
                },
              }}
              onRow={(record) => ({
                onClick: () => {
                  setSelectedPullSalesOrderId(record.id);
                },
              })}
              columns={salesReturnPullColumns}
            />
          </Space>
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseInbound.pull.outsource.title')}
          open={activeKey === 'outsource'}
          onCancel={closeModal}
          onOk={handleOutsourceOpenEntry}
          width={1200}
          okText={t('app.kuaizhizao.warehouseInbound.action.openReceipt')}
          destroyOnHidden
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ThemedSegmented
              block
              value={outsourcePullType}
              options={outsourcePullTypeOptions}
              onChange={(v) => setOutsourcePullType(v as InboundOutsourcePullType)}
            />
            <Input.Search
              allowClear
              placeholder={t('app.kuaizhizao.warehouseInbound.pull.outsource.searchPlaceholder')}
              value={pullOutsourceWoKeyword}
              onChange={(e) => setPullOutsourceWoKeyword(e.target.value)}
              onSearch={(value) => {
                setPullOutsourceWoKeyword(value);
                void loadPullOutsourceWoCandidates(value);
              }}
              enterButton={t('app.kuaizhizao.warehouseInbound.action.search')}
            />
            <Table<PullOutsourceWoCandidate>
              rowKey="id"
              loading={pullOutsourceWoLoading}
              dataSource={pullOutsourceWoCandidates}
              pagination={false}
              scroll={{ x: 1050, y: 360 }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedOutsourceWoId ? [selectedOutsourceWoId] : [],
                onChange: (keys) => {
                  const next = Number(keys?.[0]);
                  setSelectedOutsourceWoId(Number.isFinite(next) && next > 0 ? next : undefined);
                },
              }}
              onRow={(record) => ({
                onClick: () => setSelectedOutsourceWoId(record.id),
              })}
              columns={outsourcePullColumns}
            />
          </Space>
        </Modal>
      </>
    );
  },
);

InboundQuickPullModals.displayName = 'InboundQuickPullModals';

export default InboundQuickPullModals;
