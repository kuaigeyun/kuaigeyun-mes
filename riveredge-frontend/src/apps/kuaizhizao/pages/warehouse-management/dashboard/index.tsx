import React, { Suspense, lazy, useMemo, useCallback } from 'react';
import { App, Table } from 'antd';
import {
  InboxOutlined,
  AlertOutlined,
  SwapOutlined,
  ImportOutlined,
  ExportOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  FormOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { getWarehouseDashboardSummary, type WarehouseDashboardSummary } from '../../../services/warehouse-dashboard';
import { mesDashboardService } from '../../../services/dashboard';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_WAREHOUSE_INVENTORY_FIELD_RESOURCE as INV } from '../../../constants/fieldPermissionResources';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
  ModuleTodoList,
  ModuleChartPanel,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const WarehouseTrendLine = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Line>) => <Line {...props} /> };
});

const WarehouseDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { data, loading } = useDashboardRequest(
    () => getWarehouseDashboardSummary({ recent_limit: 8 }),
    'kz:warehouse-dashboard:summary',
    {
      onError: (e: { message?: string }) =>
        message.error(e?.message || t('app.kuaizhizao.warehouseDashboard.loadFailed')),
    },
  );
  const { data: todosData, loading: todosLoading } = useDashboardRequest(
    () => mesDashboardService.getTodosByModule('warehouse', 8),
    'kz:warehouse-dashboard:todos',
  );
  const { data: trendData, loading: trendLoading } = useDashboardRequest(
    mesDashboardService.getWarehouseTrend,
    'kz:warehouse-dashboard:trend',
  );

  const s = data as WarehouseDashboardSummary | undefined;
  const todos = todosData?.items || [];

  const normalSkuPercent = useMemo(() => {
    if (!s || s.total_sku <= 0) return 100;
    return Math.min(100, Math.round((s.normal_stock / s.total_sku) * 100));
  }, [s]);

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'value',
        title: t('app.kuaizhizao.warehouseDashboard.kpi.totalInventoryValue'),
        value: (
          <AmountDisplay
            resource={INV}
            fieldName="total_amount"
            value={s?.total_inventory_value != null ? Number(s.total_inventory_value) : null}
            prefix=""
            style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}
          />
        ),
        subtitle: t('app.kuaizhizao.warehouseDashboard.kpi.totalInventoryValueSubtitle'),
        icon: <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inventory'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.warehouseDashboard.kpi.totalQuantity'),
            value: s?.total_quantity ?? 0,
          },
        ],
      },
      {
        key: 'health',
        title: t('app.kuaizhizao.warehouseDashboard.kpi.inventoryHealth'),
        value: `${normalSkuPercent}%`,
        subtitle: t('app.kuaizhizao.warehouseDashboard.kpi.inventoryHealthSubtitle', {
          lowStock: s?.low_stock ?? 0,
          outOfStock: s?.out_of_stock ?? 0,
        }),
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inventory-alert'),
        progress: normalSkuPercent,
        sideMetrics: [
          {
            label: t('app.kuaizhizao.warehouseDashboard.kpi.skuCount'),
            value: s?.total_sku ?? 0,
          },
        ],
      },
      {
        key: 'pending',
        title: t('app.kuaizhizao.warehouseDashboard.kpi.pendingInOut'),
        value: (s?.pending_inbound || 0) + (s?.pending_outbound || 0),
        subtitle: s?.overdue_inbound
          ? t('app.kuaizhizao.warehouseDashboard.kpi.pendingSubtitleOverdue', {
              pendingInbound: s?.pending_inbound ?? 0,
              overdueInbound: s.overdue_inbound,
            })
          : t('app.kuaizhizao.warehouseDashboard.kpi.pendingSubtitle', {
              pendingInbound: s?.pending_inbound ?? 0,
              pendingOutbound: s?.pending_outbound ?? 0,
            }),
        icon: <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inbound'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.warehouseDashboard.kpi.pendingOutbound'),
            value: s?.pending_outbound ?? 0,
          },
        ],
      },
    ],
    [navigate, normalSkuPercent, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'in',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.purchaseInbound'),
        icon: <ImportOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
        path: '/apps/kuaizhizao/warehouse-management/inbound',
      },
      {
        key: 'out',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.salesOutbound'),
        icon: <ExportOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
        path: '/apps/kuaizhizao/warehouse-management/outbound',
      },
      {
        key: 'pick',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.productionPicking'),
        icon: <AppstoreOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
        path: '/apps/kuaizhizao/warehouse-management/picking',
      },
      {
        key: 'other',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.otherInOut'),
        icon: <HistoryOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
        path: '/apps/kuaizhizao/warehouse-management/other-inventory',
      },
      {
        key: 'stock',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.stocktaking'),
        icon: <FormOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />,
        path: '/apps/kuaizhizao/warehouse-management/stocktake',
      },
      {
        key: 'transfer',
        title: t('app.kuaizhizao.warehouseDashboard.shortcut.transfer'),
        icon: <RetweetOutlined style={{ fontSize: 20, color: '#36cfc9' }} />,
        path: '/apps/kuaizhizao/warehouse-management/transfer',
      },
    ],
    [t],
  );

  const trendInboundLabel = t('app.kuaizhizao.warehouseDashboard.trendInbound');
  const trendOutboundLabel = t('app.kuaizhizao.warehouseDashboard.trendOutbound');

  const trendChartData = useMemo(() => {
    const items = trendData?.items || [];
    return items.flatMap((it) => [
      { date: it.date, value: it.in, type: trendInboundLabel },
      { date: it.date, value: it.out, type: trendOutboundLabel },
    ]);
  }, [trendData, trendInboundLabel, trendOutboundLabel]);

  const formatTime = useCallback((iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = dayjs(iso);
    return d.isValid() ? d.format('MM-DD HH:mm') : '—';
  }, []);

  const queueColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseDashboard.colDocCode'),
        dataIndex: 'doc_code',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.warehouseDashboard.colMaterial'),
        dataIndex: 'material_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.warehouseDashboard.colTime'),
        dataIndex: 'time',
        width: 112,
        render: (value: string) => (
          <span style={{ whiteSpace: 'nowrap' }}>{formatTime(value)}</span>
        ),
      },
    ],
    [formatTime, t],
  );

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4 }} />}
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.warehouseDashboard.pendingInboundTitle')}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inbound')}>
                {t('app.kuaizhizao.warehouseDashboard.more')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={s?.pending_inbounds ?? []}
              pagination={false}
              rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
              columns={queueColumns}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.warehouseDashboard.pendingOutboundTitle')}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/outbound')}>
                {t('app.kuaizhizao.warehouseDashboard.more')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={s?.recent_outbounds ?? []}
              pagination={false}
              rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
              columns={queueColumns}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.warehouseDashboard.todosTitle')}
            loading={todosLoading}
          >
            <ModuleTodoList
              items={todos}
              emptyText={t('app.kuaizhizao.warehouseDashboard.noTodos')}
            />
          </ModuleActionPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.warehouseDashboard.dailyTrendTitle')}
            loading={trendLoading}
            height={260}
          >
            <Suspense fallback={null}>
              <WarehouseTrendLine
                data={trendChartData}
                xField="date"
                yField="value"
                colorField="type"
                height={260}
                autoFit
                shapeField="smooth"
                style={{ lineWidth: 2 }}
                axis={{ x: { title: false }, y: { title: false } }}
                legend={{ color: { itemLabelFontSize: 13 } }}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default WarehouseDashboard;
