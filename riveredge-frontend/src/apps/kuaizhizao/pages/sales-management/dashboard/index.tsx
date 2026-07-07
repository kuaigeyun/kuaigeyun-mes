import React, { useMemo, useState, useCallback } from 'react';
import { Table, Tag, Typography, Progress, Button, theme } from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  RiseOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  SolutionOutlined,
  FileDoneOutlined,
  TeamOutlined,
  BellOutlined,
  FileProtectOutlined,
  PlusOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { listSalesOrders } from '../../../services/sales-order';
import { listQuotations } from '../../../services/quotation';
import { customerFollowUpApi } from '../../../services/customer-follow-up';
import { getSalesTop10 } from '../../../../../services/dashboard';
import { getSalesReport } from '../../../services/reports';
import salesContractApi from '../../../services/sales-contract';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_ORDER_FIELD_RESOURCE as SO } from '../../../constants/fieldPermissionResources';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useThemeStore } from '../../../../../stores/themeStore';
import { canViewKuaizhizaoPricing } from '../../../../../utils/kuaizhizaoPricingPermission';
import { useUserFieldMasks } from '../../../../../hooks/useUserFieldMasks';
import { resolveAmountFieldVisibility } from '../../../../../utils/fieldMaskPermission';
import { getStatusDisplay } from '../../../constants/documentStatus';
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
  isModuleDashboardPlain,
  resolveModuleRankBadgeStyle,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text, Paragraph } = Typography;

/** 与后端 SALES_ORDER_PENDING_SHIP_STATUS 对齐 */
const PENDING_DELIVERY_STATUS = new Set([
  'approved', 'confirmed',
  '已审核', '已确认', '已下达', '执行中', '进行中',
  'APPROVED', 'AUDITED', 'CONFIRMED', 'RELEASED', 'IN_PROGRESS',
]);

const PENDING_QUOTATION_STATUS = new Set([
  '草稿', '待审核', 'draft', 'pending', 'DRAFT', 'PENDING_REVIEW', 'PENDING',
]);

function isPendingDeliveryOrder(order: { status?: string; delivery_progress?: number | null }): boolean {
  const status = String(order?.status ?? '').trim();
  if (!status || !PENDING_DELIVERY_STATUS.has(status)) return false;
  return Number(order?.delivery_progress ?? 0) < 100;
}

function isDeliveryOverdue(deliveryDate?: string | null): boolean {
  if (!deliveryDate) return false;
  return dayjs(deliveryDate).isBefore(dayjs(), 'day');
}

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const isPlain = isModuleDashboardPlain(themeStyle);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const fieldMasks = useUserFieldMasks();
  const showMoney =
    resolveAmountFieldVisibility(fieldMasks, SO, 'total_amount', canViewKuaizhizaoPricing(currentUser)) === 'show';

  const [trendType, setTrendType] = useState<'revenue' | 'quantity'>(showMoney ? 'revenue' : 'quantity');
  const [rankType, setRankType] = useState<'products' | 'customers'>('products');

  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    mesDashboardService.getSalesSummary,
    'kz:sales-dashboard:summary',
  );

  const { data: todosData, loading: todosLoading } = useDashboardRequest(
    () => mesDashboardService.getTodosByModule('sales', 8),
    'kz:sales-dashboard:todos',
  );

  const { data: pendingFollowUpsData, loading: pendingFollowUpsLoading } = useDashboardRequest(
    () => customerFollowUpApi.list({ pending_only: true, limit: 5 }),
    'kz:sales-dashboard:pending-follow-ups',
  );

  const { data: recentOrdersData, loading: ordersLoading } = useDashboardRequest(
    () => listSalesOrders({ limit: 50, order_by: 'delivery_date' }),
    'kz:sales-dashboard:recent-orders',
  );

  const { data: quotationsData, loading: quotationsLoading } = useDashboardRequest(
    () => listQuotations({ limit: 20 }),
    'kz:sales-dashboard:quotations',
  );

  const { data: followUpsData, loading: followUpsLoading } = useDashboardRequest(
    () => customerFollowUpApi.list({ limit: 6 }),
    'kz:sales-dashboard:follow-ups',
  );

  const { data: topProductsData, loading: topProductsLoading } = useDashboardRequest(
    () => getSalesTop10(),
    'kz:sales-dashboard:top-products',
  );

  const { data: salesTrendRaw, loading: trendLoading } = useDashboardRequest(
    () => getSalesReport({ report_type: 'trend' }).then((res) => res.data || []),
    'kz:sales-dashboard:trend',
  );

  const { data: contractAlerts = [], loading: contractAlertsLoading } = useDashboardRequest(
    () => salesContractApi.listAlerts(),
    'kz:sales-dashboard:contract-alerts',
  );

  const { data: frameworkContracts = [], loading: frameworkLoading } = useDashboardRequest(
    () => salesContractApi.executionSummary(),
    'kz:sales-dashboard:framework-contracts',
  );

  const s = summary as Record<string, number> | undefined;
  const todos = todosData?.items || [];
  const pendingFollowUps = pendingFollowUpsData?.items || [];
  const pendingFollowUpTotal = pendingFollowUpsData?.total ?? pendingFollowUps.length;
  const recentOrders = recentOrdersData?.data || [];
  const recentFollowUps = followUpsData?.items || [];

  const pendingQuotations = useMemo(
    () =>
      (quotationsData?.data || []).filter((q) =>
        PENDING_QUOTATION_STATUS.has(String(q.status ?? '').trim()),
      ),
    [quotationsData],
  );

  const pendingDeliveryOrders = useMemo(
    () =>
      recentOrders
        .filter(isPendingDeliveryOrder)
        .sort((a: { delivery_date?: string | null }, b: { delivery_date?: string | null }) => {
          const aOverdue = isDeliveryOverdue(a.delivery_date);
          const bOverdue = isDeliveryOverdue(b.delivery_date);
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
          const da = a.delivery_date ? dayjs(a.delivery_date) : dayjs('2099-12-31');
          const db = b.delivery_date ? dayjs(b.delivery_date) : dayjs('2099-12-31');
          return da.valueOf() - db.valueOf();
        }),
    [recentOrders],
  );

  const trendData = useMemo(() => {
    const raw = salesTrendRaw || [];
    const months = Array.from({ length: 6 }).map((_, i) =>
      dayjs().subtract(5 - i, 'month').format('YYYY-MM'),
    );
    const rawMap = new Map(raw.map((r: { month?: string; revenue?: number; total_amount?: number; quantity?: number; order_count?: number }) => [r.month, r]));
    return months.map((m) => {
      const exist = rawMap.get(m);
      if (exist) {
        return {
          month: m,
          revenue: Number(exist.revenue ?? exist.total_amount) || 0,
          quantity: Number(exist.quantity ?? exist.order_count) || 0,
        };
      }
      return { month: m, revenue: 0, quantity: 0 };
    });
  }, [salesTrendRaw]);

  const topProducts = useMemo(() => {
    const raw = topProductsData || [];
    return raw
      .map((r: { material_name?: string; name?: string; quantity?: number; amount?: number }) => ({
        material_name: r.material_name || r.name || t('app.kuaizhizao.salesDashboard.unknownProduct'),
        quantity: Number(r.quantity) || 0,
        amount: Number(r.amount) || 0,
      }))
      .filter((x) => x.quantity > 0)
      .slice(0, 5);
  }, [topProductsData, t]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; amount: number; orderCount: number }> = {};
    recentOrders.forEach((o: { customer_name?: string; total_amount?: number }) => {
      if (!o.customer_name) return;
      if (!map[o.customer_name]) {
        map[o.customer_name] = { name: o.customer_name, amount: 0, orderCount: 0 };
      }
      map[o.customer_name].amount += Number(o.total_amount) || 0;
      map[o.customer_name].orderCount += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [recentOrders]);

  const overdueFollowUpCount = useMemo(
    () =>
      pendingFollowUps.filter((item) =>
        item.next_follow_up_at ? dayjs(item.next_follow_up_at).isBefore(dayjs(), 'day') : false,
      ).length,
    [pendingFollowUps],
  );

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'follow-ups',
        title: t('app.kuaizhizao.salesDashboard.kpi.pendingFollowUps'),
        value: pendingFollowUpTotal,
        subtitle: t('app.kuaizhizao.salesDashboard.kpi.pendingFollowUpsSubtitle'),
        icon: <CustomerServiceOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
        boxShadow: '0 4px 12px rgba(250, 140, 22, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups'),
        sideMetrics: [{
          label: t('app.kuaizhizao.salesDashboard.kpi.overdue'),
          value: overdueFollowUpCount,
        }],
      },
      {
        key: 'quotations',
        title: t('app.kuaizhizao.salesDashboard.kpi.pendingQuotations'),
        value: s?.pending_quotations ?? 0,
        subtitle: t('app.kuaizhizao.salesDashboard.kpi.pendingQuotationsSubtitle'),
        icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/sales-management/quotations'),
        sideMetrics: [{
          label: t('app.kuaizhizao.salesDashboard.kpi.newThisMonth'),
          value: s?.new_quotations_this_month ?? 0,
        }],
      },
      {
        key: 'shipments',
        title: t('app.kuaizhizao.salesDashboard.kpi.pendingShipments'),
        value: s?.pending_shipments ?? 0,
        subtitle:
          (s?.overdue_shipments ?? 0) > 0
            ? t('app.kuaizhizao.salesDashboard.kpi.overdueShipmentsSubtitle', { count: s?.overdue_shipments })
            : t('app.kuaizhizao.salesDashboard.kpi.allOnTime'),
        icon: <SendOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/sales-management/sales-orders?status=approved'),
        sideMetrics: [{
          label: t('app.kuaizhizao.salesDashboard.kpi.overdue'),
          value: s?.overdue_shipments ?? 0,
        }],
      },
      {
        key: 'revenue',
        title: t('app.kuaizhizao.salesDashboard.kpi.monthlyRevenue'),
        value: (
          <AmountDisplay
            resource={SO}
            fieldName="total_amount"
            value={s?.total_amount != null ? Number(s.total_amount) : null}
            prefix=""
            suffix=""
            style={{ fontSize: 26, fontWeight: 700, color: '#fff' }}
          />
        ),
        icon: <RiseOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
        progress: s?.achievement_rate ?? 0,
        sideMetrics: [
          {
            label: t('app.kuaizhizao.salesDashboard.kpi.lastMonth'),
            value: showMoney ? `${((s?.total_amount_last_month ?? 0) / 10000).toFixed(1)}w` : '***',
          },
          { label: t('app.kuaizhizao.salesDashboard.kpi.achievementRate'), value: `${s?.achievement_rate ?? 0}%` },
        ],
      },
    ],
    [navigate, overdueFollowUpCount, pendingFollowUpTotal, s, showMoney, t],
  );

  const moduleShortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'quote',
        title: t('app.kuaizhizao.salesDashboard.shortcut.newQuotation'),
        icon: <FileDoneOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaizhizao/sales-management/quotations',
      },
      {
        key: 'orders',
        title: t('app.kuaizhizao.salesDashboard.shortcut.salesOrders'),
        icon: <SolutionOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaizhizao/sales-management/sales-orders',
      },
      {
        key: 'follow-up',
        title: t('app.kuaizhizao.salesDashboard.shortcut.followUp'),
        icon: <CustomerServiceOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaizhizao/sales-management/customer-follow-ups',
      },
      {
        key: 'customer-pool',
        title: t('app.kuaizhizao.salesDashboard.shortcut.customerPool'),
        icon: <TeamOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaizhizao/sales-management/customer-pool',
      },
      {
        key: 'shipment',
        title: t('app.kuaizhizao.salesDashboard.shortcut.shipmentNotice'),
        icon: <BellOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
        path: '/apps/kuaizhizao/sales-management/shipment-notices',
      },
      {
        key: 'contract',
        title: t('app.kuaizhizao.salesDashboard.shortcut.salesContract'),
        icon: <FileProtectOutlined style={{ fontSize: 22, color: '#eb2f96' }} />,
        path: '/apps/kuaizhizao/sales-management/sales-contracts',
      },
    ],
    [t],
  );

  const quotationColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesDashboard.colQuotationCode'),
        dataIndex: 'quotation_code',
        render: (text: string) => (
          <a onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}>{text}</a>
        ),
      },
      {
        title: t('app.kuaizhizao.salesDashboard.colCustomer'),
        dataIndex: 'customer_name',
        ellipsis: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (status: string) => {
          const { text, color } = getStatusDisplay(status);
          return <Tag color={color}>{text}</Tag>;
        },
      },
    ],
    [navigate, t],
  );

  const deliveryColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.salesDashboard.colOrderCode'),
        dataIndex: 'order_code',
        width: 110,
        render: (text: string) => (
          <a onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}>{text}</a>
        ),
      },
      {
        title: t('app.kuaizhizao.salesDashboard.colCustomer'),
        dataIndex: 'customer_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesDashboard.colDeliveryDate'),
        dataIndex: 'delivery_date',
        width: 88,
        render: (date: string | null, record: { delivery_date?: string | null }) =>
          date ? (
            <span>
              {formatDateTime(date, 'MM-DD')}
              {isDeliveryOverdue(record.delivery_date) ? (
                <Tag color="error" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  {t('app.kuaizhizao.salesDashboard.deliveryOverdue')}
                </Tag>
              ) : null}
            </span>
          ) : (
            t('app.kuaizhizao.salesDashboard.deliveryTbd')
          ),
      },
      {
        title: t('app.kuaizhizao.salesDashboard.deliveryProgress'),
        dataIndex: 'delivery_progress',
        width: 72,
        render: (val: number | null) => `${Number(val ?? 0)}%`,
      },
    ],
    [navigate, t],
  );

  const renderRankBadge = useCallback(
    (rank: number) => {
      const style = resolveModuleRankBadgeStyle(rank, isPlain, token, isDark);
      return (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: style.background,
            color: style.color,
            fontWeight: 700,
            fontSize: 11,
            boxShadow: style.boxShadow,
          }}
        >
          {rank}
        </span>
      );
    },
    [isDark, isPlain, token],
  );

  const contractPanelLoading = contractAlertsLoading || frameworkLoading;
  const hasContractContent = contractAlerts.length > 0 || frameworkContracts.length > 0;

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} colProps={{ xs: 24, sm: 12, lg: 6 }} />}
      shortcutRow={
        <ModuleShortcutGrid
          items={moduleShortcuts}
          colProps={{ xs: 12, sm: 8, md: 4, lg: 4 }}
          fillByItemCount
        />
      }
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.todosTitle')}
            loading={todosLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/sales-management/shipment-notices')}>
                {t('app.kuaizhizao.salesDashboard.viewAll')}
              </a>
            }
          >
            <ModuleTodoList items={todos} emptyText={t('app.kuaizhizao.salesDashboard.noTodos')} />
          </ModuleActionPanel>

          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.followUpTodayTitle')}
            loading={pendingFollowUpsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups')}>
                {t('app.kuaizhizao.salesDashboard.viewAll')}
              </a>
            }
          >
            {pendingFollowUps.length === 0 ? (
              <ModuleTodoList items={[]} emptyText={t('app.kuaizhizao.salesDashboard.noFollowUpToday')} />
            ) : (
              <div className="dashboard-feed-list">
                {pendingFollowUps.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      marginBottom: 6,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <Text strong ellipsis style={{ fontSize: 12, flex: 1 }}>
                        {item.customer_name}
                      </Text>
                      <Tag
                        color={item.next_follow_up_at && dayjs(item.next_follow_up_at).isBefore(dayjs(), 'day') ? 'error' : 'warning'}
                        style={{ margin: 0, fontSize: 10 }}
                      >
                        {t('app.kuaizhizao.salesDashboard.pendingFollowUp')}
                      </Tag>
                    </div>
                    <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ fontSize: 11, margin: '4px 0' }}>
                      {item.content || t('app.kuaizhizao.salesDashboard.noFollowUpContent')}
                    </Paragraph>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {t('app.kuaizhizao.salesDashboard.plannedFollowUp', {
                          date: formatDateTime(item.next_follow_up_at, 'YYYY-MM-DD'),
                        })}
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups')}
                        style={{ fontSize: 11, height: 20, padding: 0 }}
                      >
                        {t('app.kuaizhizao.salesDashboard.goFollowUp')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModuleActionPanel>

          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.pendingQuotationsTitle')}
            loading={quotationsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}>
                {t('app.kuaizhizao.salesDashboard.viewAll')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={pendingQuotations.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={quotationColumns}
              locale={{ emptyText: t('app.kuaizhizao.salesDashboard.noPendingQuotations') }}
            />
          </ModuleActionPanel>

          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.deliveryTrackingTitle')}
            loading={ordersLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}>
                {t('app.kuaizhizao.salesDashboard.viewAll')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={pendingDeliveryOrders.slice(0, 8)}
              pagination={false}
              rowKey="id"
              columns={deliveryColumns}
              locale={{ emptyText: t('app.kuaizhizao.salesDashboard.noPendingDelivery') }}
            />
          </ModuleActionPanel>

          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.recentFollowUpTitle')}
            loading={followUpsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups')}>
                {t('app.kuaizhizao.salesDashboard.viewAll')}
              </a>
            }
          >
            {recentFollowUps.length === 0 ? (
              <ModuleTodoList items={[]} emptyText={t('app.kuaizhizao.salesDashboard.noRecentFollowUp')} />
            ) : (
              <div className="dashboard-feed-list">
                {recentFollowUps.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text strong ellipsis style={{ fontSize: 12, display: 'block' }}>
                        {item.customer_name}
                      </Text>
                      <Paragraph
                        ellipsis={{ rows: 1 }}
                        style={{ fontSize: 11, margin: '2px 0 0', color: token.colorTextSecondary }}
                      >
                        {item.content || t('app.kuaizhizao.salesDashboard.noFollowUpRecord')}
                      </Paragraph>
                    </div>
                    <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                      {formatDateTime(item.occurred_at || item.created_at, 'MM-DD HH:mm')}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </ModuleActionPanel>

          {(hasContractContent || contractPanelLoading) && (
            <ModuleActionPanel
              layout="masonry"
              title={t('app.kuaizhizao.salesDashboard.contractPanelTitle')}
              loading={contractPanelLoading}
              extra={
                <a onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-contracts')}>
                  {t('app.kuaizhizao.salesDashboard.viewAll')}
                </a>
              }
            >
              {!hasContractContent ? (
                <ModuleTodoList items={[]} emptyText={t('app.kuaizhizao.salesDashboard.noContractAlerts')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {contractAlerts.slice(0, 4).map((item) => (
                    <div
                      key={`${item.alert_type}-${item.contract_id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate('/apps/kuaizhizao/sales-management/sales-contracts', {
                          state: { openContractId: item.contract_id },
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          navigate('/apps/kuaizhizao/sales-management/sales-contracts', {
                            state: { openContractId: item.contract_id },
                          });
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <Text strong>{item.contract_code}</Text>
                        <Tag color={item.severity === 'high' ? 'error' : 'warning'}>
                          {item.alert_type === 'expiry'
                            ? t('app.kuaizhizao.salesDashboard.alertExpiry')
                            : item.alert_type === 'low_balance'
                              ? t('app.kuaizhizao.salesDashboard.alertLowBalance')
                              : t('app.kuaizhizao.salesDashboard.alertMilestone')}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                        {item.customer_name}
                      </Text>
                      <Text type={item.severity === 'high' ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                        {item.message}
                      </Text>
                    </div>
                  ))}
                  {frameworkContracts.slice(0, 4).map((item) => {
                    const pct =
                      Number(item.total_amount) > 0
                        ? Math.round((Number(item.released_amount) / Number(item.total_amount)) * 100)
                        : 0;
                    return (
                      <div
                        key={item.contract_id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          navigate('/apps/kuaizhizao/sales-management/sales-contracts', {
                            state: { openContractId: item.contract_id },
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            navigate('/apps/kuaizhizao/sales-management/sales-contracts', {
                              state: { openContractId: item.contract_id },
                            });
                          }
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text strong ellipsis>{item.contract_code}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('app.kuaizhizao.salesDashboard.remainingAmount', {
                              amount: Number(item.remaining_amount).toLocaleString(),
                            })}
                          </Text>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.customer_name}
                        </Text>
                        <Progress percent={pct} size="small" style={{ marginTop: 4 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </ModuleActionPanel>
          )}

          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.trendTitle')}
            loading={trendLoading}
            segmented={{
              value: trendType,
              options: [
                ...(showMoney
                  ? [{ label: t('app.kuaizhizao.salesDashboard.trendRevenue'), value: 'revenue' }]
                  : []),
                { label: t('app.kuaizhizao.salesDashboard.trendQuantity'), value: 'quantity' },
              ],
              onChange: (v) => setTrendType(v as 'revenue' | 'quantity'),
            }}
          >
            <ModuleTrendLine
                data={trendData}
                xField="month"
                yField={trendType}
                height={260}
                autoFit
                style={{ stroke: isPlain || trendType === 'revenue' ? '#1890ff' : '#52c41a', lineWidth: 2 }}
              />
          </ModuleChartPanel>

          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.salesDashboard.rankingTitle')}
            loading={topProductsLoading}
            segmented={{
              value: rankType,
              options: [
                { label: t('app.kuaizhizao.salesDashboard.rankProducts'), value: 'products' },
                { label: t('app.kuaizhizao.salesDashboard.rankCustomers'), value: 'customers' },
              ],
              onChange: (v) => setRankType(v as 'products' | 'customers'),
            }}
          >
            <div style={{ padding: '4px 0' }}>
              {rankType === 'products' ? (
                topProducts.length === 0 ? (
                  <ModuleTodoList items={[]} emptyText={t('app.kuaizhizao.salesDashboard.noProductRank')} />
                ) : (
                  topProducts.map((item, idx) => (
                    <div key={item.material_name} style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                      {renderRankBadge(idx + 1)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text strong ellipsis style={{ fontSize: 13 }}>{item.material_name}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('app.kuaizhizao.salesDashboard.piecesUnit', { count: item.quantity })}
                          </Text>
                        </div>
                        <Progress
                          percent={Math.min(100, Math.round((item.quantity / Math.max(...topProducts.map((p) => p.quantity || 1))) * 100))}
                          showInfo={false}
                          size={[100, 6]}
                        />
                      </div>
                    </div>
                  ))
                )
              ) : topCustomers.length === 0 ? (
                <ModuleTodoList items={[]} emptyText={t('app.kuaizhizao.salesDashboard.noCustomerRank')} />
              ) : (
                topCustomers.map((item, idx) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 12 }}>
                    {renderRankBadge(idx + 1)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong ellipsis style={{ fontSize: 13 }}>{item.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('app.kuaizhizao.salesDashboard.orderCountUnit', { count: item.orderCount })}
                          {' | '}
                          <AmountDisplay resource={SO} fieldName="amount" value={item.amount} />
                        </Text>
                      </div>
                      <Progress
                        percent={Math.min(100, Math.round((item.amount / Math.max(...topCustomers.map((c) => c.amount || 1))) * 100))}
                        showInfo={false}
                        size={[100, 6]}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default SalesDashboard;
