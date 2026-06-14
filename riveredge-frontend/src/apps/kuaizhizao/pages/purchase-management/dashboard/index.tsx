import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Progress, Table, Tag, Typography } from 'antd';
import { useRequest } from 'ahooks';
import {
  ShoppingCartOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  UserOutlined,
  FileSearchOutlined,
  BellOutlined,
  RocketOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mesDashboardService } from '../../../services/dashboard';
import { listPurchaseOrders } from '../../../services/purchase';
import { listPurchaseRequisitions } from '../../../services/purchase-requisition';
import { getPurchaseTop10 } from '../../../../../services/dashboard';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_PURCHASE_ORDER_FIELD_RESOURCE as PO } from '../../../constants/fieldPermissionResources';
import { dashboardRequestOptions } from '../../../utils/dashboardRequestOptions';
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

const PurchaseTrendLine = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Line>) => <Line {...props} /> };
});

const PurchaseTopColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

const PurchaseDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [trendType, setTrendType] = useState<'amount' | 'quantity'>('amount');

  const { data: summary, loading: summaryLoading } = useRequest(
    mesDashboardService.getPurchaseSummary,
    dashboardRequestOptions('kz:purchase-dashboard:summary'),
  );
  const { data: todosData, loading: todosLoading } = useRequest(() =>
    mesDashboardService.getTodosByModule('purchase', 8),
    dashboardRequestOptions('kz:purchase-dashboard:todos'),
  );
  const { data: recentOrdersData, loading: ordersLoading } = useRequest(() =>
    listPurchaseOrders({ limit: 8 }),
    dashboardRequestOptions('kz:purchase-dashboard:recent-orders'),
  );
  const { data: recentRequisitionsData, loading: requisitionsLoading } = useRequest(() =>
    listPurchaseRequisitions({ limit: 8 }),
    dashboardRequestOptions('kz:purchase-dashboard:recent-requisitions'),
  );
  const { data: trendData, loading: trendLoading } = useRequest(
    mesDashboardService.getPurchaseTrend,
    dashboardRequestOptions('kz:purchase-dashboard:trend'),
  );
  const { data: top10Data, loading: topLoading } = useRequest(
    () => getPurchaseTop10(undefined, undefined, 8),
    dashboardRequestOptions('kz:purchase-dashboard:top10'),
  );

  const s = summary as Record<string, number> | undefined;
  const recentOrders = recentOrdersData?.data || [];
  const recentRequisitions = recentRequisitionsData?.data || [];
  const todos = todosData?.items || [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'requisitions',
        title: '待处理申购',
        value: s?.pending_requisitions ?? 0,
        subtitle: `本月新增申购 ${s?.new_requisitions_this_month ?? 0} 条`,
        icon: <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions'),
        sideMetrics: [{ label: '本月新增', value: s?.new_requisitions_this_month ?? 0 }],
      },
      {
        key: 'receipts',
        title: '待收货订单',
        value: s?.pending_receipts ?? 0,
        subtitle:
          (s?.overdue_receipts ?? 0) > 0
            ? `含 ${s?.overdue_receipts} 单已逾期未到货`
            : '全部到货计划正常',
        icon: <InboxOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        onClick: () => navigate('/apps/kuaizhizao/purchase-management/purchase-orders?status=approved'),
        sideMetrics: [{ label: '已逾期', value: s?.overdue_receipts ?? 0 }],
      },
      {
        key: 'arrival',
        title: '本月采购到货率',
        value: `${s?.arrival_rate ?? 0}%`,
        icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
        progress: s?.arrival_rate ?? 0,
      },
    ],
    [navigate, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'req', title: '采购申请', icon: <FileSearchOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-requisitions' },
    { key: 'po', title: '采购订单', icon: <ShoppingCartOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-orders' },
    { key: 'supplier', title: '供应商', icon: <UserOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/purchase-management/suppliers' },
    { key: 'notice', title: '收货通知', icon: <BellOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/kuaizhizao/purchase-management/receipt-notices' },
    { key: 'return', title: '采购退货', icon: <RollbackOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/purchase-management/purchase-returns' },
  ];

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
        <>
          <ModuleActionPanel
            title="采购待办"
            lg={8}
            loading={todosLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>查看全部</a>}
          >
            <ModuleTodoList items={todos} emptyText="暂无采购待办" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="待处理采购申请"
            lg={8}
            loading={requisitionsLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-requisitions')}>全部</a>}
          >
            <Table
              size="small"
              dataSource={recentRequisitions.filter((r: { status?: string }) =>
                ['待审核', '审批中', 'draft', 'pending'].includes(String(r.status)),
              ).slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={[
                {
                  title: '申请单号',
                  dataIndex: 'requisition_code',
                  render: (text, record: { id: number }) => (
                    <a onClick={() => navigate(`/apps/kuaizhizao/purchase-management/purchase-requisitions/${record.id}`)}>{text}</a>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 80,
                  render: (status) => <Tag color="warning">{status}</Tag>,
                },
              ]}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="待到货采购订单"
            lg={8}
            loading={ordersLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/purchase-management/purchase-orders')}>全部</a>}
          >
            <Table
              size="small"
              dataSource={recentOrders.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={[
                {
                  title: '订单编号',
                  dataIndex: 'order_code',
                  render: (text, record: { id: number }) => (
                    <a onClick={() => navigate(`/apps/kuaizhizao/purchase-management/purchase-orders/${record.id}`)}>{text}</a>
                  ),
                },
                {
                  title: '金额',
                  dataIndex: 'total_amount',
                  align: 'right' as const,
                  render: (val) => (
                    <Text strong>
                      <AmountDisplay resource={PO} fieldName="total_amount" value={val != null ? Number(val) : null} />
                    </Text>
                  ),
                },
              ]}
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel
            title="采购趋势"
            loading={trendLoading}
            segmented={{
              value: trendType,
              options: [
                { label: '金额', value: 'amount' },
                { label: '数量', value: 'quantity' },
              ],
              onChange: (v) => setTrendType(v as 'amount' | 'quantity'),
            }}
          >
            <Suspense fallback={null}>
              <PurchaseTrendLine
                data={trendChartData}
                xField="date"
                yField="value"
                height={240}
                smooth
                axis={{ y: { title: false }, x: { title: false } }}
              />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel title="采购物料 TOP" loading={topLoading}>
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
        </ModuleChartRow>
      }
    />
  );
};

export default PurchaseDashboard;
