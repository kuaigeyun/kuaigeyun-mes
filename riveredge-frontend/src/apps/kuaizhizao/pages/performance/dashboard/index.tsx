import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import {
  TeamOutlined,
  CalendarOutlined,
  TrophyOutlined,
  BarChartOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { mesDashboardService } from '../../../services/dashboard';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const PerformanceCenterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, loading } = useRequest(mesDashboardService.getPerformanceSummary);
  const s = summary as Record<string, number> | undefined;

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: '待确认绩效',
        value: s?.pending_summaries ?? 0,
        subtitle: '草稿/已计算待确认',
        icon: <FileTextOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/summaries'),
      },
      {
        key: 'confirmed',
        title: '已确认汇总',
        value: s?.confirmed_summaries ?? 0,
        subtitle: '可用于薪资结算',
        icon: <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/summaries'),
      },
      {
        key: 'skills',
        title: '技能配置',
        value: s?.skill_records ?? 0,
        subtitle: '员工技能矩阵条目',
        icon: <TeamOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        onClick: () => navigate('/apps/kuaizhizao/performance/skills'),
      },
    ],
    [navigate, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'summary', title: '绩效汇总', icon: <BarChartOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaizhizao/performance/summaries' },
    { key: 'piece', title: '计件单价', icon: <TrophyOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaizhizao/performance/piece-rates' },
    { key: 'holiday', title: '节假日', icon: <CalendarOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/performance/holidays' },
    { key: 'employee', title: '员工配置', icon: <UserOutlined style={{ fontSize: 22, color: '#722ed1' }} />, path: '/apps/kuaizhizao/performance/employee-configs' },
  ];

  return (
    <ModuleCenterLayout
      loading={loading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <ModuleActionPanel title="绩效待办" lg={24}>
          <ModuleTodoList
            items={
              (s?.pending_summaries ?? 0) > 0
                ? [
                    {
                      id: 'perf-pending',
                      type: 'performance',
                      title: `${s?.pending_summaries} 条绩效汇总待确认`,
                      priority: 'medium',
                      status: 'pending',
                      link: '/apps/kuaizhizao/performance/summaries',
                      created_at: new Date().toISOString(),
                    },
                  ]
                : []
            }
            emptyText="暂无绩效待办"
          />
        </ModuleActionPanel>
      }
    />
  );
};

export default PerformanceCenterDashboard;
