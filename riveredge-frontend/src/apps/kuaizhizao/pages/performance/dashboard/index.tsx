import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
  BarChartOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { mesDashboardService } from '../../../services/dashboard';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const PerformanceCenterDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: summary, loading } = useDashboardRequest(
    mesDashboardService.getPerformanceSummary,
    'kz:performance-dashboard:summary',
  );
  const s = summary as Record<string, number> | undefined;

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: t('app.kuaizhizao.performance.dashboard.kpi.pending'),
        value: s?.pending_summaries ?? 0,
        subtitle: t('app.kuaizhizao.performance.dashboard.kpi.pendingSubtitle'),
        icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/summaries'),
      },
      {
        key: 'confirmed',
        title: t('app.kuaizhizao.performance.dashboard.kpi.confirmed'),
        value: s?.confirmed_summaries ?? 0,
        subtitle: t('app.kuaizhizao.performance.dashboard.kpi.confirmedSubtitle'),
        icon: <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/summaries'),
      },
      {
        key: 'skills',
        title: t('app.kuaizhizao.performance.dashboard.kpi.skills'),
        value: s?.skill_records ?? 0,
        subtitle: t('app.kuaizhizao.performance.dashboard.kpi.skillsSubtitle'),
        icon: <TeamOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/skills'),
      },
    ],
    [navigate, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'summary',
        title: t('app.kuaizhizao.menu.performance-management.summaries'),
        icon: <BarChartOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaizhizao/performance/summaries',
      },
      {
        key: 'holiday',
        title: t('app.kuaizhizao.menu.performance-management.holidays'),
        icon: <CalendarOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaizhizao/performance/holidays',
      },
      {
        key: 'shift-rosters',
        title: t('app.kuaizhizao.menu.performance-management.shift-rosters'),
        icon: <CalendarOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
        path: '/apps/kuaizhizao/performance/shift-rosters',
      },
      {
        key: 'shifts',
        title: t('app.kuaizhizao.menu.performance-management.shifts'),
        icon: <TeamOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaizhizao/performance/shifts',
      },
      {
        key: 'employee',
        title: t('app.kuaizhizao.menu.performance-management.employee-configs'),
        icon: <UserOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
        path: '/apps/kuaizhizao/performance/employee-configs',
      },
    ],
    [t],
  );

  const pendingCount = s?.pending_summaries ?? 0;

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <ModuleActionPanel title={t('app.kuaizhizao.performance.dashboard.todoPanel')} lg={24}>
          <ModuleTodoList
            items={
              pendingCount > 0
                ? [
                    {
                      id: 'perf-pending',
                      type: 'performance',
                      title: t('app.kuaizhizao.performance.dashboard.todoTitle', { count: pendingCount }),
                      priority: 'medium',
                      status: 'pending',
                      link: '/apps/kuaizhizao/performance/summaries',
                      created_at: new Date().toISOString(),
                    },
                  ]
                : []
            }
            emptyText={t('app.kuaizhizao.performance.common.empty.noTodos')}
          />
        </ModuleActionPanel>
      }
    />
  );
};

export default PerformanceCenterDashboard;
