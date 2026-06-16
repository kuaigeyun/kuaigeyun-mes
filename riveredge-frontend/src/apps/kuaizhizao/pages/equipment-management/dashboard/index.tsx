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
import { equipmentFaultApi, maintenancePlanApi } from '../../../services/equipment';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
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

const EquipmentTrendColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

const EquipmentStatusPie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

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
    return Array.isArray(res) ? res : res?.items || [];
  }, 'kz:equipment-dashboard:faults');
  const { data: recentMaintenanceResult, loading: maintenanceLoading } = useDashboardRequest(async () => {
    const res = await maintenancePlanApi.list({ limit: 6 });
    return Array.isArray(res) ? res : res?.items || [];
  }, 'kz:equipment-dashboard:maintenance');
  const { data: trendData, loading: trendLoading } = useDashboardRequest(
    mesDashboardService.getEquipmentTrend,
    'kz:equipment-dashboard:trend',
  );

  const s = summary as Record<string, number> | undefined;
  const recentFaults = recentFaultsResult || [];
  const recentMaintenance = recentMaintenanceResult || [];
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
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/faults?status=维修中'),
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
        onClick: () => navigate('/apps/kuaizhizao/equipment-management/list'),
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
        path: '/apps/kuaizhizao/equipment-management/list',
      },
      {
        key: 'maint',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.maintenance'),
        icon: <CalendarOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaizhizao/equipment-management/maintenance',
      },
      {
        key: 'fault',
        title: t('app.kuaizhizao.equipmentDashboard.shortcut.fault'),
        icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
        path: '/apps/kuaizhizao/equipment-management/faults',
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
        render: (text: string, record: { uuid?: string }) => (
          <a onClick={() => navigate(`/apps/kuaizhizao/equipment-management/faults/${record.uuid}`)}>
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
        dataIndex: 'name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.equipmentDashboard.colNextPlanDate'),
        dataIndex: 'next_execution_date',
        width: 100,
        render: (value: string) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value || '—'}
          </Text>
        ),
      },
    ],
    [t],
  );

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <>
          <ModuleActionPanel
            title={t('app.kuaizhizao.equipmentDashboard.todosTitle')}
            lg={8}
            loading={todosLoading}
          >
            <ModuleTodoList
              items={todos}
              emptyText={t('app.kuaizhizao.equipmentDashboard.noTodos')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title={t('app.kuaizhizao.equipmentDashboard.pendingFaultsTitle')}
            lg={8}
            loading={faultsLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/faults')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={recentFaults
                .filter(
                  (f: { status?: string }) =>
                    !String(f.status).includes('完成') && !String(f.status).includes('fixed'),
                )
                .slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={faultColumns}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title={t('app.kuaizhizao.equipmentDashboard.maintenanceDueTitle')}
            lg={8}
            loading={maintenanceLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/equipment-management/maintenance')}>
                {t('app.kuaizhizao.equipmentDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={recentMaintenance.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={maintenanceColumns}
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel title={t('app.kuaizhizao.equipmentDashboard.statusDistributionTitle')} lg={10}>
            <Suspense fallback={null}>
              <EquipmentStatusPie
                data={statusPieData}
                angleField="value"
                colorField="type"
                radius={0.8}
                height={240}
              />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel
            title={t('app.kuaizhizao.equipmentDashboard.faultTrendTitle')}
            loading={trendLoading}
            lg={14}
          >
            <Suspense fallback={null}>
              <EquipmentTrendColumn
                data={trendData?.items || []}
                xField="date"
                yField="count"
                height={240}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default EquipmentDashboard;
