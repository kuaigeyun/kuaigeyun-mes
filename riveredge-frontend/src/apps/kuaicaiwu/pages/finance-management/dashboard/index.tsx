import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  WalletOutlined,
  DollarOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  ReconciliationOutlined,
  AlertOutlined,
  TransactionOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { managementReportService } from '../../../services/management-report';
import { agingService } from '../../../services/statistics/aging';
import { apiRequest } from '../../../../../services/api';
import { useDashboardRequest } from '../../../../kuaizhizao/utils/dashboardRequestOptions';
import FinanceAgingPanel from '../../../components/FinanceAgingPanel';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
  ModuleTodoList,
  ModuleChartPanel,
  showMasonryCard,
  masonryWeightFromRows,
  resolveMasonryEmptyFallback,
} from '../../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef, ModuleTodoItem } from '../../../../kuaizhizao/components/module-center';

const PERIOD_DAYS = 30;

function formatMoney(value?: number) {
  return `¥${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const FinanceCenterDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: financeSummary, loading: summaryLoading } = useDashboardRequest(
    () => apiRequest<Record<string, number>>('/apps/kuaicaiwu/management-report/finance-summary', { method: 'GET' }),
    'kz:finance-dashboard:summary',
  );
  const { data: kpis, loading: kpiLoading } = useDashboardRequest(
    () => managementReportService.getKPIs(PERIOD_DAYS),
    'kz:finance-dashboard:kpis',
  );
  const { data: costSummary, loading: costLoading } = useDashboardRequest(
    () => apiRequest<Record<string, number>>('/apps/kuaicaiwu/cost/cost-summary', { method: 'GET' }),
    'kc:finance-dashboard:cost-summary',
  );

  const { data: receivableAging, isLoading: loadingArAging } = useQuery({
    queryKey: ['receivableAging'],
    queryFn: () => agingService.getReceivableAging(),
  });
  const { data: payableAging, isLoading: loadingApAging } = useQuery({
    queryKey: ['payableAging'],
    queryFn: () => agingService.getPayableAging(),
  });
  const { data: qualityLoss } = useQuery({
    queryKey: ['qualityLoss', PERIOD_DAYS],
    queryFn: () => managementReportService.getQualityLoss(PERIOD_DAYS),
  });
  const { data: wip } = useQuery({
    queryKey: ['wipValuation'],
    queryFn: () => managementReportService.getWIPValuation(),
  });

  const s = financeSummary;
  const c = costSummary;
  const loading = (summaryLoading || kpiLoading || costLoading) && !s;

  const kpisRow: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: t('app.kuaicaiwu.financeDashboard.kpi.pendingReceiptPayment'),
        value: (s?.pending_receipts ?? 0) + (s?.pending_payments ?? 0),
        subtitle: t('app.kuaicaiwu.financeDashboard.kpi.pendingSubtitle', {
          receipts: s?.pending_receipts ?? 0,
          payments: s?.pending_payments ?? 0,
        }),
        icon: <WalletOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receipts'),
        sideMetrics: [
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.pendingReceipts'),
            value: s?.pending_receipts ?? 0,
          },
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.pendingPayments'),
            value: s?.pending_payments ?? 0,
          },
        ],
      },
      {
        key: 'overdue',
        title: t('app.kuaicaiwu.financeDashboard.kpi.overdueReceivables'),
        value: s?.overdue_receivables ?? 0,
        subtitle: t('app.kuaicaiwu.financeDashboard.kpi.overdueReceivablesSubtitle'),
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receivables?overdue_only=true'),
        sideMetrics: [
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.overduePayables'),
            value: s?.overdue_payables ?? 0,
          },
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.sideExpiringNotes'),
            value: s?.expiring_notes_total ?? 0,
          },
        ],
      },
      {
        key: 'cost',
        title: t('app.kuaicaiwu.costDashboard.kpi.pending'),
        value: c?.pending_calculations ?? 0,
        subtitle: t('app.kuaicaiwu.costDashboard.kpi.pendingSubtitle'),
        icon: <CalculatorOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
        onClick: () => navigate('/apps/kuaicaiwu/cost-management/cost-calculations'),
        sideMetrics: [
          {
            label: t('app.kuaicaiwu.costDashboard.kpi.month'),
            value: c?.month_calculations ?? 0,
          },
          {
            label: t('app.kuaicaiwu.managementDashboard.kpi.marginTitle'),
            value: `${((kpis?.gross_margin_rate ?? 0) * 100).toFixed(1)}%`,
          },
        ],
      },
    ],
    [c, kpis, navigate, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'receipt',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.receipts'),
        icon: <DollarOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaicaiwu/finance-management/receipts',
      },
      {
        key: 'payment',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.payments'),
        icon: <CreditCardOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
        path: '/apps/kuaicaiwu/finance-management/payments',
      },
      {
        key: 'ar',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.receivables'),
        icon: <WalletOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaicaiwu/finance-management/receivables',
      },
      {
        key: 'ap',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.payables'),
        icon: <FileTextOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaicaiwu/finance-management/payables',
      },
      {
        key: 'settle',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.settlement'),
        icon: <ReconciliationOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaicaiwu/finance-management/settlement',
      },
      {
        key: 'notes-ar',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.notesReceivable'),
        icon: <TransactionOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
        path: '/apps/kuaicaiwu/finance-management/notes-receivable',
      },
      {
        key: 'calc',
        title: t('app.kuaicaiwu.costDashboard.shortcut.calculations'),
        icon: <CalculatorOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaicaiwu/cost-management/cost-calculations',
      },
      {
        key: 'cost-report',
        title: t('app.kuaicaiwu.costDashboard.shortcut.report'),
        icon: <BarChartOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaicaiwu/cost-management/cost-report',
      },
      {
        key: 'margin',
        title: t('app.kuaicaiwu.menu.management-analysis.margin-report'),
        icon: <LineChartOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaicaiwu/management-analysis/margin-report',
      },
    ],
    [t],
  );

  const makeTodo = (
    id: string,
    title: string,
    link: string,
    priority: 'high' | 'medium' | 'low',
    description?: string,
  ): ModuleTodoItem => ({
    id,
    type: 'finance',
    title,
    description,
    priority,
    status: 'pending',
    link,
    created_at: new Date().toISOString(),
  });

  const pendingReceiptTodos = useMemo(() => {
    if ((s?.pending_receipts ?? 0) <= 0) return [];
    return [
      makeTodo(
        'fin-receipt',
        t('app.kuaicaiwu.financeDashboard.todo.pendingReceipts', { count: s?.pending_receipts ?? 0 }),
        '/apps/kuaicaiwu/finance-management/receipts',
        'medium',
      ),
    ];
  }, [s, t]);

  const pendingPaymentTodos = useMemo(() => {
    if ((s?.pending_payments ?? 0) <= 0) return [];
    return [
      makeTodo(
        'fin-payment',
        t('app.kuaicaiwu.financeDashboard.todo.pendingPayments', { count: s?.pending_payments ?? 0 }),
        '/apps/kuaicaiwu/finance-management/payments',
        'medium',
      ),
    ];
  }, [s, t]);

  const overdueArTodos = useMemo(() => {
    if ((s?.overdue_receivables ?? 0) <= 0) return [];
    return [
      makeTodo(
        'fin-ar',
        t('app.kuaicaiwu.financeDashboard.todo.overdueReceivables', { count: s?.overdue_receivables ?? 0 }),
        '/apps/kuaicaiwu/finance-management/receivables?overdue_only=true',
        'high',
      ),
    ];
  }, [s, t]);

  const expiringNotesTodos = useMemo(() => {
    if ((s?.expiring_notes_total ?? 0) <= 0) return [];
    return [
      makeTodo(
        'fin-notes',
        t('app.kuaicaiwu.financeDashboard.todo.expiringNotes', {
          count: s?.expiring_notes_total ?? 0,
        }),
        '/apps/kuaicaiwu/finance-management/notes-receivable?expiring_within_days=30',
        'high',
      ),
    ];
  }, [s, t]);

  const costTodos = useMemo(() => {
    if ((c?.pending_calculations ?? 0) <= 0) return [];
    return [
      makeTodo(
        'cost-pending',
        t('app.kuaicaiwu.costDashboard.todoPending', { count: c?.pending_calculations ?? 0 }),
        '/apps/kuaicaiwu/cost-management/cost-calculations',
        'medium',
      ),
    ];
  }, [c, t]);

  const insightItems = useMemo(() => {
    const items: ModuleTodoItem[] = [];
    const scrapCost = qualityLoss?.scrap_cost ?? 0;
    const sales = kpis?.total_sales ?? 0;
    const lossRatio = sales > 0 ? scrapCost / sales : 0;

    if (scrapCost > 0 && lossRatio >= 0.03) {
      items.push(
        makeTodo(
          'quality-loss',
          t('app.kuaicaiwu.managementDashboard.insight.qualityLossTitle', {
            amount: formatMoney(scrapCost),
            ratio: (lossRatio * 100).toFixed(1),
          }),
          '/apps/kuaizhizao/quality-management/inspection-center',
          'high',
          t('app.kuaicaiwu.managementDashboard.insight.qualityLossDesc'),
        ),
      );
    }

    if ((kpis?.dso ?? 0) > 45) {
      items.push(
        makeTodo(
          'dso-high',
          t('app.kuaicaiwu.managementDashboard.insight.dsoHighTitle', {
            days: Number(kpis?.dso ?? 0).toFixed(1),
          }),
          '/apps/kuaicaiwu/finance-management/receivables',
          'medium',
          t('app.kuaicaiwu.managementDashboard.insight.dsoHighDesc'),
        ),
      );
    }

    if ((wip?.estimated_wip_value ?? 0) > 0) {
      items.push(
        makeTodo(
          'wip',
          t('app.kuaicaiwu.managementDashboard.insight.wipTitle', {
            amount: formatMoney(wip?.estimated_wip_value),
          }),
          '/apps/kuaizhizao/production-execution/work-orders',
          'medium',
          t('app.kuaicaiwu.managementDashboard.insight.wipDesc'),
        ),
      );
    }

    return items;
  }, [kpis, qualityLoss, t, wip]);

  const hasReceivableAging =
    receivableAging != null &&
    Object.values(receivableAging).some((b) => Number(b?.amount) > 0 || Number(b?.count) > 0);
  const hasPayableAging =
    payableAging != null &&
    Object.values(payableAging).some((b) => Number(b?.amount) > 0 || Number(b?.count) > 0);

  const masonryLoading = loading || costLoading || loadingArAging || loadingApAging;
  const masonryEmptyFallback = resolveMasonryEmptyFallback(masonryLoading, [
    pendingReceiptTodos.length > 0,
    pendingPaymentTodos.length > 0,
    overdueArTodos.length > 0,
    expiringNotesTodos.length > 0,
    costTodos.length > 0,
    insightItems.length > 0,
    hasReceivableAging,
    hasPayableAging,
  ]);

  return (
    <ModuleCenterLayout
      moduleHelpKey="finance"
      loading={loading}
      kpiRow={<ModuleKpiRow items={kpisRow} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <ModuleActionMasonry>
          {showMasonryCard(loading, pendingReceiptTodos.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.panel.pendingReceipts')} masonryWeight={1} extra={<a onClick={() => navigate('/apps/kuaicaiwu/finance-management/receipts')}>{t('app.kuaicaiwu.financeDashboard.viewAll')}</a>}>
              <ModuleTodoList items={pendingReceiptTodos} emptyText={t('app.kuaicaiwu.financeDashboard.noPendingReceipts')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(loading, pendingPaymentTodos.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.panel.pendingPayments')} masonryWeight={1} extra={<a onClick={() => navigate('/apps/kuaicaiwu/finance-management/payments')}>{t('app.kuaicaiwu.financeDashboard.viewAll')}</a>}>
              <ModuleTodoList items={pendingPaymentTodos} emptyText={t('app.kuaicaiwu.financeDashboard.noPendingPayments')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(loading, overdueArTodos.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.panel.overdueReceivables')} masonryWeight={1} extra={<a onClick={() => navigate('/apps/kuaicaiwu/finance-management/receivables?overdue_only=true')}>{t('app.kuaicaiwu.financeDashboard.viewAll')}</a>}>
              <ModuleTodoList items={overdueArTodos} emptyText={t('app.kuaicaiwu.financeDashboard.noOverdueReceivables')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(loading, expiringNotesTodos.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.panel.expiringNotes')} masonryWeight={1} extra={<a onClick={() => navigate('/apps/kuaicaiwu/finance-management/notes-receivable?expiring_within_days=30')}>{t('app.kuaicaiwu.financeDashboard.viewAll')}</a>}>
              <ModuleTodoList items={expiringNotesTodos} emptyText={t('app.kuaicaiwu.financeDashboard.noExpiringNotes')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(costLoading, costTodos.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.costDashboard.todoPanel')} masonryWeight={1} extra={<a onClick={() => navigate('/apps/kuaicaiwu/cost-management/cost-calculations')}>{t('app.kuaicaiwu.financeDashboard.viewAll')}</a>}>
              <ModuleTodoList items={costTodos} emptyText={t('app.kuaicaiwu.costDashboard.emptyTodos')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(loading, insightItems.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaicaiwu.managementDashboard.actionPanelTitle', { days: PERIOD_DAYS })} masonryWeight={masonryWeightFromRows(insightItems.length)}>
              <ModuleTodoList items={insightItems} emptyText={t('app.kuaicaiwu.managementDashboard.emptyInsights')} />
            </ModuleActionPanel>
          ) : null}
          {showMasonryCard(loadingArAging, hasReceivableAging, masonryEmptyFallback) ? (
            <ModuleChartPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.receivableAgingTitle')} loading={loadingArAging} height={360} masonryWeight={3}>
              <FinanceAgingPanel data={receivableAging} detailPath="/apps/kuaicaiwu/finance-management/receivables" onOpenDetail={navigate} />
            </ModuleChartPanel>
          ) : null}
          {showMasonryCard(loadingApAging, hasPayableAging, masonryEmptyFallback) ? (
            <ModuleChartPanel layout="masonry" title={t('app.kuaicaiwu.financeDashboard.payableAgingTitle')} loading={loadingApAging} height={360} masonryWeight={3}>
              <FinanceAgingPanel data={payableAging} detailPath="/apps/kuaicaiwu/finance-management/payables" onOpenDetail={navigate} />
            </ModuleChartPanel>
          ) : null}
        </ModuleActionMasonry>
      }
    />
  );
};

export default FinanceCenterDashboard;
