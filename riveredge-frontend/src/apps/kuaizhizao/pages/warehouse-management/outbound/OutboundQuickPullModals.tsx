import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Modal, Space, Table, Tag } from 'antd';
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
    const [activeKey, setActiveKey] = useState<OutboundQuickPullKey | null>(null);

    const [pullWoLoading, setPullWoLoading] = useState(false);
    const [pullWoKeyword, setPullWoKeyword] = useState('');
    const [pullWoCandidates, setPullWoCandidates] = useState<PullWorkOrderCandidate[]>([]);
    const [selectedPullWoId, setSelectedPullWoId] = useState<number | null>(null);

    const [pullSoLoading, setPullSoLoading] = useState(false);
    const [pullSoKeyword, setPullSoKeyword] = useState('');
    const [pullSoCandidates, setPullSoCandidates] = useState<PullSalesOrderCandidate[]>([]);
    const [selectedPullSoId, setSelectedPullSoId] = useState<number | null>(null);

    const [pullSnLoading, setPullSnLoading] = useState(false);
    const [pullSnSubmitting, setPullSnSubmitting] = useState(false);
    const [pullSnKeyword, setPullSnKeyword] = useState('');
    const [pullSnCandidates, setPullSnCandidates] = useState<PullShipmentNoticeCandidate[]>([]);
    const [selectedPullSnId, setSelectedPullSnId] = useState<number | null>(null);

    const [pullOutsourceWoLoading, setPullOutsourceWoLoading] = useState(false);
    const [pullOutsourceWoKeyword, setPullOutsourceWoKeyword] = useState('');
    const [pullOutsourceWoCandidates, setPullOutsourceWoCandidates] = useState<PullOutsourceWoCandidate[]>([]);
    const [selectedOutsourceWoId, setSelectedOutsourceWoId] = useState<number | undefined>();

    const closeModal = useCallback(() => {
      setActiveKey(null);
      setSelectedPullWoId(null);
      setSelectedPullSoId(null);
      setSelectedPullSnId(null);
      setSelectedOutsourceWoId(undefined);
      setPullWoKeyword('');
      setPullSoKeyword('');
      setPullSnKeyword('');
      setPullOutsourceWoKeyword('');
    }, []);

    const loadWorkOrders = useCallback(async (keyword = '') => {
      setPullWoLoading(true);
      try {
        const kw = keyword.trim();
        const res = await workOrderApi.list({
          skip: 0,
          limit: 100,
          keyword: kw || undefined,
        });
        const list = Array.isArray(res) ? res : (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? [];
        const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
        setPullWoCandidates(
          rows
            .filter((wo) => PRODUCTION_WORK_ORDER_OUTBOUND_ELIGIBLE_STATUSES.includes(String(wo.status || '')))
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
            })),
        );
      } catch {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadWorkOrdersFailed'));
        setPullWoCandidates([]);
      } finally {
        setPullWoLoading(false);
      }
    }, [messageApi, t]);

    const loadSalesOrders = useCallback(async (keyword = '') => {
      setPullSoLoading(true);
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
        setPullSoCandidates(
          rows
            .filter((so) => SALES_ORDER_OUTBOUND_ELIGIBLE_STATUSES.includes(String(so.status || '')))
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
            })),
        );
      } catch {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadSalesOrdersFailed'));
        setPullSoCandidates([]);
      } finally {
        setPullSoLoading(false);
      }
    }, [messageApi, t]);

    const loadShipmentNotices = useCallback(async (keyword = '') => {
      setPullSnLoading(true);
      try {
        const kw = keyword.trim().toLowerCase();
        const res = await shipmentNoticeApi.list({ skip: 0, limit: 100 });
        const data = (res as { data?: unknown[]; items?: unknown[] })?.data
          ?? (res as { items?: unknown[] })?.items
          ?? res
          ?? [];
        const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
        setPullSnCandidates(
          rows
            .filter((n) => SHIPMENT_NOTICE_OUTBOUND_ELIGIBLE_STATUSES.includes(String(n.status || '')))
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
            })),
        );
      } catch {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadShipmentNoticesFailed'));
        setPullSnCandidates([]);
      } finally {
        setPullSnLoading(false);
      }
    }, [messageApi, t]);

    const loadOutsourceWorkOrders = useCallback(async (keyword = '') => {
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
        setPullOutsourceWoCandidates(
          (Array.isArray(rows) ? rows : [])
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
            })),
        );
      } catch {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.loadOutsourceFailed'));
        setPullOutsourceWoCandidates([]);
      } finally {
        setPullOutsourceWoLoading(false);
      }
    }, [messageApi, t]);

    useImperativeHandle(ref, () => ({
      open: (key: OutboundQuickPullKey) => {
        setActiveKey(key);
        if (key === 'work_order') {
          setSelectedPullWoId(null);
          void loadWorkOrders();
        } else if (key === 'sales_order') {
          setSelectedPullSoId(null);
          void loadSalesOrders();
        } else if (key === 'shipment_notice') {
          setSelectedPullSnId(null);
          void loadShipmentNotices();
        } else {
          setSelectedOutsourceWoId(undefined);
          void loadOutsourceWorkOrders();
        }
      },
    }));

    const goWorkOrderEntry = () => {
      if (!selectedPullWoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectWorkOrder'));
        return;
      }
      closeModal();
      onSuccess();
      navigate(outboundWorkOrderEntryPath(selectedPullWoId));
    };

    const goSalesOrderEntry = () => {
      if (!selectedPullSoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectSalesOrder'));
        return;
      }
      closeModal();
      onSuccess();
      navigate(outboundSalesOrderEntryPath(selectedPullSoId));
    };

    const handleShipmentNoticeConfirm = async () => {
      if (!selectedPullSnId) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectShipmentNotice'));
        return;
      }
      const selected = pullSnCandidates.find((x) => x.id === selectedPullSnId);
      if (selected?.converted) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.shipmentNoticeConverted'));
        return;
      }
      setPullSnSubmitting(true);
      try {
        const notice = (await shipmentNoticeApi.get(String(selectedPullSnId))) as {
          sales_order_id?: number;
        };
        const soId = Number(notice?.sales_order_id);
        if (!Number.isFinite(soId) || soId <= 0) {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.pull.shipmentNoticeNoSalesOrder'));
          return;
        }
        closeModal();
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
      } finally {
        setPullSnSubmitting(false);
      }
    };

    const goOutsourceEntry = () => {
      if (!selectedOutsourceWoId) {
        messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.selectOutsource'));
        return;
      }
      closeModal();
      onSuccess();
      navigate(outboundOutsourceEntryPath(selectedOutsourceWoId));
    };

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
        <Modal
          title={t('app.kuaizhizao.warehouseOutbound.pull.fromWorkOrder')}
          open={activeKey === 'work_order'}
          onCancel={closeModal}
          width={1200}
          footer={
            <Space>
              <Button onClick={closeModal}>{t('app.kuaizhizao.warehouseOutbound.action.cancel')}</Button>
              <Button type="primary" disabled={!selectedPullWoId} onClick={goWorkOrderEntry}>
                {t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
              </Button>
            </Space>
          }
          destroyOnHidden
        >
          <Input.Search
            placeholder={t('app.kuaizhizao.warehouseOutbound.pull.searchWorkOrder')}
            allowClear
            style={{ marginBottom: 12 }}
            value={pullWoKeyword}
            onChange={(e) => setPullWoKeyword(e.target.value)}
            onSearch={(v) => void loadWorkOrders(v)}
            enterButton={t('app.kuaizhizao.warehouseOutbound.action.search')}
          />
          <Table<PullWorkOrderCandidate>
            size="small"
            loading={pullWoLoading}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1100, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullWoId != null ? [selectedPullWoId] : [],
              onChange: (keys) => setSelectedPullWoId(keys[0] != null ? Number(keys[0]) : null),
            }}
            onRow={(record) => ({
              onClick: () => setSelectedPullWoId(record.id),
            })}
            dataSource={pullWoCandidates}
            columns={workOrderColumns}
          />
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseOutbound.pull.fromSalesOrder')}
          open={activeKey === 'sales_order'}
          onCancel={closeModal}
          width={1200}
          footer={
            <Space>
              <Button onClick={closeModal}>{t('app.kuaizhizao.warehouseOutbound.action.cancel')}</Button>
              <Button type="primary" disabled={!selectedPullSoId} onClick={goSalesOrderEntry}>
                {t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
              </Button>
            </Space>
          }
          destroyOnHidden
        >
          <Input.Search
            placeholder={t('app.kuaizhizao.warehouseOutbound.pull.searchSalesOrder')}
            allowClear
            style={{ marginBottom: 12 }}
            value={pullSoKeyword}
            onChange={(e) => setPullSoKeyword(e.target.value)}
            onSearch={(v) => void loadSalesOrders(v)}
            enterButton={t('app.kuaizhizao.warehouseOutbound.action.search')}
          />
          <Table<PullSalesOrderCandidate>
            size="small"
            loading={pullSoLoading}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1000, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullSoId != null ? [selectedPullSoId] : [],
              onChange: (keys) => setSelectedPullSoId(keys[0] != null ? Number(keys[0]) : null),
            }}
            onRow={(record) => ({
              onClick: () => setSelectedPullSoId(record.id),
            })}
            dataSource={pullSoCandidates}
            columns={salesOrderColumns}
          />
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseOutbound.pull.fromShipmentNotice')}
          open={activeKey === 'shipment_notice'}
          onCancel={() => {
            if (pullSnSubmitting) return;
            closeModal();
          }}
          onOk={() => {
            void handleShipmentNoticeConfirm();
          }}
          confirmLoading={pullSnSubmitting}
          width={1240}
          okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
          destroyOnHidden
        >
          <Input.Search
            placeholder={t('app.kuaizhizao.warehouseOutbound.pull.searchShipmentNotice')}
            allowClear
            style={{ marginBottom: 12 }}
            value={pullSnKeyword}
            onChange={(e) => setPullSnKeyword(e.target.value)}
            onSearch={(v) => void loadShipmentNotices(v)}
            enterButton={t('app.kuaizhizao.warehouseOutbound.action.search')}
          />
          <Table<PullShipmentNoticeCandidate>
            size="small"
            loading={pullSnLoading}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1100, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullSnId != null ? [selectedPullSnId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                setSelectedPullSnId(Number.isFinite(next) && next > 0 ? next : null);
              },
              getCheckboxProps: (record) => ({ disabled: !!record.converted }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                setSelectedPullSnId(record.id);
              },
            })}
            dataSource={pullSnCandidates}
            columns={shipmentNoticeColumns}
          />
        </Modal>

        <Modal
          title={t('app.kuaizhizao.warehouseOutbound.pull.fromOutsource')}
          open={activeKey === 'outsource'}
          onCancel={closeModal}
          width={1200}
          footer={
            <Space>
              <Button onClick={closeModal}>{t('app.kuaizhizao.warehouseOutbound.action.cancel')}</Button>
              <Button type="primary" disabled={!selectedOutsourceWoId} onClick={goOutsourceEntry}>
                {t('app.kuaizhizao.warehouseOutbound.action.enterEntryPage')}
              </Button>
            </Space>
          }
          destroyOnHidden
        >
          <Input.Search
            placeholder={t('app.kuaizhizao.warehouseOutbound.pull.searchOutsource')}
            allowClear
            style={{ marginBottom: 12 }}
            value={pullOutsourceWoKeyword}
            onChange={(e) => setPullOutsourceWoKeyword(e.target.value)}
            onSearch={(v) => void loadOutsourceWorkOrders(v)}
            enterButton={t('app.kuaizhizao.warehouseOutbound.action.search')}
          />
          <Table<PullOutsourceWoCandidate>
            size="small"
            loading={pullOutsourceWoLoading}
            rowKey="id"
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
            dataSource={pullOutsourceWoCandidates}
            columns={outsourceColumns}
          />
        </Modal>
      </>
    );
  },
);

OutboundQuickPullModals.displayName = 'OutboundQuickPullModals';

export default OutboundQuickPullModals;
