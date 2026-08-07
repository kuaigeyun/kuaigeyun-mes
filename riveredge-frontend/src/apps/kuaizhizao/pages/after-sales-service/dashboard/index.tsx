import React, { useMemo } from 'react';
import { Table } from 'antd';
import {
  CustomerServiceOutlined,
  ToolOutlined,
  TeamOutlined,
  FileProtectOutlined,
  InboxOutlined,
  AccountBookOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';
import { ROUTES } from '../../../constants/routes';
import {
  customerReturnVisitApi,
  getAfterSalesDashboardSummary,
  repairOrderApi,
} from '../../../services/after-sales-service';
import { afterSalesTicketApi } from '../../../services/after-sales-ticket';
import { formatDateTime } from '../../../../../utils/format';

const KPI_GRADIENT = 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)';

const AfterSalesDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    getAfterSalesDashboardSummary,
    'kz:after-sales-dashboard:summary',
  );
  const { data: recentTickets, loading: ticketsLoading } = useDashboardRequest(async () => {
    const res = await afterSalesTicketApi.list({ limit: 6, status: '待处理' });
    return res.items ?? [];
  }, 'kz:after-sales-dashboard:tickets');
  const { data: recentRepairs, loading: repairsLoading } = useDashboardRequest(async () => {
    const res = await repairOrderApi.list({ limit: 6, status: '待派工' });
    return res.items ?? [];
  }, 'kz:after-sales-dashboard:repairs');
  const { data: recentVisits, loading: visitsLoading } = useDashboardRequest(async () => {
    const res = await customerReturnVisitApi.list({ limit: 6 });
    return res.items ?? [];
  }, 'kz:after-sales-dashboard:visits');

  const s = summary as Record<string, number> | undefined;
  const tickets = recentTickets ?? [];
  const repairs = recentRepairs ?? [];
  const visits = recentVisits ?? [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'tickets',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.openTickets'),
        value: s?.open_ticket_count ?? tickets.length,
        icon: <CustomerServiceOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_TICKETS),
      },
      {
        key: 'install',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.pendingInstall'),
        value: s?.pending_install_count ?? 0,
        icon: <ToolOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_INSTALL_EXECUTION),
      },
      {
        key: 'repair',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.pendingRepair'),
        value: s?.pending_repair_count ?? repairs.length,
        icon: <FileProtectOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_REPAIR_ORDERS),
      },
      {
        key: 'dispatch',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.pendingDispatch'),
        value: s?.pending_dispatch_count ?? 0,
        icon: <TeamOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_DISPATCH_ORDERS),
      },
      {
        key: 'requisition',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.pendingRequisition'),
        value: s?.pending_requisition_count ?? 0,
        icon: <InboxOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_SPARE_PART_REQUISITIONS),
      },
      {
        key: 'settlement',
        title: t('app.kuaizhizao.afterSalesService.dashboard.kpi.pendingSettlement'),
        value: s?.pending_settlement_count ?? 0,
        icon: <AccountBookOutlined />,
        gradient: KPI_GRADIENT,
        onClick: () => navigate(ROUTES.AFTER_SALES_SERVICE_SETTLEMENTS),
      },
    ],
    [navigate, repairs.length, s, t, tickets.length],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'tickets',
        title: t('app.kuaizhizao.menu.after-sales-service.tickets'),
        icon: <CustomerServiceOutlined />,
        path: ROUTES.AFTER_SALES_TICKETS,
      },
      {
        key: 'install',
        title: t('app.kuaizhizao.menu.after-sales-service.install-execution'),
        icon: <ToolOutlined />,
        path: ROUTES.AFTER_SALES_INSTALL_EXECUTION,
      },
      {
        key: 'repair',
        title: t('app.kuaizhizao.menu.after-sales-service.repair-orders'),
        icon: <FileProtectOutlined />,
        path: ROUTES.AFTER_SALES_REPAIR_ORDERS,
      },
      {
        key: 'dispatch',
        title: t('app.kuaizhizao.menu.after-sales-service.dispatch-orders'),
        icon: <TeamOutlined />,
        path: ROUTES.AFTER_SALES_DISPATCH_ORDERS,
      },
      {
        key: 'assets',
        title: t('app.kuaizhizao.menu.after-sales-service.service-assets'),
        icon: <InboxOutlined />,
        path: ROUTES.AFTER_SALES_SERVICE_ASSETS,
      },
      {
        key: 'visits',
        title: t('app.kuaizhizao.menu.after-sales-service.return-visits'),
        icon: <PhoneOutlined />,
        path: ROUTES.AFTER_SALES_RETURN_VISITS,
      },
    ],
    [t],
  );

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 4, lg: 4 }} fillByItemCount />}
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.afterSalesService.dashboard.pendingTickets')}
            loading={ticketsLoading}
            extra={<a onClick={() => navigate(ROUTES.AFTER_SALES_TICKETS)}>{t('common.viewAll', { defaultValue: '查看全部' })}</a>}
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={tickets}
              locale={{ emptyText: t('app.kuaizhizao.afterSalesService.dashboard.empty') }}
              columns={[
                { title: t('app.kuaizhizao.afterSalesTicket.colTicketCode'), dataIndex: 'ticket_code' },
                { title: t('app.kuaizhizao.afterSalesTicket.colCustomer'), dataIndex: 'customer_name' },
                { title: t('app.kuaizhizao.afterSalesTicket.colStatus'), dataIndex: 'status' },
              ]}
              onRow={() => ({ onClick: () => navigate(ROUTES.AFTER_SALES_TICKETS), style: { cursor: 'pointer' } })}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.afterSalesService.dashboard.pendingRepairs')}
            loading={repairsLoading}
            extra={<a onClick={() => navigate(ROUTES.AFTER_SALES_REPAIR_ORDERS)}>{t('common.viewAll', { defaultValue: '查看全部' })}</a>}
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={repairs}
              locale={{ emptyText: t('app.kuaizhizao.afterSalesService.dashboard.empty') }}
              columns={[
                { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.orderCode'), dataIndex: 'order_code' },
                { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName'), dataIndex: 'customer_name' },
                { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.status'), dataIndex: 'status' },
              ]}
              onRow={() => ({ onClick: () => navigate(ROUTES.AFTER_SALES_REPAIR_ORDERS), style: { cursor: 'pointer' } })}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.afterSalesService.dashboard.recentVisits')}
            loading={visitsLoading}
            extra={<a onClick={() => navigate(ROUTES.AFTER_SALES_RETURN_VISITS)}>{t('common.viewAll', { defaultValue: '查看全部' })}</a>}
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={visits}
              locale={{ emptyText: t('app.kuaizhizao.afterSalesService.dashboard.empty') }}
              columns={[
                { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitCode'), dataIndex: 'visit_code' },
                { title: t('app.kuaizhizao.afterSalesService.returnVisit.field.customerName'), dataIndex: 'customer_name' },
                {
                  title: t('app.kuaizhizao.afterSalesService.returnVisit.field.visitedAt'),
                  dataIndex: 'visited_at',
                  render: (v) => (v ? formatDateTime(String(v)) : '-'),
                },
              ]}
              onRow={() => ({ onClick: () => navigate(ROUTES.AFTER_SALES_RETURN_VISITS), style: { cursor: 'pointer' } })}
            />
          </ModuleActionPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default AfterSalesDashboardPage;
