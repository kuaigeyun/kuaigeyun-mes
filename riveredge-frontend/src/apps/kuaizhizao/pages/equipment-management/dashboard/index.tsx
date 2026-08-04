import React, { Suspense, lazy, useMemo } from 'react';
import { Table, Tag, Typography } from 'antd';
import {
  ToolOutlined,
  CalendarOutlined,
  DashboardOutlined,
  SettingOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mesDashboardService } from '../../../services/dashboard';
import { equipmentFaultApi, maintenancePlanApi, sparePartApi } from '../../../services/equipment';
import { spotChecksApi } from '../../../services/equipmentOps';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartMount,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

const EquipmentTrendColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

const EquipmentStatusPie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

const SPOT_CHECK_PENDING = new Set(['draft', 'pending', '待执行', '草稿', 'DRAFT', 'PENDING']);

function unwrapList(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const payload = res as { items?: Record<string, unknown>[]; data?: Record<string, unknown>[] };
  return payload?.items ?? payload?.data ?? [];
}

const EquipmentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    mesDashboardService.getEquipmentSummary,
    'kz:equipment-dashboard:summary',
  );
  const { data: todosData, loading: todosLoading } = useDashboardRequest(
    () => mesDashboardService.getTodosByModule('equipment', 8),
    'kz:equipment-dashboard:todos',
  );
  const { data: recentFaultsResult, loading: faultsLoading } = useDashboardRequest(async () => {
    const res = await equipmentFaultApi.list({ limit: 6 });
    return unwrapList(res);
  }, 'kz:equipment-dashboard:faults');
  const { data: recentMaintenanceResult, loading: maintenanceLoading } = useDashboardRequest(async () => {
    const res = await maintenancePlanApi.list({ limit: 6 });
    return unwrapList(res);
  }, 'kz:equipment-dashboard:maintenance');
  const { data: spotChecksResult, loading: spotChecksLoading } = useDashboardRequest(async () => {
    const res = await spotChecksApi.list({ limit: 12 });
    return unwrapList(res).filter((row) => SPOT_CHECK_PENDING.has(String(row.status ?? '')));
  }, 'kz:equipment-dashboard:spot-checks');
  const { data: spareAlertsResult, loading: spareAlertsLoading } = useDashboardRequest(async () => {
    const res = await sparePartApi.getAlerts();
    return Array.isArray(res) ? res : unwrapList(res);
  }, 'kz:equipment-dashboard:spare-alerts');
  const { data: trendData, loading: trendLoading } = useDashboardRequest(
    mesDashboardService.getEquipmentTrend,
    'kz:equipment-dashboard:trend',
  );

  const s = summary as Record<string, number> | undefined;
  const recentFaults = recentFaultsResult || [];
  const recentMaintenance = recentMaintenanceResult || [];
  const spotChecks = spotChecksResult || [];
  const spareAlerts = spareAlertsResult || [];
  const todos = todosData?.items || [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'fault',
        title: t('app.kuaizhizao.equipmentDashboard.kpi.faultInProgress'),
        value: s?.faulty_count ?? 0,
        subtitle:
          (s?.faulty_count ?? 0) > 0
            ? t('app.kuaizhizao.equipmentDashboard.kpi.faultSubtitleWithCount', {
                count: s?.faulty_count ?? 0,
              })
            : t('app.kuaizhizao.equipmentDashboard.kpi.faultSubtitleHealthy'),
        icon: <ToolOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/equipment-faults?status=处理中'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.equipmentDashboard.kpi.totalEquipment'),
            value: s?.total_count ?? 0,
          },
        ],
      },
      {
        key: 'calibration',
        title: t('app.kuaizhizao.equipmentDashboard.kpi.calibrationNeeded'),
        value: s?.calibration_needed ?? 0,
        subtitle: t('app.kuaizhizao.equipmentDashboard.kpi.calibrationSubtitle'),
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/equipment'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.equipmentDashboard.kpi.overdueCalibration'),
            value: s?.calibration_needed ?? 0,
          },
        ],
      },
      {
        key: 'oee',
        title: t('app.kuaizhizao.equipmentDashboard.kpi.oee'),
        value: `${s?.average_oee ?? 0}%`,
        icon: <DashboardOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        progress: s?.average_oee ?? 0,
        sideMetrics: [
          {
            label: t('app.kuaizhizao.equipmentDashboard.kpi.availability'),
            value: `${s?.availability_rate ?? 0}%`,
          },
          {
            label: t('app.kuaizhizao.equipmentDashboard.kpi.failureRate'),
            value: `${s?.failure_rate ?? 0}%`,
          },
        ],
      },
    ],
    [navigate, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'ledger',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.ledger'),
        icon: <BuildOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaizhizao/equipment-management/equipment',
      },
      {
        key: 'maint',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.maintenance'),
        icon: <CalendarOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaizhizao/equipment-management/maintenance-plans',
      },
      {
        key: 'fault',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.fault'),
        icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
        path: '/apps/kuaizhizao/equipment-management/equipment-faults',
      },
      {
        key: 'spotCheck',
        title: t('app.kuaizhizao.menu.equipment-management.spot-checks'),
        icon: <SafetyCertificateOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaizhizao/equipment-management/spot-checks',
      },
      {
        key: 'spare',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.spareParts'),
        icon: <SettingOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaizhizao/equipment-management/spare-parts',
      },
    ],
    [t],
  );

  const statusPieData = useMemo(
    () => [
      {
        type: t('app.kuaizhizao.equipmentDashboard.chart.statusNormal'),
        value: Math.max(0, (s?.total_count ?? 0) - (s?.faulty_count ?? 0)),
      },
      {
        type: t('app.kuaizhizao.equipmentDashboard.chart.statusFault'),
        value: s?.faulty_count ?? 0,
      },
    ],
    [s, t],
  );

  const faultColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentDashboard.colFaultNo'),
        dataIndex: 'fault_no',
        render: (text: string, record: { id?: number }) => (
          <a
            onClick={() =>
              navigate(
                record.id
                  ? `/apps/kuaizhizao/equipment-management/equipment-faults/${record.id}`
                  : '/apps/kuaizhizao/equipment-management/equipment-faults',
              )
            }
          >
            {text}
          </a>
        ),
      },
      {
        title: t('app.kuaizhizao.equipmentDashboard.colEquipment'),
        dataIndex: 'equipment_name',
        ellipsis: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (status: string) => <Tag color="error">{status}</Tag>,
      },
    ],
    [navigate, t],
  );

  const maintenanceColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentDashboard.colMaintenanceName'),
        dataIndex: 'plan_name',
        ellipsis: true,
        render: (text: string, record: Record<string, unknown>) =>
          String(text || record.name || '—'),
      },
      {
        title: t('app.kuaizhizao.equipmentDashboard.colNextPlanDate'),
        dataIndex: 'planned_start_date',
        width: 110,
        render: (value: string, record: Record<string, unknown>) => {
          const raw = value || record.next_execution_date;
          const label =
            raw == null
              ? '—'
              : String(raw).includes('T')
                ? String(raw).slice(0, 10)
                : String(raw).slice(0, 10);
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {label}
            </Text>
          );
        },
      },
    ],
    [t],
  );

  const spotCheckColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentDashboard.colSpotCheckCode'),
        dataIndex: 'document_no',
        render: (text: string, record: { id?: number; check_code?: string }) => (
          <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/spot-checks')}>
            {text || record.check_code || record.id}
          </a>
        ),
      },
      {
        title: t('app.kuaizhizao.equipmentDashboard.colEquipment'),
        dataIndex: 'equipment_name',
        ellipsis: true,
      },
    ],
    [navigate, t],
  );

  const spareAlertColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentDashboard.colSparePart'),
        dataIndex: 'part_name',
        ellipsis: true,
        render: (text: string, record: Record<string, unknown>) =>
          String(text || record.spare_part_name || record.name || record.material_name || '—'),
      },
      {
        title: t('app.kuaizhizao.equipmentDashboard.colStockQty'),
        dataIndex: 'current_stock',
        width: 72,
        render: (_: unknown, record: Record<string, unknown>) =>
          String(record.current_stock ?? record.current_quantity ?? record.quantity ?? '—'),
      },
    ],
    [t],
  );

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
            title={t('app.kuaizhizao.equipmentDashboard.todosTitle')}
            loading={todosLoading}
          >
            <ModuleTodoList
              items={todos}
              emptyText={t('app.kuaizhizao.equipmentDashboard.noTodos')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.pendingFaultsTitle')}
            loading={faultsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/equipment-faults')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={recentFaults
                .filter(
                  (f) =>
                    !String(f.status).includes('完成') && !String(f.status).includes('fixed'),
                )
                .slice(0, 6)}
              pagination={false}
              rowKey={(r) => String(r.id ?? r.uuid)}
              columns={faultColumns}
              locale={{ emptyText: t('app.kuaizhizao.equipmentDashboard.noPendingFaults') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.maintenanceDueTitle')}
            loading={maintenanceLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/maintenance-plans')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={recentMaintenance.slice(0, 6)}
              pagination={false}
              rowKey={(r) => String(r.id ?? r.uuid)}
              columns={maintenanceColumns}
              locale={{ emptyText: t('app.kuaizhizao.equipmentDashboard.noMaintenanceDue') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.spotChecksTitle')}
            loading={spotChecksLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/spot-checks')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={spotChecks.slice(0, 6)}
              pagination={false}
              rowKey={(r) => String(r.id ?? r.uuid)}
              columns={spotCheckColumns}
              locale={{ emptyText: t('app.kuaizhizao.equipmentDashboard.noSpotChecks') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.spareLowStockTitle')}
            loading={spareAlertsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/spare-parts')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={spareAlerts.slice(0, 6)}
              pagination={false}
              rowKey={(r, idx) => String(r.id ?? r.spare_part_id ?? idx)}
              columns={spareAlertColumns}
              locale={{ emptyText: t('app.kuaizhizao.equipmentDashboard.noSpareAlerts') }}
            />
          </ModuleActionPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.statusDistributionTitle')}
          >
            <ModuleChartMount height={240}>
              {({ width, height }) => (
                <Suspense fallback={null}>
                  <EquipmentStatusPie
                    data={statusPieData}
                    angleField="value"
                    colorField="type"
                    radius={0.75}
                    innerRadius={0.55}
                    width={width}
                    height={height}
                    autoFit={false}
                    animation={false}
                    legend={{ color: { position: 'bottom' } }}
                  />
                </Suspense>
              )}
            </ModuleChartMount>
          </ModuleChartPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.equipmentDashboard.faultTrendTitle')}
            loading={trendLoading}
          >
            <ModuleChartMount height={240}>
              {({ width, height }) => (
                <Suspense fallback={null}>
                  <EquipmentTrendColumn
                    data={trendData?.items || []}
                    xField="date"
                    yField="count"
                    width={width}
                    height={height}
                    autoFit={false}
                    animation={false}
                  />
                </Suspense>
              )}
            </ModuleChartMount>
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default EquipmentDashboard;
