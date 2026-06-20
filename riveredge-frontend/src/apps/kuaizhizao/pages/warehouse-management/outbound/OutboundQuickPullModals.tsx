import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { App, Tag } from 'antd';
import { listSalesOrders } from '../../../services/sales-order';
import { shipmentNoticeApi } from '../../../services/shipment-notice';
import { outsourceWorkOrderApi, workOrderApi } from '../../../services/production';
import {
  OUTSOURCE_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES,
  PRODUCTION_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES,
  SALES_ORDER_OUTBOUND_ELIGIBLE_STATUSES,
  SHIPMENT_NOTICE_OUTBOUND_ELIGIBLE_STATUSES,
} from './outboundCreateConfig';
import { formatPullQty, renderPullableTag } from './outboundPullModalUtils';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import {
  outboundOutsourceEntryPath,
  outboundSalesOrderEntryPath,
  outboundWorkOrderEntryPath,
} from './outboundPaths';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';

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
};

type PullSalesOrderCandidate = {
  id: number;
  order_code?: string;
  customer_name?: string;
  status?: string;
  delivery_date?: string;
  updated_at?: string;
  total_quantity?: number;
};

type PullShipmentNoticeCandidate = {
  id: number;
  notice_code?: string;
  sales_order_code?: string;
  customer_name?: string;
  warehouse_name?: string;
  status?: string;
  updated_at?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  converted?: boolean;
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
    const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim();
          const res = await workOrderApi.list({
            skip: 0,
            limit: 100,
            keyword: kw || undefined,
          });
          const list = Array.isArray(res)
            ? res
            : (res as { data?: unknown[]; items?: unknown[] })?.data
              ?? (res as { items?: unknown[] })?.items
              ?? [];
          const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
          const candidates = rows
            .filter((wo) =>
              PRODUCTION_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES.includes(String(wo.status || '')),
            )
            .filter((wo) => {
              if (!kw) return true;
              const text = `${wo.code || ''} ${wo.product_name || wo.name || ''} ${wo.sales_order_code || ''}`.toLowerCase();
              return text.includes(kw.toLowerCase());
            })
            .map((wo) => ({
              id: Number(wo.id),
              code: String(wo.code ?? ''),
              product_name: String(wo.product_name ?? wo.name ?? ''),
              sales_order_code: String(wo.sales_order_code ?? ''),
              status: String(wo.status ?? ''),
              quantity: Number(wo.quantity ?? 0),
              updated_at: String(wo.updated_at ?? ''),
            }));
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadWorkOrdersFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectWorkOrder'));
          return;
        }
        pullFromWorkOrderQuery.closeModal();
        onSuccess();
        navigate(outboundWorkOrderEntryPath(selectedId));
      },
    });

    const pullFromSalesOrderQuery = useUniPullQuery<PullSalesOrderCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim();
          const res = await listSalesOrders({
            skip: 0,
            limit: 100,
            keyword: kw || undefined,
          });
          const data = (res as { data?: unknown[]; items?: unknown[] })?.data
            ?? (res as { items?: unknown[] })?.items
            ?? res
            ?? [];
          const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
          const candidates = rows
            .filter((so) =>
              SALES_ORDER_OUTBOUND_ELIGIBLE_STATUSES.includes(String(so.status || '')),
            )
            .filter((so) => {
              if (!kw) return true;
              const text = `${so.order_code || so.code || ''} ${so.customer_name || ''}`.toLowerCase();
              return text.includes(kw.toLowerCase());
            })
            .map((so) => ({
              id: Number(so.id),
              order_code: String(so.order_code ?? so.code ?? ''),
              customer_name: String(so.customer_name ?? ''),
              status: String(so.status ?? ''),
              delivery_date: so.delivery_date ? String(so.delivery_date) : undefined,
              updated_at: String(so.updated_at ?? ''),
              total_quantity: Number(so.total_quantity ?? 0),
            }));
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadSalesOrdersFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectSalesOrder'));
          return;
        }
        pullFromSalesOrderQuery.closeModal();
        onSuccess();
        navigate(outboundSalesOrderEntryPath(selectedId));
      },
    });

    const pullFromShipmentNoticeQuery = useUniPullQuery<PullShipmentNoticeCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
        try {
          const kw = keyword.trim().toLowerCase();
          const res = await shipmentNoticeApi.list({ skip: 0, limit: 100 });
          const data = (res as { data?: unknown[]; items?: unknown[] })?.data
            ?? (res as { items?: unknown[] })?.items
            ?? res
            ?? [];
          const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
          const candidates = rows
            .filter((n) =>
              SHIPMENT_NOTICE_OUTBOUND_ELIGIBLE_STATUSES.includes(String(n.status || '')),
            )
            .filter((n) => {
              if (!kw) return true;
              const text = `${n.notice_code || ''} ${n.sales_order_code || ''} ${n.customer_name || ''}`.toLowerCase();
              return text.includes(kw);
            })
            .map((n) => ({
              id: Number(n.id),
              notice_code: String(n.notice_code ?? ''),
              sales_order_code: String(n.sales_order_code ?? ''),
              customer_name: String(n.customer_name ?? ''),
              warehouse_name: String(n.warehouse_name ?? ''),
              status: String(n.status ?? ''),
              updated_at: String(n.updated_at ?? ''),
              sales_delivery_id: n.sales_delivery_id != null ? Number(n.sales_delivery_id) : undefined,
              sales_delivery_code: n.sales_delivery_code ? String(n.sales_delivery_code) : undefined,
              converted: !!n.sales_delivery_id,
            }));
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadShipmentNoticesFailed'));
          return { data: [], total: 0 };
        }
      },
      isRowDisabled: (record) => !!record.converted,
      onConfirm: async (keys, rows) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectShipmentNotice'));
          return;
        }
        const selected = rows[0];
        if (selected?.converted) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.shipmentNoticeConverted'));
          return;
        }
        try {
          const notice = (await shipmentNoticeApi.get(String(selectedId))) as {
            sales_order_id?: number;
          };
          const soId = Number(notice?.sales_order_id);
          if (!Number.isFinite(soId) || soId <= 0) {
            messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.shipmentNoticeNoSalesOrder'));
            return;
          }
          pullFromShipmentNoticeQuery.closeModal();
          onSuccess();
          navigate(outboundSalesOrderEntryPath(soId));
        } catch (error: unknown) {
          const err = error as { response?: { data?: { detail?: string | { message?: string } } }; message?: string };
          const detail = err?.response?.data?.detail;
          const message =
            (typeof detail === 'string' ? detail : (detail as { message?: string })?.message)
            || err?.message
            || t('app.kuaizhizao.warehouseOutbound.pull.loadShipmentNoticeFailed');
          messageApi.error(message);
        }
      },
    });

    const pullFromOutsourceWorkOrderQuery = useUniPullQuery<PullOutsourceWoCandidate>({
      rowKey: 'id',
      selectionType: 'radio',
      loadData: async ({ keyword, page, pageSize }) => {
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
              OUTSOURCE_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES.includes(String(r.status || '')),
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
          const start = (page - 1) * pageSize;
          return { data: candidates.slice(start, start + pageSize), total: candidates.length };
        } catch {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadOutsourceFailed'));
          return { data: [], total: 0 };
        }
      },
      onConfirm: async (keys) => {
        const selectedId = Number(keys[0]);
        if (!selectedId) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectOutsource'));
          return;
        }
        pullFromOutsourceWorkOrderQuery.closeModal();
        onSuccess();
        navigate(outboundOutsourceEntryPath(selectedId));
      },
    });

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
        { title: t('app.kuaizhizao.warehouseOutbound.field.quantity'), dataIndex: 'quantity', width: 80, align: 'right' as const, render: formatPullQty },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 160,
          render: (v: string) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.pullable'), key: 'pullable', width: 90, align: 'center' as const, render: () => renderPullableTag(t, true) },
      ],
      [t],
    );

    const salesOrderColumns = useMemo(
      () => [
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colOrderCode'), dataIndex: 'order_code', width: 140, ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.customer'), dataIndex: 'customer_name', ellipsis: true },
        { title: t('app.kuaizhizao.warehouseOutbound.col.status'), dataIndex: 'status', width: 90, align: 'center' as const },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colOrderQty'), dataIndex: 'total_quantity', width: 100, align: 'right' as const, render: formatPullQty },
        {
          title: t('app.kuaizhizao.warehouseOutbound.col.updatedAt'),
          dataIndex: 'updated_at',
          width: 160,
          render: (v: string) => (v ? formatDateTimeBySiteSetting(String(v)) : '—'),
        },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.pullable'), key: 'pullable', width: 90, align: 'center' as const, render: () => renderPullableTag(t, true) },
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
          title: t('app.kuaizhizao.warehouseOutbound.pull.convertStatus'),
          key: 'convert_status',
          width: 170,
          align: 'center' as const,
          render: (_: unknown, r: PullShipmentNoticeCandidate) =>
            r.converted ? (
              <Tag color="gold">{t('app.kuaizhizao.warehouseOutbound.pull.alreadyCreated', { code: r.sales_delivery_code || r.sales_delivery_id })}</Tag>
            ) : (
              <Tag color="success">{t('app.kuaizhizao.warehouseOutbound.pull.canCreate')}</Tag>
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
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colPlannedQty'), dataIndex: 'quantity', width: 100, align: 'right' as const, render: formatPullQty },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.colIssuedQty'), dataIndex: 'issued_quantity', width: 100, align: 'right' as const, render: formatPullQty },
        {
          title: t('app.kuaizhizao.warehouseOutbound.pull.colPendingIssue'),
          key: 'pending_issue',
          width: 100,
          align: 'right' as const,
          render: (_: unknown, r: PullOutsourceWoCandidate) => {
            const pending = Math.max(0, Number(r.quantity || 0) - Number(r.issued_quantity || 0));
            return formatPullQty(pending);
          },
        },
        { title: t('app.kuaizhizao.warehouseOutbound.pull.pullable'), key: 'pullable', width: 90, align: 'center' as const, render: () => renderPullableTag(t, true) },
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
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
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
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
          cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
          okButtonProps={{ disabled: pullFromSalesOrderQuery.selectedRowKeys.length === 0 }}
          width={1200}
          tableScroll={{ x: 1000, y: 360 }}
        />

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
          okText={t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
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
