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
} from '../../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef, ModuleTodoItem } from '../../../../kuaizhizao/components/module-center';

const FinanceCenterDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: financeSummary, loading: summaryLoading } = useDashboardRequest(
    () => apiRequest<Record<string, number>>('/apps/kuaicaiwu/management-report/finance-summary', { method: 'GET' }),
    'kz:finance-dashboard:summary',
  );
  const { data: kpis, loading: kpiLoading } = useDashboardRequest(
    () => managementReportService.getKPIs(30),
    'kz:finance-dashboard:kpis',
  );

  const { data: receivableAging, isLoading: loadingArAging } = useQuery({
    queryKey: ['receivableAging'],
    queryFn: () => agingService.getReceivableAging(),
  });
  const { data: payableAging, isLoading: loadingApAging } = useQuery({
    queryKey: ['payableAging'],
    queryFn: () => agingService.getPayableAging(),
  });

  const s = financeSummary;
  const loading = summaryLoading || kpiLoading;

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
        key: 'ar',
        title: t('app.kuaicaiwu.financeDashboard.kpi.overdueReceivables'),
        value: s?.overdue_receivables ?? 0,
        subtitle: t('app.kuaicaiwu.financeDashboard.kpi.overdueReceivablesSubtitle'),
        icon: <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receivables'),
      },
      {
        key: 'ap',
        title: t('app.kuaicaiwu.financeDashboard.kpi.overduePayables'),
        value: s?.overdue_payables ?? 0,
        subtitle: t('app.kuaicaiwu.financeDashboard.kpi.overduePayablesSubtitle', {
          dso: kpis?.dso ?? 0,
        }),
        icon: <CreditCardOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/payables'),
      },
      {
        key: 'pipeline',
        title: t('app.kuaicaiwu.financeDashboard.kpi.openFinanceDocuments'),
        value: s?.open_finance_document_count ?? 0,
        subtitle: t('app.kuaicaiwu.financeDashboard.kpi.openFinanceDocumentsSubtitle', {
          receivable: s?.open_receivable_count ?? 0,
          payable: s?.open_payable_count ?? 0,
          receipt: s?.unsettled_receipt_count ?? 0,
          payment: s?.unsettled_payment_count ?? 0,
        }),
        icon: <ReconciliationOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/document-reconciliation'),
        sideMetrics: [
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.openReceivableAmount'),
            value: `¥${Number(s?.open_receivable_amount ?? 0).toFixed(0)}`,
          },
          {
            label: t('app.kuaicaiwu.financeDashboard.kpi.openPayableAmount'),
            value: `¥${Number(s?.open_payable_amount ?? 0).toFixed(0)}`,
          },
        ],
      },
    ],
    [navigate, s, kpis, t],
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
        key: 'partner-stmt',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.partnerStatements'),
        icon: <ReconciliationOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
        path: '/apps/kuaicaiwu/finance-management/partner-statements',
      },
      {
        key: 'doc-recon',
        title: t('app.kuaicaiwu.financeDashboard.shortcut.documentReconciliation'),
        icon: <FileTextOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaicaiwu/finance-management/document-reconciliation',
      },
    ],
    [t],
  );

  const makeTodo = (
    id: string,
    title: string,
    link: string,
    priority: 'high' | 'medium' | 'low',
  ): ModuleTodoItem => ({
    id,
    type: 'finance',
    title,
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
        '/apps/kuaicaiwu/finance-management/receivables',
        'high',
      ),
    ];
  }, [s, t]);

  const openDocTodos = useMemo(() => {
    if ((s?.open_finance_document_count ?? 0) <= 0) return [];
    return [
      makeTodo(
        'fin-pipeline',
        t('app.kuaicaiwu.financeDashboard.todo.openFinanceDocuments', {
          count: s?.open_finance_document_count ?? 0,
        }),
        '/apps/kuaicaiwu/finance-management/document-reconciliation',
        'medium',
      ),
    ];
  }, [s, t]);

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpisRow} colProps={{ xs: 24, sm: 12, lg: 6 }} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4, lg: 4 }} fillByItemCount />}
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.panel.pendingReceipts')}
            extra={
              <a onClick={() => navigate('/apps/kuaicaiwu/finance-management/receipts')}>
                {t('app.kuaicaiwu.financeDashboard.viewAll')}
              </a>
            }
          >
            <ModuleTodoList
              items={pendingReceiptTodos}
              emptyText={t('app.kuaicaiwu.financeDashboard.noPendingReceipts')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.panel.pendingPayments')}
            extra={
              <a onClick={() => navigate('/apps/kuaicaiwu/finance-management/payments')}>
                {t('app.kuaicaiwu.financeDashboard.viewAll')}
              </a>
            }
          >
            <ModuleTodoList
              items={pendingPaymentTodos}
              emptyText={t('app.kuaicaiwu.financeDashboard.noPendingPayments')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.panel.overdueReceivables')}
            extra={
              <a onClick={() => navigate('/apps/kuaicaiwu/finance-management/receivables')}>
                {t('app.kuaicaiwu.financeDashboard.viewAll')}
              </a>
            }
          >
            <ModuleTodoList
              items={overdueArTodos}
              emptyText={t('app.kuaicaiwu.financeDashboard.noOverdueReceivables')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.panel.openDocuments')}
            extra={
              <a onClick={() => navigate('/apps/kuaicaiwu/finance-management/document-reconciliation')}>
                {t('app.kuaicaiwu.financeDashboard.viewAll')}
              </a>
            }
          >
            <ModuleTodoList
              items={openDocTodos}
              emptyText={t('app.kuaicaiwu.financeDashboard.noOpenDocuments')}
            />
          </ModuleActionPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.receivableAgingTitle')}
            loading={loadingArAging}
            height={360}
          >
            <FinanceAgingPanel
              data={receivableAging}
              detailPath="/apps/kuaicaiwu/finance-management/receivables"
              onOpenDetail={navigate}
            />
          </ModuleChartPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaicaiwu.financeDashboard.payableAgingTitle')}
            loading={loadingApAging}
            height={360}
          >
            <FinanceAgingPanel
              data={payableAging}
              detailPath="/apps/kuaicaiwu/finance-management/payables"
              onOpenDetail={navigate}
            />
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default FinanceCenterDashboard;
