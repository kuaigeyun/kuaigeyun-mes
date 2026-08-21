/**
 * 售后服务工单
 *
 * 列表与详情抽屉风格对齐客户跟进；上拉取单/下推销售退货对齐销售退货写法。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProForm,
} from '@ant-design/pro-components';
import { App, Button, InputNumber, Modal, Table, Typography } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  ExportOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { DetailDrawerActions, ListPageTemplate } from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  paginatePullRows,
  renderPullQueryDocStatus,
  renderPullQueryReviewStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  buildUniPushMenuItems,
  buildUniPushToolbarDisabledReason,
  UniPushToolbarButton,
} from '../../../../../components/uni-push';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { afterSalesTicketCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  AFTER_SALES_REQUEST_TYPES,
  AFTER_SALES_TICKET_STATUSES,
  afterSalesTicketApi,
  type AfterSalesTicket,
  type AfterSalesTicketPushPreview,
  type AfterSalesTicketPushPreviewLine,
} from '../../../services/after-sales-ticket';
import {
  AfterSalesTicketFormModal,
  type AfterSalesTicketPreset,
} from '../../../components/AfterSalesTicketFormModal';
import { AfterSalesTicketDetailDrawer } from './components/AfterSalesTicketDetailDrawer';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { customerApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import { listSalesOrders } from '../../../services/sales-order';
import { warehouseApi } from '../../../services/warehouse-execution';
import {
  buildKuaizhizaoPullCreateMenuItems,
  resolveKuaizhizaoDocumentAction,
} from '../../../constants/documentActionRegistry';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  AFTER_SALES_TICKET_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../shared/afterSalesListPresentation';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const AFTER_SALES_TICKET_RESOURCE = 'kuaizhizao:after-sales-ticket';
const SALES_RETURN_RESOURCE = 'kuaizhizao:sales-return';
const REPAIR_ORDER_RESOURCE = 'kuaizhizao:repair-order';


type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  review_status?: string;
  order_date?: string;
  delivery_date?: string;
  total_amount?: number;
  salesman_name?: string;
  updated_at?: string;
  existing_ticket_codes?: string;
};

type PullSalesDeliveryCandidate = {
  id: number;
  delivery_code?: string;
  customer_name?: string;
  sales_order_code?: string;
  status?: string;
  review_status?: string;
  warehouse_name?: string;
  delivery_time?: string;
  total_quantity?: number;
  updated_at?: string;
  existing_ticket_codes?: string;
};

const AfterSalesTicketsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const detailIdRef = useRef<number | null>(null);
  const perms = useResourcePermissions(AFTER_SALES_TICKET_RESOURCE);
  const salesReturnPerms = useResourcePermissions(SALES_RETURN_RESOURCE);
  const repairOrderPerms = useResourcePermissions(REPAIR_ORDER_RESOURCE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AfterSalesTicket | null>(null);
  const [preset, setPreset] = useState<AfterSalesTicketPreset | null>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [tableTickets, setTableTickets] = useState<AfterSalesTicket[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AfterSalesTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [pushOpen, setPushOpen] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushConfirming, setPushConfirming] = useState(false);
  const [pushPreview, setPushPreview] = useState<AfterSalesTicketPushPreview | null>(null);
  const [pushTicketId, setPushTicketId] = useState<number | null>(null);
  const [pushWarehouseId, setPushWarehouseId] = useState<number | null>(null);
  const [pushWarehouseName, setPushWarehouseName] = useState<string>('');
  const [pushQtys, setPushQtys] = useState<Record<number, number>>({});

  const pullFromSalesOrderAction = resolveKuaizhizaoDocumentAction(
    t,
    'after_sales_ticket.pull_from_sales_order',
  );
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(
    t,
    'after_sales_ticket.pull_from_sales_delivery',
  );

  useEffect(() => {
    let cancelled = false;
    void customerApi
      .list({ limit: 1000, isActive: true })
      .then((result) => {
        if (!cancelled) setCustomerList(unwrapSupplyPagedList(result));
      })
      .catch(() => {
        if (!cancelled) setCustomerList([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const customerSearchOptions = useMemo(
    () =>
      customerList
        .map((c: any) => ({
          label: String(c.name ?? c.customer_name ?? '').trim() || String(c.id ?? ''),
          value: Number(c.id ?? c.customer_id),
        }))
        .filter((o) => Number.isFinite(o.value) && o.value > 0),
    [customerList],
  );

  const requestTypeValueEnum = useMemo(
    () => Object.fromEntries(AFTER_SALES_REQUEST_TYPES.map((v) => [v, { text: v }])) as Record<string, { text: string }>,
    [],
  );
  const statusValueEnum = useMemo(
    () => Object.fromEntries(AFTER_SALES_TICKET_STATUSES.map((v) => [v, { text: v }])) as Record<string, { text: string }>,
    [],
  );

  const reloadTable = () => actionRef.current?.reload();

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetailRecord(await afterSalesTicketApi.get(id));
    } catch (error) {
      setDetailRecord(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaizhizao.afterSalesTicket.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [t]);

  const refreshOpenDetail = useCallback(() => {
    const id = detailIdRef.current;
    if (!detailDrawerVisible || id == null) return;
    afterSalesTicketApi.get(id).then(setDetailRecord).catch(() => undefined);
  }, [detailDrawerVisible]);

  const openCreate = () => {
    setEditing(null);
    setPreset(null);
    setModalOpen(true);
  };

  useNewShortcut(openCreate, perms.canCreate);

  const openEdit = async (record: AfterSalesTicket) => {
    if (record.status === '已关闭') {
      message.warning(t('app.kuaizhizao.afterSalesTicket.closedCannotEdit'));
      return;
    }
    try {
      const latest = await afterSalesTicketApi.get(record.id);
      setPreset(null);
      setEditing(latest);
      setModalOpen(true);
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.loadFailed'));
    }
  };

  const handleDetail = (id: number) => {
    detailIdRef.current = id;
    setDetailDrawerVisible(true);
    setDetailRecord(null);
    setDetailError(null);
    void loadDetail(id);
  };

  const closeDetailDrawer = () => {
    setDetailDrawerVisible(false);
    detailIdRef.current = null;
    setDetailRecord(null);
    setDetailError(null);
  };

  const handleDelete = (record: AfterSalesTicket, opts?: { closeDrawer?: boolean }) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.afterSalesTicket.deleteConfirm'),
      onOk: async () => {
        try {
          await afterSalesTicketApi.delete(record.id);
          message.success(t('common.deleteSuccess'));
          if (opts?.closeDrawer) closeDetailDrawer();
          reloadTable();
        } catch (e: any) {
          message.error(e?.message || t('common.operationFailed'));
        }
      },
    });
  };

  const handleCloseTicket = (record: AfterSalesTicket) => {
    if (record.status === '已关闭') return;
    getAntdModal().confirm({
      title: t('app.kuaizhizao.afterSalesTicket.closeConfirm'),
      content: (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('app.kuaizhizao.afterSalesTicket.closeHint')}
        </Typography.Paragraph>
      ),
      onOk: async () => {
        try {
          await afterSalesTicketApi.close(record.id, { resolution: record.resolution ?? null });
          message.success(t('app.kuaizhizao.afterSalesTicket.closeSuccess'));
          reloadTable();
          if (detailIdRef.current === record.id) {
            const latest = await afterSalesTicketApi.get(record.id);
            setDetailRecord(latest);
          }
        } catch (e: any) {
          message.error(e?.message || t('common.operationFailed'));
          throw e;
        }
      },
    });
  };

  const handleBatchDelete = async (ids: React.Key[]) => {
    for (const id of ids) {
      await afterSalesTicketApi.delete(Number(id));
    }
    setSelectedRowKeys([]);
    reloadTable();
  };

  const permDeniedTitle = t('common.noPermission', { defaultValue: '无权限' });

  const pushSalesReturnDisabledReason = useCallback(
    (record: AfterSalesTicket | null | undefined): string | undefined => {
      if (!record) return undefined;
      if (!perms.canUpdate) return permDeniedTitle;
      if (!salesReturnPerms.canCreate) return permDeniedTitle;
      if (!record.capabilities?.push_sales_return?.allowed) {
        return (
          afterSalesTicketCapabilityReasonMessage(
            record.capabilities?.push_sales_return?.reason,
            t,
          ) || t('app.kuaizhizao.afterSalesTicket.pushFailed')
        );
      }
      return undefined;
    },
    [permDeniedTitle, perms.canUpdate, salesReturnPerms.canCreate, t],
  );

  const canPushSalesReturn = useCallback(
    (record: AfterSalesTicket) => !pushSalesReturnDisabledReason(record),
    [pushSalesReturnDisabledReason],
  );

  const pushRepairDisabledReason = useCallback(
    (record: AfterSalesTicket | null | undefined): string | undefined => {
      if (!record) return undefined;
      if (!perms.canUpdate) return permDeniedTitle;
      if (!repairOrderPerms.canCreate) return permDeniedTitle;
      if (!record.capabilities?.push_repair_order?.allowed) {
        const reason =
          afterSalesTicketCapabilityReasonMessage(
            record.capabilities?.push_repair_order?.reason,
            t,
          ) || t('app.kuaizhizao.afterSalesTicket.pushRepairFailed');
        if (record.existing_repair_order_code) {
          return t('app.kuaizhizao.afterSalesTicket.pushRepairAlreadyExists', {
            code: record.existing_repair_order_code,
          });
        }
        return reason;
      }
      return undefined;
    },
    [permDeniedTitle, perms.canUpdate, repairOrderPerms.canCreate, t],
  );

  const handlePushRepair = useCallback(
    (record: AfterSalesTicket) => {
      const blocked = pushRepairDisabledReason(record);
      if (blocked) {
        message.warning(blocked);
        return;
      }
      getAntdModal().confirm({
        title: t('app.kuaizhizao.afterSalesTicket.actionPushRepairOrder'),
        content: t('app.kuaizhizao.afterSalesTicket.pushRepairConfirm', {
          code: record.ticket_code,
        }),
        onOk: async () => {
          try {
            const res = await afterSalesTicketApi.pushToRepairOrder(record.id);
            message.success(
              res?.repair_order_code
                ? `${t('app.kuaizhizao.afterSalesTicket.pushRepairSuccess')}：${res.repair_order_code}`
                : t('app.kuaizhizao.afterSalesTicket.pushRepairSuccess'),
            );
            reloadTable();
            refreshOpenDetail();
          } catch (e: any) {
            message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.pushRepairFailed'));
            throw e;
          }
        },
      });
    },
    [message, pushRepairDisabledReason, refreshOpenDetail, t],
  );

  const selectedTicketForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableTickets.find((row) => Number(row.id) === id) ?? null;
  }, [selectedRowKeys, tableTickets]);

  const openPushSalesReturn = useCallback(
    async (record: AfterSalesTicket) => {
      const blocked = pushSalesReturnDisabledReason(record);
      if (blocked) {
        message.warning(blocked);
        return;
      }
      setPushTicketId(record.id);
      setPushOpen(true);
      setPushLoading(true);
      setPushPreview(null);
      setPushWarehouseId(null);
      setPushWarehouseName('');
      setPushQtys({});
      try {
        const preview = await afterSalesTicketApi.previewPushToSalesReturn(record.id);
        setPushPreview(preview);
        const qtyMap: Record<number, number> = {};
        for (const line of preview.lines || []) {
          const soItemId = Number(line.sales_order_item_id);
          if (!Number.isFinite(soItemId) || soItemId <= 0) continue;
          qtyMap[soItemId] = Number(line.return_quantity ?? 0);
        }
        setPushQtys(qtyMap);
      } catch (e: any) {
        message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.pushFailed'));
        setPushOpen(false);
      } finally {
        setPushLoading(false);
      }
    },
    [message, pushSalesReturnDisabledReason, t],
  );

  const toolbarPushMenuItems = useMemo(() => {
    const record = selectedTicketForToolbar;
    const returnDisabled = pushSalesReturnDisabledReason(record);
    const repairDisabled = pushRepairDisabledReason(record);
    return buildUniPushMenuItems([
      {
        key: 'push-sales-return',
        label: t('app.kuaizhizao.afterSalesTicket.actionPushSalesReturn'),
        disabled: !!returnDisabled,
        title: returnDisabled,
        onClick: () => {
          if (!record || returnDisabled) return;
          void openPushSalesReturn(record);
        },
      },
      {
        key: 'push-repair-order',
        label: t('app.kuaizhizao.afterSalesTicket.actionPushRepairOrder'),
        disabled: !!repairDisabled,
        title: repairDisabled,
        onClick: () => {
          if (!record || repairDisabled) return;
          handlePushRepair(record);
        },
      },
    ]);
  }, [
    handlePushRepair,
    openPushSalesReturn,
    pushRepairDisabledReason,
    pushSalesReturnDisabledReason,
    selectedTicketForToolbar,
    t,
  ]);

  const toolbarPushDisabledReason = useMemo(
    () =>
      buildUniPushToolbarDisabledReason(t, {
        selectedCount: selectedRowKeys.length,
        hasSelectedRecord: !!selectedTicketForToolbar,
      }),
    [selectedRowKeys.length, selectedTicketForToolbar, t],
  );

  const confirmPushSalesReturn = async () => {
    if (pushTicketId == null || !pushPreview) return;
    if (pushPreview.has_blocking_issues) {
      message.warning(pushPreview.message || t('app.kuaizhizao.afterSalesTicket.pushFailed'));
      return;
    }
    if (!pushWarehouseId || pushWarehouseId <= 0) {
      message.warning(t('app.kuaizhizao.afterSalesTicket.pushWarehouseRequired'));
      return;
    }
    const returnQuantities: Record<number, number> = {};
    const batchNumbers: Record<number, string> = {};
    for (const line of pushPreview.lines || []) {
      const soItemId = Number(line.sales_order_item_id);
      if (!Number.isFinite(soItemId) || soItemId <= 0) continue;
      const qty = Number(pushQtys[soItemId] ?? 0);
      const maxQty = Number(line.returnable_quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
        message.warning(
          t('app.kuaizhizao.salesReturn.pullPreviewQtyExceeds', {
            code: line.material_code || soItemId,
          }),
        );
        return;
      }
      returnQuantities[soItemId] = qty;
      const batch = String(line.batch_no || '').trim();
      if (batch) batchNumbers[soItemId] = batch;
    }
    if (!Object.keys(returnQuantities).length) {
      message.warning(t('app.kuaizhizao.afterSalesTicket.pushFailed'));
      return;
    }
    setPushConfirming(true);
    try {
      const res = await afterSalesTicketApi.pushToSalesReturn(pushTicketId, {
        warehouse_id: pushWarehouseId,
        warehouse_name: pushWarehouseName || undefined,
        return_quantities: returnQuantities,
        batch_numbers: Object.keys(batchNumbers).length ? batchNumbers : undefined,
      });
      message.success(
        res?.return_code
          ? `${t('app.kuaizhizao.afterSalesTicket.pushSuccess')}：${res.return_code}`
          : t('app.kuaizhizao.afterSalesTicket.pushSuccess'),
      );
      setPushOpen(false);
      reloadTable();
      refreshOpenDetail();
    } catch (e: any) {
      message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.pushFailed'));
    } finally {
      setPushConfirming(false);
    }
  };

  const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const [res, ticketRes] = await Promise.all([
          listSalesOrders({
            skip: ((page || 1) - 1) * (pageSize || 20),
            limit: pageSize || 20,
            keyword: keyword.trim() || undefined,
            pullable_only: true,
            pull_target: 'after_sales_ticket',
            view: 'options',
          }),
          afterSalesTicketApi.list({ skip: 0, limit: 200 }),
        ]);
        const ticketsByOrderId = new Map<number, string[]>();
        for (const ticket of ticketRes.items ?? []) {
          const orderId = Number(ticket.sales_order_id);
          if (!Number.isFinite(orderId) || orderId <= 0 || !ticket.ticket_code) continue;
          const codes = ticketsByOrderId.get(orderId) ?? [];
          codes.push(ticket.ticket_code);
          ticketsByOrderId.set(orderId, codes);
        }
        const orders = Array.isArray((res as any)?.data) ? (res as any).data : [];
        const candidates: PullSalesOrderCandidate[] = orders
          .map((order: any) => ({
            id: Number(order.id),
            order_code: order.order_code,
            customer_name: order.customer_name,
            status: order.status,
            review_status: order.review_status,
            order_date: order.order_date,
            delivery_date: order.delivery_date,
            total_amount: order.total_amount != null ? Number(order.total_amount) : undefined,
            salesman_name: order.salesman_name,
            updated_at: order.updated_at,
            existing_ticket_codes: (ticketsByOrderId.get(Number(order.id)) ?? []).join(' '),
          }))
          .filter((o: PullSalesOrderCandidate) => Number.isFinite(o.id) && o.id > 0);
        return { data: candidates, total: Number((res as any)?.total ?? candidates.length) };
      } catch (error: any) {
        message.error(error?.message || t('app.kuaizhizao.afterSalesTicket.loadSalesOrdersFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId || selectedId <= 0) {
        message.warning(t('app.kuaizhizao.afterSalesTicket.selectSalesOrder'));
        return;
      }
      try {
        await afterSalesTicketApi.pullFromSalesOrder({ sales_order_id: selectedId });
        message.success(t('app.kuaizhizao.afterSalesTicket.pullSuccess'));
        pullFromSalesOrderQuery.closeModal();
        reloadTable();
      } catch (e: any) {
        message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.pullFailed'));
      }
    },
  });

  const pullFromSalesDeliveryQuery = useUniPullQuery<PullSalesDeliveryCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const [res, ticketRes] = await Promise.all([
          warehouseApi.salesDelivery.list({
            skip: 0,
            limit: 200,
            keyword: keyword.trim() || undefined,
          }),
          afterSalesTicketApi.list({ skip: 0, limit: 200 }),
        ]);
        const ticketsByDeliveryId = new Map<number, string[]>();
        for (const ticket of ticketRes.items ?? []) {
          const deliveryId = Number(ticket.sales_delivery_id);
          if (!Number.isFinite(deliveryId) || deliveryId <= 0 || !ticket.ticket_code) continue;
          const codes = ticketsByDeliveryId.get(deliveryId) ?? [];
          codes.push(ticket.ticket_code);
          ticketsByDeliveryId.set(deliveryId, codes);
        }
        const list = (res as { items?: unknown[] })?.items ?? [];
        const candidates: PullSalesDeliveryCandidate[] = list
          .map((row: any) => ({
            id: Number(row.id),
            delivery_code: row.delivery_code,
            customer_name: row.customer_name,
            sales_order_code: row.sales_order_code,
            status: row.status,
            review_status: row.review_status,
            warehouse_name: row.warehouse_name,
            delivery_time: row.delivery_time,
            total_quantity: row.total_quantity != null ? Number(row.total_quantity) : undefined,
            updated_at: row.updated_at,
            existing_ticket_codes: (ticketsByDeliveryId.get(Number(row.id)) ?? []).join(' '),
          }))
          .filter((o: PullSalesDeliveryCandidate) => Number.isFinite(o.id) && o.id > 0);
        return paginatePullRows(candidates, page, pageSize);
      } catch (error: any) {
        message.error(
          error?.message || t('app.kuaizhizao.afterSalesTicket.loadSalesDeliveriesFailed'),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId || selectedId <= 0) {
        message.warning(t('app.kuaizhizao.afterSalesTicket.selectSalesDelivery'));
        return;
      }
      try {
        await afterSalesTicketApi.pullFromSalesDelivery({ sales_delivery_id: selectedId });
        message.success(t('app.kuaizhizao.afterSalesTicket.pullSuccess'));
        pullFromSalesDeliveryQuery.closeModal();
        reloadTable();
      } catch (e: any) {
        message.error(e?.message || t('app.kuaizhizao.afterSalesTicket.pullFailed'));
      }
    },
  });

  const pullSalesOrderColumns: ProColumns<PullSalesOrderCandidate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.afterSalesTicket.colSalesOrder'),
        dataIndex: 'order_code',
        width: 170,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colCustomer'),
        dataIndex: 'customer_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.existingTickets'),
        dataIndex: 'existing_ticket_codes',
        width: 180,
        ellipsis: true,
        render: (_, row) => row.existing_ticket_codes || '—',
      },
      {
        title: t('app.kuaizhizao.salesReturn.orderStatus'),
        dataIndex: 'status',
        width: 100,
        align: 'center' as const,
        render: (v) => renderPullQueryDocStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 110,
        align: 'center' as const,
        render: (v) => renderPullQueryReviewStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.orderDate'),
        dataIndex: 'order_date',
        width: 120,
        render: (_, row) =>
          row.order_date ? formatDateTime(row.order_date, 'YYYY-MM-DD') : '—',
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 120,
        render: (_, row) =>
          row.delivery_date ? formatDateTime(row.delivery_date, 'YYYY-MM-DD') : '—',
      },
      {
        title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        render: (_, row) =>
          row.total_amount != null
            ? Number(row.total_amount).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '—',
      },
      {
        title: t('app.kuaizhizao.salesOrder.salesman'),
        dataIndex: 'salesman_name',
        width: 110,
        ellipsis: true,
        render: (_, row) => row.salesman_name || '—',
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 160,
        render: (_, row) =>
          row.updated_at ? formatDateTime(row.updated_at, 'YYYY-MM-DD HH:mm') : '—',
      },
    ],
    [t],
  );

  const pullSalesDeliveryColumns: ProColumns<PullSalesDeliveryCandidate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.documentAction.after_sales_ticket.pull_from_sales_delivery.source'),
        dataIndex: 'delivery_code',
        width: 170,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colCustomer'),
        dataIndex: 'customer_name',
        width: 200,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colSalesOrder'),
        dataIndex: 'sales_order_code',
        width: 170,
        ellipsis: true,
        render: (_, row) => row.sales_order_code || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.existingTickets'),
        dataIndex: 'existing_ticket_codes',
        width: 180,
        ellipsis: true,
        render: (_, row) => row.existing_ticket_codes || '—',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        align: 'center' as const,
        render: (v) => renderPullQueryDocStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 110,
        align: 'center' as const,
        render: (v) => renderPullQueryReviewStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldWarehouse'),
        dataIndex: 'warehouse_name',
        width: 140,
        ellipsis: true,
        render: (_, row) => row.warehouse_name || '—',
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_time',
        width: 150,
        render: (_, row) =>
          row.delivery_time ? formatDateTime(row.delivery_time, 'YYYY-MM-DD HH:mm') : '—',
      },
      {
        title: t('common.quantity'),
        dataIndex: 'total_quantity',
        width: 100,
        align: 'right',
        render: (_, row) =>
          row.total_quantity != null ? String(row.total_quantity) : '—',
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 160,
        render: (_, row) =>
          row.updated_at ? formatDateTime(row.updated_at, 'YYYY-MM-DD HH:mm') : '—',
      },
    ],
    [t],
  );

  const pushLineColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialCode'),
        dataIndex: 'material_code',
        width: 130,
        render: (_: unknown, row: AfterSalesTicketPushPreviewLine) => row.material_code || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialName'),
        dataIndex: 'material_name',
        width: 160,
        render: (_: unknown, row: AfterSalesTicketPushPreviewLine) => row.material_name || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.fieldBatchNo'),
        dataIndex: 'batch_no',
        width: 120,
        render: (_: unknown, row: AfterSalesTicketPushPreviewLine) => row.batch_no || '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colReturnableQty'),
        dataIndex: 'returnable_quantity',
        width: 100,
        align: 'right' as const,
        render: (_: unknown, row: AfterSalesTicketPushPreviewLine) =>
          row.returnable_quantity != null ? String(row.returnable_quantity) : '—',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colPushQty'),
        dataIndex: 'return_quantity',
        width: 120,
        render: (_: unknown, row: AfterSalesTicketPushPreviewLine) => {
          const soItemId = Number(row.sales_order_item_id);
          if (!Number.isFinite(soItemId) || soItemId <= 0) return '—';
          return (
            <InputNumber
              size="small"
              min={0}
              max={Number(row.returnable_quantity ?? undefined)}
              style={{ width: '100%' }}
              value={pushQtys[soItemId]}
              onChange={(v) =>
                setPushQtys((prev) => ({
                  ...prev,
                  [soItemId]: Number(v ?? 0),
                }))
              }
            />
          );
        },
      },
    ],
    [pushQtys, t],
  );

  const columns = alignProColumns<AfterSalesTicket>(
    [
      {
        title: t('common.keyword'),
        dataIndex: 'keyword',
        hideInTable: true,
        order: 1,
        fieldProps: { placeholder: t('app.kuaizhizao.afterSalesTicket.keywordPlaceholder') },
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colCustomer'),
        dataIndex: 'customer_id',
        hideInTable: true,
        order: 10,
        valueType: 'select',
        fieldProps: {
          options: customerSearchOptions,
          showSearch: true,
          optionFilterProp: 'label',
          allowClear: true,
          placeholder: t('app.kuaizhizao.afterSalesTicket.filterCustomer'),
        },
      },
      {
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        title: t('app.kuaizhizao.afterSalesTicket.colTicketCode'),
        key: 'after_sales_ticket_stacked',
        dataIndex: 'ticket_code',
        fixed: 'left',
        sorter: true,
        hideInSearch: true,
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={row.ticket_code || '-'}
            secondary={row.customer_name || '-'}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colRequestType'),
        dataIndex: 'request_type',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderAfterSalesTypeMarker(row.request_type),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colRequestType'),
        dataIndex: 'request_type',
        hideInTable: true,
        order: 20,
        valueType: 'select',
        valueEnum: requestTypeValueEnum,
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colContent'),
        dataIndex: 'content',
        width: 220,
        minWidth: 220,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, row) => (
          <Typography.Text ellipsis={{ tooltip: row.content ?? '—' }} style={{ maxWidth: '100%' }}>
            {row.content?.trim() ? row.content : '—'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colSalesOrder'),
        dataIndex: 'sales_order_code',
        hideInTable: true,
        order: 30,
        fieldProps: { placeholder: t('app.kuaizhizao.afterSalesTicket.colSalesOrder') },
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colRegisteredAt'),
        dataIndex: 'registered_at',
        width: 148,
        minWidth: 148,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, row) =>
          row.registered_at ? formatDateTime(row.registered_at, 'YYYY-MM-DD HH:mm') : '',
      },
      {
        title: t('app.kuaizhizao.afterSalesTicket.colRegisteredAtRange'),
        dataIndex: 'registered_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 32,
        formItemProps: formDateRangeFormItemProps,
      },
      ...buildDocumentAuditColumns<AfterSalesTicket>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        fixed: 'right',
        hideInSearch: true,
        render: (_, row) =>
          renderAfterSalesStatusTag(row.status, AFTER_SALES_TICKET_STATUS_COLOR),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        hideInTable: true,
        order: 21,
        valueType: 'select',
        valueEnum: statusValueEnum,
      },
      {
        title: t('common.actions'),
        key: 'action',
        valueType: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record.id)} />,
          ];
          if (perms.canUpdate && record.status !== '已关闭') {
            parts.push(
              <Button {...rowActionKind('update')} key="e" onClick={() => void openEdit(record)} />,
            );
          }
          if (perms.canAction?.('close') && record.status !== '已关闭') {
            parts.push(
              <Button
                key="close"
                type="link"
                icon={<CheckOutlined />}
                onClick={() => handleCloseTicket(record)}
              >
                {t('common.close')}
              </Button>,
            );
          }
          if (perms.canDelete) {
            parts.push(
              <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)} />,
            );
          }
          return parts;
        },
      },
    ],
    SALES_DOC_LIST_FIELD_RANK,
  );

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<AfterSalesTicket>
          columnPersistenceId="apps.kuaizhizao.pages.after-sales-service.tickets.v1"
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle={t('app.kuaizhizao.menu.after-sales-service.tickets')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          enableRowSelection={
            perms.canDelete ||
            (perms.canUpdate && (salesReturnPerms.canCreate || repairOrderPerms.canCreate))
          }
          options={{ reload: true, density: true, setting: true }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          toolBarRender={() => {
            const items: React.ReactNode[] = [];
            if (perms.canCreate) {
              items.push(
                <UniPullCreateToolbar
                  key="create-after-sales-with-pull"
                  compactKey="create-after-sales-with-pull"
                  createIcon={<PlusOutlined />}
                  createLabel={t('app.kuaizhizao.afterSalesTicket.new') + NEW_SHORTCUT_HINT}
                  onCreate={openCreate}
                  menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                    {
                      key: 'pull-from-sales-order',
                      actionKey: 'after_sales_ticket.pull_from_sales_order',
                      onClick: () => pullFromSalesOrderQuery.openModal(),
                    },
                    {
                      key: 'pull-from-sales-delivery',
                      actionKey: 'after_sales_ticket.pull_from_sales_delivery',
                      onClick: () => pullFromSalesDeliveryQuery.openModal(),
                    },
                  ])}
                />,
              );
            }
            items.push(
              <UniPushToolbarButton
                key={`push-toolbar-${selectedRowKeys.join('-') || 'none'}`}
                menuItems={toolbarPushMenuItems}
                disabled={selectedRowKeys.length !== 1 || !selectedTicketForToolbar}
                disabledReason={toolbarPushDisabledReason}
              />,
            );
            return items;
          }}
          showDeleteButton={perms.canDelete}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          request={async (params, sort, _filter, searchFormValues) => {
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            const registeredRange = searchFormValues?.registered_at_range as
              | [unknown, unknown]
              | undefined;
            let registeredFrom: string | undefined;
            let registeredTo: string | undefined;
            if (registeredRange && Array.isArray(registeredRange) && registeredRange[0]) {
              registeredFrom = formatDateTime(
                registeredRange[0] as string | Date,
                'YYYY-MM-DD HH:mm:ss',
              );
              registeredTo = registeredRange[1]
                ? formatDateTime(registeredRange[1] as string | Date, 'YYYY-MM-DD HH:mm:ss')
                : registeredFrom;
            }
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            try {
              const res = await afterSalesTicketApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
                customer_id:
                  searchFormValues?.customer_id != null && searchFormValues.customer_id !== ''
                    ? Number(searchFormValues.customer_id)
                    : undefined,
                request_type:
                  typeof searchFormValues?.request_type === 'string'
                    ? searchFormValues.request_type.trim() || undefined
                    : undefined,
                status:
                  typeof searchFormValues?.status === 'string'
                    ? searchFormValues.status.trim() || undefined
                    : undefined,
                sales_order_code:
                  typeof searchFormValues?.sales_order_code === 'string'
                    ? searchFormValues.sales_order_code.trim() || undefined
                    : undefined,
                registered_from: registeredFrom,
                registered_to: registeredTo,
                order_by: orderBy,
              });
              const rows = res.items || [];
              setTableTickets(rows);
              return {
                data: rows,
                success: true,
                total: res.total ?? 0,
              };
            } catch {
              setTableTickets([]);
              message.error(t('app.kuaizhizao.afterSalesTicket.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <AfterSalesTicketDetailDrawer
        open={detailDrawerVisible}
        onClose={closeDetailDrawer}
        record={detailRecord}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const id = detailIdRef.current;
          if (id != null) void loadDetail(id);
        }}
        extra={
          <DetailDrawerActions
            items={[
              {
                key: 'edit',
                visible: Boolean(perms.canUpdate && detailRecord && detailRecord.status !== '已关闭'),
                render: () => (
                  <Button icon={<EditOutlined />} onClick={() => void openEdit(detailRecord!)}>
                    {t('common.edit')}
                  </Button>
                ),
              },
              {
                key: 'push-repair',
                visible: Boolean(
                  detailRecord &&
                    detailRecord.request_type === '维修' &&
                    detailRecord.status !== '已关闭',
                ),
                render: () => (
                  <Button
                    icon={<ToolOutlined />}
                    disabled={Boolean(pushRepairDisabledReason(detailRecord))}
                    title={pushRepairDisabledReason(detailRecord)}
                    onClick={() => handlePushRepair(detailRecord!)}
                  >
                    {t('app.kuaizhizao.afterSalesTicket.actionPushRepairOrder')}
                  </Button>
                ),
              },
              {
                key: 'close',
                visible: Boolean(perms.canAction?.('close') && detailRecord && detailRecord.status !== '已关闭'),
                render: () => (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => handleCloseTicket(detailRecord!)}
                  >
                    {t('common.close')}
                  </Button>
                ),
              },
              {
                key: 'delete',
                visible: Boolean(perms.canDelete && detailRecord),
                render: () => (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(detailRecord!, { closeDrawer: true })}
                  >
                    {t('common.delete')}
                  </Button>
                ),
              },
            ]}
          />
        }
        footer={
          detailRecord && canPushSalesReturn(detailRecord) ? (
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => void openPushSalesReturn(detailRecord)}
            >
              {t('app.kuaizhizao.afterSalesTicket.actionPushSalesReturn')}
            </Button>
          ) : undefined
        }
      />

      <AfterSalesTicketFormModal
        open={modalOpen}
        editing={editing}
        preset={preset}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setPreset(null);
        }}
        onSuccess={() => {
          reloadTable();
          refreshOpenDetail();
        }}
      />

      <UniPullQueryModal<PullSalesOrderCandidate>
        open={pullFromSalesOrderQuery.open}
        title={pullFromSalesOrderAction.label}
        onCancel={pullFromSalesOrderQuery.closeModal}
        onOk={pullFromSalesOrderQuery.handleConfirm}
        rowKey="id"
        columns={pullSalesOrderColumns}
        dataSource={pullFromSalesOrderQuery.dataSource}
        loading={pullFromSalesOrderQuery.loading}
        confirmLoading={pullFromSalesOrderQuery.confirmLoading}
        selectionType={pullFromSalesOrderQuery.selectionType}
        selectedRowKeys={pullFromSalesOrderQuery.selectedRowKeys}
        selectedRows={pullFromSalesOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSalesOrderQuery.searchDraft}
        onSearchDraftChange={pullFromSalesOrderQuery.setSearchDraft}
        onSearchApply={pullFromSalesOrderQuery.handleSearchApply}
        onSearchClear={pullFromSalesOrderQuery.handleSearchClear}
        appliedKeyword={pullFromSalesOrderQuery.appliedKeyword}
        page={pullFromSalesOrderQuery.page}
        pageSize={pullFromSalesOrderQuery.pageSize}
        total={pullFromSalesOrderQuery.total}
        onPageChange={pullFromSalesOrderQuery.handlePageChange}
      />

      <UniPullQueryModal<PullSalesDeliveryCandidate>
        open={pullFromSalesDeliveryQuery.open}
        title={pullFromSalesDeliveryAction.label}
        onCancel={pullFromSalesDeliveryQuery.closeModal}
        onOk={pullFromSalesDeliveryQuery.handleConfirm}
        rowKey="id"
        columns={pullSalesDeliveryColumns}
        dataSource={pullFromSalesDeliveryQuery.dataSource}
        loading={pullFromSalesDeliveryQuery.loading}
        confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
        selectionType={pullFromSalesDeliveryQuery.selectionType}
        selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
        selectedRows={pullFromSalesDeliveryQuery.selectedRows}
        onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromSalesDeliveryQuery.searchDraft}
        onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
        onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
        onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
        appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
        page={pullFromSalesDeliveryQuery.page}
        pageSize={pullFromSalesDeliveryQuery.pageSize}
        total={pullFromSalesDeliveryQuery.total}
        onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
      />

      <Modal
        open={pushOpen}
        title={t('app.kuaizhizao.afterSalesTicket.pushPreviewTitle')}
        onCancel={() => setPushOpen(false)}
        onOk={() => void confirmPushSalesReturn()}
        confirmLoading={pushConfirming}
        okButtonProps={{
          disabled: Boolean(pushPreview?.has_blocking_issues) || pushLoading,
        }}
        width={860}
        destroyOnClose
      >
        {pushPreview?.message ? (
          <Typography.Paragraph type="secondary">{pushPreview.message}</Typography.Paragraph>
        ) : null}
        <div style={{ marginBottom: 12 }}>
          <ProForm submitter={false} layout="vertical">
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.afterSalesTicket.fieldWarehouse')}
              required
              width="md"
              onChange={(value, warehouse) => {
                const nextId = Number(value);
                setPushWarehouseId(Number.isFinite(nextId) && nextId > 0 ? nextId : null);
                setPushWarehouseName(String(warehouse?.name || ''));
              }}
            />
          </ProForm>
        </div>
        <Table
          size="small"
          loading={pushLoading}
          rowKey={(r) => String(r.sales_order_item_id ?? r.ticket_item_id)}
          pagination={false}
          columns={pushLineColumns}
          dataSource={pushPreview?.lines ?? []}
          locale={{ emptyText: t('app.kuaizhizao.afterSalesTicket.itemsEmpty') }}
          scroll={{ x: 700 }}
        />
      </Modal>
    </>
  );
};

export default AfterSalesTicketsPage;
