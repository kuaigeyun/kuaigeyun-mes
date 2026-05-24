import React, { Suspense, lazy, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import {
  WalletOutlined,
  DollarOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  ReconciliationOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { managementReportService } from '../../../services/management-report';
import { apiRequest } from '../../../../services/api';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../../kuaizhizao/components/module-center';

const FinancePie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

const FinanceCenterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: financeSummary, loading: summaryLoading } = useRequest(() =>
    apiRequest<Record<string, number>>('/apps/kuaicaiwu/management-report/finance-summary', { method: 'GET' }),
  );
  const { data: kpis, loading: kpiLoading } = useRequest(() => managementReportService.getKPIs(30));

  const s = financeSummary;
  const loading = summaryLoading || kpiLoading;

  const kpisRow: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: '待审核收付款',
        value: (s?.pending_receipts ?? 0) + (s?.pending_payments ?? 0),
        subtitle: `收款 ${s?.pending_receipts ?? 0} · 付款 ${s?.pending_payments ?? 0}`,
        icon: <WalletOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receipts'),
        sideMetrics: [
          { label: '待审收款', value: s?.pending_receipts ?? 0 },
          { label: '待审付款', value: s?.pending_payments ?? 0 },
        ],
      },
      {
        key: 'ar',
        title: '逾期应收',
        value: s?.overdue_receivables ?? 0,
        subtitle: '需跟进催收',
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receivables'),
      },
      {
        key: 'ap',
        title: '逾期应付',
        value: s?.overdue_payables ?? 0,
        subtitle: `DSO ${kpis?.dso ?? 0} 天`,
        icon: <CreditCardOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/payables'),
      },
    ],
    [navigate, s, kpis],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'receipt', title: '收款单', icon: <DollarOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaicaiwu/finance-management/receipts' },
    { key: 'payment', title: '付款单', icon: <CreditCardOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/kuaicaiwu/finance-management/payments' },
    { key: 'ar', title: '应收管理', icon: <WalletOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaicaiwu/finance-management/receivables' },
    { key: 'ap', title: '应付管理', icon: <FileTextOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaicaiwu/finance-management/payables' },
    { key: 'settle', title: '对账结算', icon: <ReconciliationOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/kuaicaiwu/finance-management/settlement' },
  ];

  const agingData = useMemo(() => {
    if (!kpis?.receivable_aging) return [];
    return Object.entries(kpis.receivable_aging).map(([key, val]: [string, { amount?: number }]) => ({
      type: key,
      value: val?.amount ?? 0,
    }));
  }, [kpis]);

  const todoItems = useMemo(() => {
    const list = [];
    if ((s?.pending_receipts ?? 0) > 0) {
      list.push({
        id: 'fin-receipt',
        type: 'finance',
        title: `${s?.pending_receipts} 笔收款单待审核`,
        priority: 'medium',
        status: 'pending',
        link: '/apps/kuaicaiwu/finance-management/receipts',
        created_at: new Date().toISOString(),
      });
    }
    if ((s?.overdue_receivables ?? 0) > 0) {
      list.push({
        id: 'fin-ar',
        type: 'finance',
        title: `${s?.overdue_receivables} 笔应收已逾期`,
        priority: 'high',
        status: 'pending',
        link: '/apps/kuaicaiwu/finance-management/receivables',
        created_at: new Date().toISOString(),
      });
    }
    return list;
  }, [s]);

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpisRow} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4, lg: 4 }} />}
      actionRow={
        <ModuleActionPanel title="财务待办" lg={24}>
          <ModuleTodoList items={todoItems} emptyText="暂无财务待办" />
        </ModuleActionPanel>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel title="应收账龄分布" lg={24}>
            <Suspense fallback={null}>
              <FinancePie
                data={agingData}
                angleField="value"
                colorField="type"
                radius={0.75}
                height={260}
                label={{ type: 'outer' }}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default FinanceCenterDashboard;
