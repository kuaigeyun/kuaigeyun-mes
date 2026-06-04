import React, { Suspense, lazy, useMemo } from 'react';
import { App, Table, Typography } from 'antd';
import { useRequest } from 'ahooks';
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
import dayjs from 'dayjs';
import { getWarehouseDashboardSummary, type WarehouseDashboardSummary } from '../../../services/warehouse-dashboard';
import { mesDashboardService } from '../../../services/dashboard';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_WAREHOUSE_INVENTORY_FIELD_RESOURCE as INV } from '../../../constants/fieldPermissionResources';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

const WarehouseTrendLine = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Line>) => <Line {...props} /> };
});

const WarehouseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { data, loading } = useRequest(() => getWarehouseDashboardSummary({ recent_limit: 8 }), {
    onError: (e: { message?: string }) => message.error(e?.message || '加载仓储看板失败'),
  });
  const { data: todosData, loading: todosLoading } = useRequest(() =>
    mesDashboardService.getTodosByModule('warehouse', 8),
  );
  const { data: trendData, loading: trendLoading } = useRequest(mesDashboardService.getWarehouseTrend);

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
        title: '总库存金额 (元)',
        value: (
          <AmountDisplay
            resource={INV}
            fieldName="total_amount"
            value={s?.total_inventory_value != null ? Number(s.total_inventory_value) : null}
            prefix=""
            style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}
          />
        ),
        subtitle: '按物料标准成本/均价估算',
        icon: <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inventory'),
        sideMetrics: [{ label: '总数量', value: s?.total_quantity ?? 0 }],
      },
      {
        key: 'health',
        title: '库存健康度',
        value: `${normalSkuPercent}%`,
        subtitle: `低库存 ${s?.low_stock ?? 0} · 缺料 ${s?.out_of_stock ?? 0}`,
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inventory-alert'),
        progress: normalSkuPercent,
        sideMetrics: [{ label: 'SKU 数', value: s?.total_sku ?? 0 }],
      },
      {
        key: 'pending',
        title: '待办出入库',
        value: (s?.pending_inbound || 0) + (s?.pending_outbound || 0),
        subtitle: s?.overdue_inbound
          ? `待入库 ${s?.pending_inbound ?? 0} · 逾期 ${s.overdue_inbound} 单`
          : `待入库 ${s?.pending_inbound ?? 0} · 待出库 ${s?.pending_outbound ?? 0}`,
        icon: <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaizhizao/warehouse-management/inbound'),
        sideMetrics: [{ label: '待出库', value: s?.pending_outbound ?? 0 }],
      },
    ],
    [navigate, normalSkuPercent, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'in', title: '采购入库', icon: <ImportOutlined style={{ fontSize: 20, color: '#1890ff' }} />, path: '/apps/kuaizhizao/warehouse-management/inbound' },
    { key: 'out', title: '销售出库', icon: <ExportOutlined style={{ fontSize: 20, color: '#52c41a' }} />, path: '/apps/kuaizhizao/warehouse-management/outbound' },
    { key: 'pick', title: '生产领料', icon: <AppstoreOutlined style={{ fontSize: 20, color: '#722ed1' }} />, path: '/apps/kuaizhizao/warehouse-management/picking' },
    { key: 'other', title: '其他出入', icon: <HistoryOutlined style={{ fontSize: 20, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/warehouse-management/other-inventory' },
    { key: 'stock', title: '库存盘点', icon: <FormOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/warehouse-management/stocktake' },
    { key: 'transfer', title: '库存调拨', icon: <RetweetOutlined style={{ fontSize: 20, color: '#36cfc9' }} />, path: '/apps/kuaizhizao/warehouse-management/transfer' },
  ];

  const trendChartData = useMemo(() => {
    const items = trendData?.items || [];
    return items.flatMap((it) => [
      { date: it.date, value: it.in, type: '入库' },
      { date: it.date, value: it.out, type: '出库' },
    ]);
  }, [trendData]);

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = dayjs(iso);
    return d.isValid() ? d.format('MM-DD HH:mm') : '—';
  };

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4 }} />}
      actionRow={
        <>
          <ModuleActionPanel title="仓储待办" lg={8} loading={todosLoading}>
            <ModuleTodoList items={todos} emptyText="暂无仓储待办" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="待入库队列"
            lg={8}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inbound')}>更多</a>}
          >
            <Table
              size="small"
              dataSource={s?.recent_inbounds ?? []}
              pagination={false}
              rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
              columns={[
                { title: '单号', dataIndex: 'doc_code', ellipsis: true },
                { title: '物料', dataIndex: 'material_name', ellipsis: true },
                { title: '时间', dataIndex: 'time', width: 90, render: formatTime },
              ]}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="待出库队列"
            lg={8}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/warehouse-management/outbound')}>更多</a>}
          >
            <Table
              size="small"
              dataSource={s?.recent_outbounds ?? []}
              pagination={false}
              rowKey={(r) => `${r.doc_type}-${r.doc_code}`}
              columns={[
                { title: '单号', dataIndex: 'doc_code', ellipsis: true },
                { title: '物料', dataIndex: 'material_name', ellipsis: true },
                { title: '时间', dataIndex: 'time', width: 90, render: formatTime },
              ]}
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartPanel title="出入库日趋势" loading={trendLoading} lg={24}>
          <Suspense fallback={null}>
            <WarehouseTrendLine
              data={trendChartData}
              xField="date"
              yField="value"
              colorField="type"
              height={260}
              smooth
            />
          </Suspense>
        </ModuleChartPanel>
      }
    />
  );
};

export default WarehouseDashboard;
