import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Row, Col, Progress, Typography, Tag, Spin,
  Segmented, Button, Empty, Tooltip, Badge, theme
} from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { 
  FileTextOutlined, 
  SendOutlined, 
  RiseOutlined, 
  UserOutlined,
  CustomerServiceOutlined,
  SolutionOutlined,
  FileDoneOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  TrophyOutlined,
  PhoneOutlined,
  MessageOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  AuditOutlined,
  RightOutlined,
  LockOutlined,
  WechatOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Line } from '@ant-design/charts';
import { mesDashboardService } from '../../../services/dashboard';
import { listSalesOrders } from '../../../services/sales-order';
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
  ModuleKpiRow,
  ModuleShortcutGrid,
  isModuleDashboardPlain,
  resolveModuleRankBadgeStyle,
  resolveModuleFollowUpIconColors,
} from '../../../components/module-center';
import { UniDashboard } from '../../../../../components/uni-dashboard';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text, Title, Paragraph } = Typography;

/** 与后端 SALES_ORDER_PENDING_SHIP_STATUS 对齐 */
const PENDING_DELIVERY_STATUS = new Set([
  'approved', 'confirmed',
  '已审核', '已确认', '已下达', '执行中', '进行中',
  'APPROVED', 'AUDITED', 'CONFIRMED', 'RELEASED', 'IN_PROGRESS',
]);

function isPendingDeliveryOrder(order: { status?: string; delivery_progress?: number | null }): boolean {
  const status = String(order?.status ?? '').trim();
  if (!status || !PENDING_DELIVERY_STATUS.has(status)) return false;
  return Number(order?.delivery_progress ?? 0) < 100;
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

  // 看板控制状态
  const [trendType, setTrendType] = useState<'revenue' | 'quantity'>(showMoney ? 'revenue' : 'quantity');
  const [rankType, setRankType] = useState<'products' | 'customers'>('products');
  const trendChartColor = isPlain || trendType === 'revenue' ? token.colorPrimary : '#52c41a';
  const trendChartAxis = useMemo(
    () => ({
      x: {
        title: false,
        labelFill: token.colorTextSecondary,
        labelFontSize: 11,
        lineStroke: token.colorBorderSecondary,
        tickStroke: token.colorBorderSecondary,
      },
      y: {
        title: false,
        grid: true,
        labelFill: token.colorTextSecondary,
        labelFontSize: 11,
        gridStroke: token.colorBorderSecondary,
        gridLineDash: [4, 4] as [number, number],
        line: false,
        tick: false,
      },
    }),
    [token.colorTextSecondary, token.colorBorderSecondary],
  );
  
  // 1. 获取汇总数据
  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    mesDashboardService.getSalesSummary,
    'kz:sales-dashboard:summary',
  );
  
  // 2. 获取待交付订单（多取一些，前端筛选后滚动展示）
  const { data: recentOrdersData, loading: ordersLoading } = useDashboardRequest(async () => {
    return listSalesOrders({ limit: 30, order_by: 'delivery_date' });
  }, 'kz:sales-dashboard:recent-orders');
  
  // 3. 获取最近跟进记录
  const { data: followUpsData, loading: followUpsLoading } = useDashboardRequest(async () => {
    return customerFollowUpApi.list({ limit: 8 });
  }, 'kz:sales-dashboard:follow-ups');

  // 4. 获取热销产品排行
  const { data: topProductsData, loading: topProductsLoading } = useDashboardRequest(async () => {
    try {
      return await getSalesTop10();
    } catch {
      return [];
    }
  }, 'kz:sales-dashboard:top-products');

  // 5. 获取月度趋势
  const { data: salesTrendRaw, loading: trendLoading } = useDashboardRequest(async () => {
    try {
      const res = await getSalesReport({ report_type: 'trend' });
      return res.data || [];
    } catch {
      return [];
    }
  }, 'kz:sales-dashboard:trend');

  // 6. 获取待跟进提醒
  const { data: pendingTasksData, loading: pendingTasksLoading } = useDashboardRequest(async () => {
    try {
      const res = await customerFollowUpApi.list({ pending_only: true, limit: 5 });
      return res?.items || [];
    } catch {
      return [];
    }
  }, 'kz:sales-dashboard:pending-tasks');

  const { data: contractAlerts = [], loading: contractAlertsLoading } = useDashboardRequest(async () => {
    try {
      return await salesContractApi.listAlerts();
    } catch {
      return [];
    }
  }, 'kz:sales-dashboard:contract-alerts');

  const { data: frameworkContracts = [], loading: frameworkLoading } = useDashboardRequest(async () => {
    try {
      return await salesContractApi.executionSummary();
    } catch {
      return [];
    }
  }, 'kz:sales-dashboard:framework-contracts');

  const recentOrders = recentOrdersData?.data || [];
  const pendingDeliveryOrders = useMemo(
    () =>
      recentOrders
        .filter(isPendingDeliveryOrder)
        .sort((a: any, b: any) => {
          const da = a.delivery_date ? dayjs(a.delivery_date) : dayjs('2099-12-31');
          const db = b.delivery_date ? dayjs(b.delivery_date) : dayjs('2099-12-31');
          return da.valueOf() - db.valueOf();
        }),
    [recentOrders],
  );
  const deliveryScrollRef = useRef<HTMLDivElement>(null);
  const deliveryScrollPausedRef = useRef(false);

  const renderDeliveryOrderRow = useCallback(
    (record: any) => {
      const { text: statusText, color: statusColor } = getStatusDisplay(
        record.status ? String(record.status) : undefined,
      );
      return (
        <div
          key={record.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 4px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ width: 96, minWidth: 96, flexShrink: 0 }}>
            <a
              onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}
              style={{ fontWeight: 500, fontSize: 12, lineHeight: 1.3 }}
            >
              {record.order_code}
            </a>
            <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block', maxWidth: 96 }}>
              {record.customer_name}
            </Text>
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
            <Progress
              percent={record.delivery_progress || 0}
              size="small"
              strokeColor={isPlain ? token.colorPrimary : { '0%': '#108ee9', '100%': '#87d068' }}
              style={{ margin: 0 }}
            />
            <span style={{ fontSize: 10, color: token.colorTextTertiary }}>
              {t('app.kuaizhizao.salesDashboard.deliveryDue', {
                date: record.delivery_date
                  ? formatDateTime(record.delivery_date, 'MM-DD')
                  : t('app.kuaizhizao.salesDashboard.deliveryTbd'),
              })}
            </span>
          </div>
          <Tag color={statusColor} style={{ margin: 0, fontSize: 10, padding: '0 4px', flexShrink: 0 }}>
            {statusText}
          </Tag>
        </div>
      );
    },
    [isPlain, navigate, t, token.colorBorderSecondary, token.colorPrimary, token.colorTextTertiary],
  );

  useEffect(() => {
    const el = deliveryScrollRef.current;
    if (!el || pendingDeliveryOrders.length <= 4) return;

    let frameId = 0;
    const tick = () => {
      if (!deliveryScrollPausedRef.current && el) {
        el.scrollTop += 0.4;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 0 && el.scrollTop >= maxScroll - 1) {
          el.scrollTop = 0;
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    const pause = () => {
      deliveryScrollPausedRef.current = true;
    };
    const resume = () => {
      deliveryScrollPausedRef.current = false;
    };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);

    return () => {
      window.cancelAnimationFrame(frameId);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, [pendingDeliveryOrders.length]);

  const recentFollowUps = followUpsData?.items || [];
  const s = summary as any;

  // 格式化趋势数据 (根据真实数据生成最近 6 个月的走势，不存在的月份显示为 0)
  const trendData = (() => {
    const raw = salesTrendRaw || [];
    // 生成最近 6 个月份的列表
    const months = Array.from({ length: 6 }).map((_, i) => dayjs().subtract(5 - i, 'month').format('YYYY-MM'));
    const rawMap = new Map(raw.map((r: any) => [r.month, r]));
    
    return months.map(m => {
      const exist = rawMap.get(m);
      if (exist) {
        return {
          month: m,
          revenue: Number(exist.revenue ?? exist.total_amount) || 0,
          quantity: Number(exist.quantity ?? exist.order_count) || 0
        };
      }
      return {
        month: m,
        revenue: 0,
        quantity: 0
      };
    });
  })();

  // 格式化热销产品排行 (完全呈现真实排行)
  const topProducts = (() => {
    const raw = topProductsData || [];
    return raw.map((r: any) => ({
      material_name: r.material_name || r.name || t('app.kuaizhizao.salesDashboard.unknownProduct'),
      quantity: Number(r.quantity) || 0,
      amount: Number(r.amount) || 0
    })).filter(x => x.quantity > 0).slice(0, 5);
  })();

  // 格式化核心客户排行 (根据真实订单汇总排行，不填充 mock 数据)
  const topCustomers = (() => {
    const map: Record<string, { name: string; amount: number; orderCount: number }> = {};
    recentOrders.forEach((o: any) => {
      if (!o.customer_name) return;
      if (!map[o.customer_name]) {
        map[o.customer_name] = { name: o.customer_name, amount: 0, orderCount: 0 };
      }
      map[o.customer_name].amount += Number(o.total_amount) || 0;
      map[o.customer_name].orderCount += 1;
    });
    const list = Object.values(map).sort((a, b) => b.amount - a.amount);
    return list.slice(0, 5);
  })();

  // 今日待办 (仅呈现真实待跟进提醒)
  const pendingTasks = (() => {
    return (pendingTasksData || []) as any[];
  })();

  // 最近跟进历史 (仅呈现真实跟进记录)
  const recentFollowUpItems = (() => {
    return (recentFollowUps || []) as any[];
  })();

  // 渲染排行徽章
  const renderRankBadge = (rank: number) => {
    const style = resolveModuleRankBadgeStyle(rank, isPlain, token, isDark);
    return (
      <span style={{
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
      }}>
        {rank}
      </span>
    );
  };

  // 跟进类型图标
  const getFollowUpIcon = (code?: string) => {
    const c = String(code || '').toUpperCase();
    const { bg, fg } = resolveModuleFollowUpIconColors(code, isPlain, token);
    let icon = <MessageOutlined style={{ display: 'block', fontSize: 12 }} />;

    if (c.includes('PHONE') || c.includes('电话')) {
      icon = <PhoneOutlined style={{ display: 'block', fontSize: 12 }} />;
    } else if (c.includes('MEETING') || c.includes('拜访') || c.includes('现场')) {
      icon = <UserOutlined style={{ display: 'block', fontSize: 12 }} />;
    } else if (c.includes('EMAIL') || c.includes('邮件')) {
      icon = <MailOutlined style={{ display: 'block', fontSize: 12 }} />;
    } else if (c.includes('WECHAT') || c.includes('微信') || c.includes('IM') || c.includes('沟通')) {
      icon = <WechatOutlined style={{ display: 'block', fontSize: 12 }} />;
    }

    return (
      <div
        style={{
          backgroundColor: bg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          minWidth: 24,
          maxWidth: 24,
          borderRadius: '50%',
          color: fg,
          flexShrink: 0,
          ...(isPlain ? { border: `1px solid ${token.colorPrimaryBorder}` } : {}),
        }}
      >
        {icon}
      </div>
    );
  };

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'quotations',
        title: t('app.kuaizhizao.salesDashboard.kpi.pendingQuotations'),
        value: s?.pending_quotations ?? 0,
        subtitle: t('app.kuaizhizao.salesDashboard.kpi.pendingQuotationsSubtitle'),
        icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/sales-management/quotations'),
        sideMetrics: [{ label: t('app.kuaizhizao.salesDashboard.kpi.newThisMonth'), value: s?.new_quotations_this_month ?? 0 }],
      },
      {
        key: 'shipments',
        title: t('app.kuaizhizao.salesDashboard.kpi.pendingShipments'),
        value: s?.pending_shipments ?? 0,
        subtitle:
          s?.overdue_shipments > 0
            ? t('app.kuaizhizao.salesDashboard.kpi.overdueShipmentsSubtitle', { count: s.overdue_shipments })
            : t('app.kuaizhizao.salesDashboard.kpi.allOnTime'),
        icon: <SendOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/sales-management/sales-orders?status=approved'),
        sideMetrics: [{ label: t('app.kuaizhizao.salesDashboard.kpi.overdue'), value: s?.overdue_shipments ?? 0 }],
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
            style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}
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
    [navigate, s, showMoney, t],
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
        key: 'customers',
        title: t('app.kuaizhizao.salesDashboard.shortcut.customers'),
        icon: <UserOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/master-data/supply-chain/customers',
      },
    ],
    [t],
  );


  return (
    <UniDashboard className="sales-module-dashboard" style={{ padding: 0, overflow: 'visible' }}>
      <Spin spinning={summaryLoading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <ModuleKpiRow items={kpis} />
          </Col>

          {/* 快捷功能 */}
          <Col span={24}>
            <ModuleShortcutGrid items={moduleShortcuts} />
          </Col>

          {/* 工作台 Row 1: 任务、交期、 CRM 动态 */}
          <Col xs={24} lg={8}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AuditOutlined style={{ color: '#fa8c16' }} />
                  <span>{t('app.kuaizhizao.salesDashboard.tasksTitle')}</span>
                </div>
              }
              headerBordered
              style={{ height: '100%', borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              styles={{ body: {padding: '10px 12px' } }}
            >
              {s?.pending_quotations > 0 && (
                <div
                  onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}
                  style={{
                    background: isPlain ? token.colorPrimaryBg : token.colorWarningBg,
                    border: `1px solid ${isPlain ? token.colorPrimaryBorder : token.colorWarningBorder}`,
                    borderRadius: token.borderRadius,
                    padding: '8px 10px',
                    marginBottom: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.3s',
                  }}
                >
                  <ExclamationCircleOutlined style={{ color: isPlain ? token.colorPrimary : token.colorWarning, fontSize: 16 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ color: isPlain ? token.colorText : token.colorWarningText, fontSize: 12, lineHeight: 1.35 }}>
                      {t('app.kuaizhizao.salesDashboard.pendingQuotationsAlert')}
                    </Text>
                    <div style={{ fontSize: 11, color: isPlain ? token.colorTextSecondary : token.colorWarningText, marginTop: 1, lineHeight: 1.35, opacity: 0.85 }}>
                      {t('app.kuaizhizao.salesDashboard.pendingQuotationsDetail', { count: s.pending_quotations })}
                    </div>
                  </div>
                  <RightOutlined style={{ color: isPlain ? token.colorPrimary : token.colorWarning, fontSize: 11, flexShrink: 0 }} />
                </div>
              )}

              <div style={{ minHeight: 160 }}>
                {pendingTasksLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 140 }}>
                    <Spin size="small" />
                  </div>
                ) : pendingTasks.length === 0 ? (
                  <Empty description={t('app.kuaizhizao.salesDashboard.noFollowUpToday')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  pendingTasks.slice(0, 3).map((item: any) => (
                    <div key={item.id} style={{
                      padding: '7px 10px',
                      borderRadius: token.borderRadiusSM,
                      background: token.colorFillQuaternary,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                          <Badge status="processing" style={{ flexShrink: 0 }} />
                          <Text strong ellipsis style={{ fontSize: 12, lineHeight: 1.3 }}>{item.customer_name}</Text>
                        </div>
                        <Tag color="warning" style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 5px', flexShrink: 0 }}>
                          {t('app.kuaizhizao.salesDashboard.pendingFollowUp')}
                        </Tag>
                      </div>
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 1 }}
                        style={{ fontSize: 11, lineHeight: 1.35, marginBottom: 4 }}
                      >
                        {item.content || t('app.kuaizhizao.salesDashboard.noFollowUpContent')}
                      </Paragraph>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.2 }}>
                          {t('app.kuaizhizao.salesDashboard.plannedFollowUp', {
                            date: formatDateTime(item.next_follow_up_at, 'YYYY-MM-DD'),
                          })}
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups')}
                          style={{ fontSize: 11, height: 20, padding: 0, flexShrink: 0 }}
                        >
                          {t('app.kuaizhizao.salesDashboard.goFollowUp')}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ProCard>
          </Col>

          <Col xs={24} lg={8}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <SolutionOutlined style={{ color: '#52c41a' }} />
                  <span>{t('app.kuaizhizao.salesDashboard.deliveryTrackingTitle')}</span>
                </div>
              }
              headerBordered
              style={{ height: '100%', borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              styles={{ body: {padding: 8 } }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-orders')}>{t('app.kuaizhizao.salesDashboard.viewAll')}</a>}
            >
              <div style={{ height: 250, overflow: 'hidden' }}>
                {ordersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <Spin size="small" />
                  </div>
                ) : pendingDeliveryOrders.length === 0 ? (
                  <Empty description={t('app.kuaizhizao.salesDashboard.noPendingDelivery')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div
                    ref={deliveryScrollRef}
                    style={{
                      height: '100%',
                      overflowY: pendingDeliveryOrders.length > 4 ? 'hidden' : 'auto',
                      paddingRight: 2,
                    }}
                  >
                    {pendingDeliveryOrders.map(renderDeliveryOrderRow)}
                    {pendingDeliveryOrders.length > 4 &&
                      pendingDeliveryOrders.map((record: any) =>
                        renderDeliveryOrderRow({ ...record, id: `dup-${record.id}` }),
                      )}
                  </div>
                )}
              </div>
            </ProCard>
          </Col>

          <Col xs={24} lg={8}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CustomerServiceOutlined style={{ color: '#722ed1' }} />
                  <span>{t('app.kuaizhizao.salesDashboard.recentFollowUpTitle')}</span>
                </div>
              }
              headerBordered
              style={{ height: '100%', borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              styles={{ body: {padding: '10px 12px 8px' } }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/sales-management/customer-follow-ups')}>{t('app.kuaizhizao.salesDashboard.viewAll')}</a>}
            >
              <div style={{ minHeight: 250, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
                {followUpsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <Spin size="small" />
                  </div>
                ) : recentFollowUpItems.length === 0 ? (
                  <Empty description={t('app.kuaizhizao.salesDashboard.noRecentFollowUp')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  recentFollowUpItems.slice(0, 5).map((item: any) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '7px 0',
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      {getFollowUpIcon(item.activity_type_code)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <Text strong ellipsis style={{ fontSize: 12, lineHeight: 1.3 }}>
                            {item.customer_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                            {formatDateTime(item.occurred_at || item.created_at, 'MM-DD HH:mm')}
                          </Text>
                        </div>
                        <Paragraph
                          ellipsis={{ rows: 1 }}
                          style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2, marginBottom: 0, lineHeight: 1.35 }}
                        >
                          {item.content || t('app.kuaizhizao.salesDashboard.noFollowUpRecord')}
                        </Paragraph>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ProCard>
          </Col>

          {/* 工作台 Row 2: 业绩走势与排行 */}
          <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column' }}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiseOutlined style={{ color: token.colorPrimary }} />
                  <span>{t('app.kuaizhizao.salesDashboard.trendTitle')}</span>
                </div>
              }
              headerBordered
              style={{ flex: 1, height: '100%', borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              styles={{ body: {display: 'flex', flexDirection: 'column', flex: 1 } }}
              extra={
                <Segmented
                  options={[
                    { label: t('app.kuaizhizao.salesDashboard.trendRevenue'), value: 'revenue', disabled: !showMoney },
                    { label: t('app.kuaizhizao.salesDashboard.trendQuantity'), value: 'quantity' },
                  ]}
                  value={trendType}
                  onChange={(val) => setTrendType(val as any)}
                  size="small"
                />
              }
            >
              <div style={{ padding: '8px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {trendLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                    <Spin />
                  </div>
                ) : (
                  <Line
                    data={trendData}
                    xField="month"
                    yField={trendType}
                    height={280}
                    autoFit
                    shapeField="smooth"
                    style={{
                      stroke: trendChartColor,
                      lineWidth: 2,
                    }}
                    point={{
                      size: 4,
                      shape: 'circle',
                      style: {
                        fill: token.colorBgContainer,
                        stroke: trendChartColor,
                        lineWidth: 2,
                      },
                    }}
                    scale={{
                      y: {
                        formatter: (val: any) => {
                          if (trendType === 'revenue') {
                            return showMoney
                              ? t('app.kuaizhizao.salesDashboard.trendRevenueUnit', {
                                  value: (Number(val) / 10000).toFixed(0),
                                })
                              : '***';
                          }
                          return t('app.kuaizhizao.salesDashboard.trendOrderUnit', { value: val });
                        },
                      },
                    }}
                    axis={trendChartAxis}
                  />
                )}
              </div>
            </ProCard>
          </Col>

          <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrophyOutlined style={{ color: '#fa8c16' }} />
                  <span>{t('app.kuaizhizao.salesDashboard.rankingTitle')}</span>
                </div>
              }
              headerBordered
              style={{ flex: 1, height: '100%', borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              styles={{ body: {display: 'flex', flexDirection: 'column', flex: 1 } }}
              extra={
                <Segmented
                  options={[
                    { label: t('app.kuaizhizao.salesDashboard.rankProducts'), value: 'products' },
                    { label: t('app.kuaizhizao.salesDashboard.rankCustomers'), value: 'customers' },
                  ]}
                  value={rankType}
                  onChange={(val) => setRankType(val as any)}
                  size="small"
                />
              }
            >
              <div style={{ 
                padding: '8px 4px', 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: (rankType === 'products' ? topProducts.length : topCustomers.length) === 0 ? 'center' : 'flex-start'
              }}>
                {rankType === 'products' ? (
                  topProductsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
                      <Spin />
                    </div>
                  ) : topProducts.length === 0 ? (
                    <Empty description={t('app.kuaizhizao.salesDashboard.noProductRank')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    topProducts.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                        {renderRankBadge(idx + 1)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text strong ellipsis style={{ fontSize: 13 }}>{item.material_name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {t('app.kuaizhizao.salesDashboard.piecesUnit', { count: item.quantity.toLocaleString() })}
                            </Text>
                          </div>
                          <Progress
                            percent={Math.min(100, Math.round((item.quantity / Math.max(...topProducts.map(p => p.quantity || 1))) * 100))}
                            strokeColor={isPlain ? token.colorPrimary : { '0%': token.colorPrimary, '100%': '#52c41a' }}
                            showInfo={false}
                            size={[100, 6]}
                          />
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  topCustomers.length === 0 ? (
                    <Empty description={t('app.kuaizhizao.salesDashboard.noCustomerRank')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    topCustomers.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                        {renderRankBadge(idx + 1)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text strong ellipsis style={{ fontSize: 13 }}>{item.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {t('app.kuaizhizao.salesDashboard.orderCountUnit', { count: item.orderCount })} | <AmountDisplay resource={SO} fieldName="amount" value={item.amount} />
                            </Text>
                          </div>
                          <Progress
                            percent={Math.min(100, Math.round((item.amount / Math.max(...topCustomers.map(c => c.amount || 1))) * 100))}
                            strokeColor={isPlain ? token.colorPrimary : { '0%': '#722ed1', '100%': '#ff4d4f' }}
                            showInfo={false}
                            size={[100, 6]}
                          />
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </ProCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ExclamationCircleOutlined />
                  <span>{t('app.kuaizhizao.salesDashboard.contractAlertsTitle')}</span>
                </div>
              }
              headerBordered
              extra={
                <Button type="link" size="small" onClick={() => navigate('/apps/kuaizhizao/sales-management/sales-contracts')}>
                  {t('app.kuaizhizao.salesDashboard.viewAll')}
                </Button>
              }
              style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              {contractAlertsLoading ? (
                <Spin />
              ) : contractAlerts.length === 0 ? (
                <Empty description={t('app.kuaizhizao.salesDashboard.noContractAlerts')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                contractAlerts.slice(0, 6).map((item) => (
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
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text strong>{item.contract_code}</Text>
                      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{item.customer_name}</div>
                      <Text type={item.severity === 'high' ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                        {item.message}
                      </Text>
                    </div>
                    <Tag color={item.severity === 'high' ? 'error' : 'warning'}>
                      {item.alert_type === 'expiry'
                        ? t('app.kuaizhizao.salesDashboard.alertExpiry')
                        : item.alert_type === 'low_balance'
                          ? t('app.kuaizhizao.salesDashboard.alertLowBalance')
                          : t('app.kuaizhizao.salesDashboard.alertMilestone')}
                    </Tag>
                  </div>
                ))
              )}
            </ProCard>
          </Col>
          <Col xs={24} lg={12}>
            <ProCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AuditOutlined />
                  <span>{t('app.kuaizhizao.salesDashboard.frameworkContractsTitle')}</span>
                </div>
              }
              headerBordered
              style={{ borderRadius: token.borderRadiusLG, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
            >
              {frameworkLoading ? (
                <Spin />
              ) : frameworkContracts.length === 0 ? (
                <Empty description={t('app.kuaizhizao.salesDashboard.noFrameworkContracts')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                frameworkContracts.slice(0, 6).map((item) => {
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
                      style={{ marginBottom: 12, cursor: 'pointer' }}
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
                        {item.valid_to
                          ? t('app.kuaizhizao.salesDashboard.validUntil', { date: item.valid_to })
                          : ''}
                      </Text>
                      <Progress percent={pct} size="small" style={{ marginTop: 4 }} />
                    </div>
                  );
                })
              )}
            </ProCard>
          </Col>
        </Row>
      </Spin>
    </UniDashboard>
  );
};

export default SalesDashboard;
