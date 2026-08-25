import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Table, Tag, Typography } from 'antd';
import {
  ShoppingCartOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  UserOutlined,
  FileSearchOutlined,
  BellOutlined,
  RocketOutlined,
  RollbackOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mesDashboardService } from '../../../services/dashboard';
import { listPurchaseOrders, type PurchaseOrder } from '../../../services/purchase';
import { listPurchaseRequisitions } from '../../../services/purchase-requisition';
import {
  listPurchaseArrivalWarnings,
  type PurchaseArrivalWarningRow,
} from '../../../services/purchase-arrival';
import { getPurchaseTop10 } from '../../../../../services/dashboard';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_PURCHASE_ORDER_FIELD_RESOURCE as PO } from '../../../constants/fieldPermissionResources';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import { formatDateTime } from '../../../../../utils/format';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleTrendLine,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

const PurchaseTopColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

/** 到货预警行按采购订单去重（取最早要求到货日） */
function dedupeWarningsByPurchaseOrder(
  rows: PurchaseArrivalWarningRow[],
): PurchaseArrivalWarningRow[] {
  const byPo = new Map<number, PurchaseArrivalWarningRow>();
  for (const row of rows) {
    const poId = Number(row.purchase_order_id);
    if (!Number.isFinite(poId) || poId <= 0) continue;
    const prev = byPo.get(poId);
    if (!prev) {
      byPo.set(poId, row);
      continue;
    }
    const prevDate = prev.required_date ? String(prev.required_date) : '';
    const nextDate = row.required_date ? String(row.required_date) : '';
    if (nextDate && (!prevDate || nextDate < prevDate)) {
      byPo.set(poId, row);
    }
  }
  return Array.from(byPo.values());
}

const PurchaseDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trendType, setTrendType] = useState<'amount' | 'quantity'>('amount');

  const openPurchaseOrder = useCallback((orderId: number) => {
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    navigate('/apps/kuaizhizao/purchase-management/purchase-orders', {
      state: { openPurchaseOrderId: orderId },
    });
  }, [navigate]);

  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    mesDashboardService.getPurchaseSummary,
    'kz:purchase-dashboard:summary',
  );
  const { data: todosData, loading: todosLoading } = useDashboardRequest(
    () => mesDashboardService.getTodosByModule('purchase', 8),
    'kz:purchase-dashboard:todos',
  );
  const { data: recentOrdersData, loading: ordersLoading } = useDashboardRequest(
    () => listPurchaseOrders({ limit: 50, order_by: 'delivery_date' }),
    'kz:purchase-dashboard:recent-orders',
  );
  const { data: overdueWarningsData, loading: overdueLoading } = useDashboardRequest(
    () => listPurchaseArrivalWarnings({ warning_level: 'overdue', limit: 50 }),
    'kz:purchase-dashboard:overdue-warnings',
  );
  const { data: recentRequisitionsData, loading: requisitionsLoading } = useDashboardRequest(
    () => listPurchaseRequisitions({ limit: 8 }),
    'kz:purchase-dashboard:recent-requisitions',
  );
  const { data: trendData, loading: trendLoading } = useDashboardRequest(
    mesDashboardService.getPurchaseTrend,
    'kz:purchase-dashboard:trend',
  );
  const { data: top10Data, loading: topLoading } = useDashboardRequest(
    () => getPurchaseTop10(undefined, undefined, 8),
    'kz:purchase-dashboard:top10',
  );

  const s = summary as Record<string, number> | undefined;
  const recentOrders = recentOrdersData?.data || [];
  const recentRequisitions = recentRequisitionsData?.data || [];
  const todos = todosData?.items || [];

  // 待到货：仍有未到货数量（与采购中心 KPI / 到货预警口径一致），禁止仅凭头状态猜测
  const pendingReceiptOrders = useMemo(
    () =>
      (recentOrders as PurchaseOrder[]).filter(
        (r) => Number(r.outstanding_total ?? 0) > 0,
      ),
    [recentOrders],
  );

  // 逾期未到货：到货预警真源（行级未关闭且逾期），按订单去重
  const overdueReceiptOrders = useMemo(
    () => dedupeWarningsByPurchaseOrder(overdueWarningsData?.data || []).slice(0, 6),
    [overdueWarningsData],
  );

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'requisitions',
        title: t('app.kuaizhizao.purchaseDashboard.kpi.pendingRequisitions'),
        value: s?.pending_requisitions ?? 0,
        subtitle: t('app.kuaizhizao.purchaseDashboard.kpi.newRequisitionsThisMonth', {
          count: s?.new_requisitions_this_month ?? 0,
        }),
        icon: <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions'),
        sideMetrics: [{
          label: t('app.kuaizhizao.purchaseDashboard.kpi.newThisMonth'),
          value: s?.new_requisitions_this_month ?? 0,
        }],
      },
      {
        key: 'receipts',
        title: t('app.kuaizhizao.purchaseDashboard.kpi.pendingReceipts'),
        value: s?.pending_receipts ?? 0,
        subtitle:
          (s?.overdue_receipts ?? 0) > 0
            ? t('app.kuaizhizao.purchaseDashboard.kpi.overdueReceiptsSubtitle', { count: s?.overdue_receipts })
            : t('app.kuaizhizao.purchaseDashboard.kpi.allReceiptsOnTime'),
        icon: <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/purchase-management/arrival-warnings'),
        sideMetrics: [{
          label: t('app.kuaizhizao.purchaseDashboard.kpi.overdue'),
          value: s?.overdue_receipts ?? 0,
        }],
      },
      {
        key: 'arrival',
        title: t('app.kuaizhizao.purchaseDashboard.kpi.arrivalRate'),
        value: `${s?.arrival_rate ?? 0}%`,
        icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
        progress: s?.arrival_rate ?? 0,
      },
    ],
    [navigate, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      { key: 'req', title: t('app.kuaizhizao.purchaseDashboard.shortcut.requisition'), icon: <FileSearchOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-requisitions' },
      { key: 'po', title: t('app.kuaizhizao.purchaseDashboard.shortcut.purchaseOrder'), icon: <ShoppingCartOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
      { key: 'warn', title: t('app.kuaizhizao.menu.purchase-management.arrival-warnings'), icon: <AlertOutlined style={{ fontSize: 22, color: '#fa541c' }} />, path: '/apps/kuaizhizao/purchase-management/arrival-warnings' },
      { key: 'supplier', title: t('app.kuaizhizao.purchaseDashboard.shortcut.supplier'), icon: <UserOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/purchase-management/suppliers' },
      { key: 'notice', title: t('app.kuaizhizao.purchaseDashboard.shortcut.receiptNotice'), icon: <BellOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/kuaizhizao/purchase-management/receipt-notices' },
      { key: 'return', title: t('app.kuaizhizao.purchaseDashboard.shortcut.purchaseReturn'), icon: <RollbackOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-returns' },
    ],
    [t],
  );

  const requisitionColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseDashboard.colRequisitionCode'),
        dataIndex: 'requisition_code',
        render: (text: string) => (
          <a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>{text}</a>
        ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (status: string) => <Tag color="warning">{status}</Tag>,
      },
    ],
    [navigate, t],
  );

  const orderColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseDashboard.colOrderCode'),
        dataIndex: 'order_code',
        ellipsis: true,
        render: (text: string, record: PurchaseOrder) => (
          <a onClick={() => openPurchaseOrder(Number(record.id))}>{text}</a>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseDashboard.colSupplier'),
        dataIndex: 'supplier_name',
        ellipsis: true,
        render: (name: string | null | undefined) => name || '-',
      },
      {
        title: t('app.kuaizhizao.purchaseDashboard.colAmount'),
        dataIndex: 'total_amount',
        align: 'right' as const,
        width: 96,
        render: (val: number | null) => (
          <Text strong>
            <AmountDisplay resource={PO} fieldName="total_amount" value={val != null ? Number(val) : null} />
          </Text>
        ),
      },
    ],
    [openPurchaseOrder, t],
  );

  const overdueColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseDashboard.colOrderCode'),
        dataIndex: 'order_code',
        ellipsis: true,
        render: (text: string, record: PurchaseArrivalWarningRow) => (
          <a onClick={() => openPurchaseOrder(Number(record.purchase_order_id))}>{text}</a>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseDashboard.colSupplier'),
        dataIndex: 'supplier_name',
        ellipsis: true,
        render: (name: string | null | undefined) => name || '-',
      },
      {
        title: t('app.kuaizhizao.purchaseDashboard.colDeliveryDate'),
        dataIndex: 'required_date',
        width: 72,
        render: (date: string) => (date ? formatDateTime(date, 'MM-DD') : '-'),
      },
    ],
    [openPurchaseOrder, t],
  );

  const trendChartData = useMemo(() => {
    const items = trendData?.items || [];
    return items.map((it) => ({
      date: it.date,
      value: trendType === 'amount' ? it.amount : it.quantity,
    }));
  }, [trendData, trendType]);

  const topChartData = useMemo(() => {
    return (top10Data?.items || []).map((it: { material_name?: string; quantity?: number }) => ({
      name: (it.material_name || '').slice(0, 8),
      quantity: it.quantity ?? 0,
    }));
  }, [top10Data]);

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={
        <ModuleShortcutGrid
          items={shortcuts}
          colProps={{ xs: 12, sm: 8, md: 4, lg: 4 }}
          fillByItemCount
        />
      }
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.todosTitle')}
            loading={todosLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>{t('app.kuaizhizao.purchaseDashboard.viewAll')}</a>}
          >
            <ModuleTodoList items={todos} emptyText={t('app.kuaizhizao.purchaseDashboard.noTodos')} />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.pendingRequisitionsTitle')}
            loading={requisitionsLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>{t('app.kuaizhizao.purchaseDashboard.all')}</a>}
          >
            <Table
              size="small"
              tableLayout="fixed"
              dataSource={recentRequisitions.filter((r: { status?: string }) =>
                ['待审核', '审批中', 'draft', 'pending'].includes(String(r.status)),
              ).slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={requisitionColumns}
              locale={{ emptyText: t('app.kuaizhizao.purchaseDashboard.noPendingRequisitions') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.pendingOrdersTitle')}
            loading={ordersLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-orders')}>{t('app.kuaizhizao.purchaseDashboard.all')}</a>}
          >
            <Table
              size="small"
              tableLayout="fixed"
              dataSource={pendingReceiptOrders.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={orderColumns}
              locale={{ emptyText: t('app.kuaizhizao.purchaseDashboard.noPendingOrders') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.overdueReceiptsTitle')}
            loading={overdueLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/arrival-warnings')}>{t('app.kuaizhizao.purchaseDashboard.all')}</a>}
          >
            <Table
              size="small"
              tableLayout="fixed"
              dataSource={overdueReceiptOrders}
              pagination={false}
              rowKey={(r) => String(r.purchase_order_id)}
              columns={overdueColumns}
              locale={{ emptyText: t('app.kuaizhizao.purchaseDashboard.noOverdueReceipts') }}
            />
          </ModuleActionPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.trendTitle')}
            loading={trendLoading}
            segmented={{
              value: trendType,
              options: [
                { label: t('app.kuaizhizao.purchaseDashboard.trendAmount'), value: 'amount' },
                { label: t('common.quantity'), value: 'quantity' },
              ],
              onChange: (v) => setTrendType(v as 'amount' | 'quantity'),
            }}
          >
            <ModuleTrendLine
                data={trendChartData}
                xField="date"
                yField="value"
                height={240}
                axis={{ y: { title: false }, x: { title: false } }}
              />
          </ModuleChartPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.purchaseDashboard.topMaterialsTitle')}
            loading={topLoading}
          >
            <Suspense fallback={null}>
              <PurchaseTopColumn
                data={topChartData}
                xField="name"
                yField="quantity"
                height={240}
                label={{ position: 'top' }}
                axis={{ y: { title: false }, x: { title: false } }}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default PurchaseDashboard;
