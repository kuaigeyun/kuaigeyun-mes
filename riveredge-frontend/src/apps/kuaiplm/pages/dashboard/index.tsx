/**

 * 快研发 — 研发看板

 * 布局参考快制造模块中心：指标卡 + 快捷入口 + 常用操作 + 项目进度甘特图

 */



import React, { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { Table, Tag, theme } from 'antd';

import {

  ProjectOutlined,

  SwapOutlined,

  BookOutlined,

  ClockCircleOutlined,

  ExperimentOutlined,

  FileSearchOutlined,

  AuditOutlined,

  ApartmentOutlined,

} from '@ant-design/icons';

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import dayjs from 'dayjs';

import {

  ModuleCenterLayout,

  ModuleKpiRow,

  ModuleShortcutGrid,

  ModuleActionPanel,

  ModuleChartPanel,

  ModuleChartRow,

} from '../../../kuaizhizao/components/module-center';

import type { ModuleKpiDef, ModuleShortcutDef } from '../../../kuaizhizao/components/module-center';

import { getDashboardSummary, type MyTaskItem } from '../../services/dashboard';

import { listUnifiedChanges } from '../../services/change-desk';

import RdProjectGanttChart from '../../components/RdProjectGanttChart';
import { formatDateTime } from '../../../../utils/format';
import {
  getKuaiplmChangeCategoryText,
  getKuaiplmProjectStatusText,
  getKuaiplmTaskStatusText,
} from '../../components/kuaiplmMeta';



const PROJECT_STATUS_COLOR: Record<string, string> = {

  IN_PROGRESS: 'processing',

  DRAFT: 'default',

  ON_HOLD: 'warning',

  COMPLETED: 'success',

  CANCELLED: 'error',

};



const KuaiplmDashboard: React.FC = () => {

  const { t } = useTranslation();
  const navigate = useNavigate();

  const { token } = theme.useToken();



  const { data, isLoading } = useQuery({

    queryKey: ['kuaiplm-dashboard-summary'],

    queryFn: getDashboardSummary,

  });



  const { data: pendingChanges, isLoading: changesLoading } = useQuery({

    queryKey: ['kuaiplm-dashboard-pending-changes'],

    queryFn: () => listUnifiedChanges({ status: 'pending', limit: 6 }),

  });



  const progressByProjectId = useMemo(() => {
    const map = new Map<number, number>();
    (data?.project_gantt ?? []).forEach((p) => {
      if (p.id != null) map.set(p.id, Math.round(Number(p.progress ?? 0)));
    });
    return map;
  }, [data?.project_gantt]);

  const myTasks = useMemo(() => (data?.my_tasks ?? []).slice(0, 6), [data?.my_tasks]);

  const activeProjects = useMemo(() => {
    const items = data?.recent_projects ?? [];

    const active = items.filter((p) => {

      const status = String(p.status ?? '').toUpperCase();

      return status === 'IN_PROGRESS' || status === 'DRAFT' || status === 'ON_HOLD';

    });

    return (active.length > 0 ? active : items).slice(0, 6);

  }, [data?.recent_projects]);



  const kpis: ModuleKpiDef[] = useMemo(

    () => [

      {

        key: 'projects',

        title: t('app.kuaiplm.dashboard.kpi.activeProjects'),

        value: data?.project_in_progress ?? 0,

        subtitle: t('app.kuaiplm.dashboard.kpi.activeProjectsSubtitle', {
          total: data?.project_total ?? 0,
          rd: data?.project_rd_total ?? 0,
          delivery: data?.project_delivery_total ?? 0,
        }),

        icon: <ProjectOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',

        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/rd-projects'),

        sideMetrics: [

          { label: t('app.kuaiplm.dashboard.kpi.onHold'), value: data?.project_on_hold ?? 0 },

          { label: t('app.kuaiplm.dashboard.kpi.pendingGates'), value: data?.pending_gate_reviews ?? 0 },

        ],

      },

      {

        key: 'changes',

        title: t('app.kuaiplm.dashboard.kpi.pendingChanges'),

        value: (data?.pending_bom_changes ?? 0) + (data?.pending_route_changes ?? 0),

        subtitle: t('app.kuaiplm.dashboard.kpi.pendingChangesSubtitle'),

        icon: <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',

        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/change-management'),

        sideMetrics: [

          { label: t('app.kuaiplm.common.changeCategory.bom'), value: data?.pending_bom_changes ?? 0 },

          { label: t('app.kuaiplm.dashboard.kpi.route'), value: data?.pending_route_changes ?? 0 },

        ],

      },

      {

        key: 'tasks',

        title: t('app.kuaiplm.dashboard.kpi.collaborationTodos'),

        value: data?.open_tasks ?? 0,

        subtitle: t('app.kuaiplm.dashboard.kpi.collaborationSubtitle', {
          articles: data?.kb_article_total ?? 0,
          reviews: data?.design_review_pending ?? 0,
        }),

        icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)',

        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/phase2/requirements'),

        sideMetrics: [

          { label: t('app.kuaiplm.dashboard.kpi.requirements'), value: data?.requirement_total ?? 0 },

          { label: t('app.kuaiplm.menu.phase2.fmea'), value: data?.fmea_total ?? 0 },

        ],

      },

    ],

    [data, navigate, t],

  );



  const shortcuts: ModuleShortcutDef[] = useMemo(

    () => [

      {

        key: 'rd-projects',

        title: t('app.kuaiplm.menu.rd-projects'),

        icon: <ProjectOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/rd-projects',

      },

      {

        key: 'change-management',

        title: t('app.kuaiplm.menu.change-management'),

        icon: <SwapOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/change-management',

      },

      {

        key: 'knowledge-base',

        title: t('app.kuaiplm.menu.knowledge-center'),

        icon: <BookOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/knowledge-base',

      },

      {

        key: 'engineering-bom',

        title: t('app.kuaiplm.dashboard.shortcut.engineeringBom'),

        icon: <ApartmentOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/master-data/process/engineering-bom',

      },

      {

        key: 'requirements',

        title: t('app.kuaiplm.menu.phase2.requirements'),

        icon: <FileSearchOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/phase2/requirements',

      },

      {

        key: 'design-reviews',

        title: t('app.kuaiplm.menu.phase2.design-reviews'),

        icon: <AuditOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/phase2/design-reviews',

      },

    ],

    [token.colorPrimary, t],

  );



  return (

    <ModuleCenterLayout

      loading={isLoading && !data}

      kpiRow={<ModuleKpiRow items={kpis} />}

      shortcutRow={

        <ModuleShortcutGrid items={shortcuts} colProps={{ xs: 12, sm: 8, md: 8, lg: 4 }} />

      }

      actionRow={

        <>

          <ModuleActionPanel

            title={t('app.kuaiplm.dashboard.panel.activeProjects')}

            lg={8}

            loading={isLoading}

            extra={
              <a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>
                {t('app.kuaiplm.common.actions.viewAll')}
              </a>
            }

          >

            <Table

              size="small"

              dataSource={activeProjects}

              pagination={false}

              rowKey="id"

              locale={{ emptyText: t('app.kuaiplm.dashboard.empty.activeProjects') }}

              columns={[

                {

                  title: t('app.kuaiplm.common.columns.project'),

                  dataIndex: 'project_code',

                  ellipsis: true,

                  render: (code, record) => (

                    <a onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${record.id}`)}>

                      {[code, record.project_name].filter(Boolean).join(' · ') || `#${record.id}`}

                    </a>

                  ),

                },

                {

                  title: t('app.kuaiplm.common.columns.currentGate'),

                  dataIndex: 'current_gate_name',

                  width: 88,

                  ellipsis: true,

                  render: (name) => name || '—',

                },

                {

                  title: t('app.kuaiplm.common.columns.progress'),

                  width: 56,

                  render: (_, record) => {

                    const pct = progressByProjectId.get(record.id);

                    return pct != null ? `${pct}%` : '—';

                  },

                },

                {

                  title: t('app.kuaiplm.common.columns.status'),

                  dataIndex: 'status',

                  width: 72,

                  render: (status, record) => (

                    <Tag color={PROJECT_STATUS_COLOR[String(status ?? '').toUpperCase()] ?? 'default'}>

                      {getKuaiplmProjectStatusText(t, status)}

                    </Tag>

                  ),

                },

              ]}

            />

          </ModuleActionPanel>

          <ModuleActionPanel

            title={t('app.kuaiplm.dashboard.panel.pendingChanges')}

            lg={8}

            loading={changesLoading}

            extra={
              <a onClick={() => navigate('/apps/kuaiplm/change-management')}>
                {t('app.kuaiplm.common.actions.viewAll')}
              </a>
            }

          >

            <Table

              size="small"

              dataSource={(pendingChanges?.items ?? []).slice(0, 6)}

              pagination={false}

              rowKey={(row) => `${row.change_category}-${row.uuid ?? row.id}`}

              locale={{ emptyText: t('app.kuaiplm.dashboard.empty.pendingChanges') }}

              columns={[

                {

                  title: t('app.kuaiplm.dashboard.panel.changeTarget'),

                  dataIndex: 'target_name',

                  ellipsis: true,

                  render: (name, record) => (

                    <a onClick={() => navigate('/apps/kuaiplm/change-management')}>

                      {name || record.change_code || '—'}

                    </a>

                  ),

                },

                {

                  title: t('app.kuaiplm.common.columns.type'),

                  dataIndex: 'change_category',

                  width: 88,

                  render: (category) => (

                    <Tag color={category === 'bom' ? 'blue' : 'purple'}>

                      {getKuaiplmChangeCategoryText(t, category)}

                    </Tag>

                  ),

                },

                {

                  title: t('app.kuaiplm.common.columns.createdAt'),

                  dataIndex: 'created_at',

                  width: 96,

                  render: (val) => (val ? formatDateTime(val, 'MM-DD') : '—'),

                },

              ]}

            />

          </ModuleActionPanel>

          <ModuleActionPanel
            title={t('app.kuaiplm.dashboard.panel.myTasks')}
            lg={8}
            loading={isLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>
                {t('app.kuaiplm.common.actions.allProjects')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={myTasks}
              pagination={false}
              rowKey="id"
              locale={{ emptyText: t('app.kuaiplm.dashboard.empty.myTasks') }}
              columns={[
                {
                  title: t('app.kuaiplm.common.columns.task'),
                  dataIndex: 'task_name',
                  ellipsis: true,
                  render: (name, record: MyTaskItem) => (
                    <a
                      onClick={() =>
                        navigate(`/apps/kuaiplm/rd-projects/detail/${record.project_id}`)
                      }
                    >
                      {name || '—'}
                    </a>
                  ),
                },
                {
                  title: t('app.kuaiplm.common.columns.project'),
                  dataIndex: 'project_code',
                  width: 96,
                  ellipsis: true,
                  render: (code, record: MyTaskItem) => code || record.project_name || '—',
                },
                {
                  title: t('app.kuaiplm.common.columns.gate'),
                  dataIndex: 'gate_name',
                  width: 80,
                  ellipsis: true,
                  render: (name) => name || '—',
                },
                {
                  title: t('app.kuaiplm.common.columns.status'),
                  dataIndex: 'status',
                  width: 72,
                  render: (status) => getKuaiplmTaskStatusText(t, status),
                },
                {
                  title: t('app.kuaiplm.common.columns.dueDate'),
                  dataIndex: 'due_date',
                  width: 72,
                  render: (val) => (val ? formatDateTime(val, 'MM-DD') : '—'),
                },
              ]}
            />
          </ModuleActionPanel>
        </>

      }

      chartRow={

        <ModuleChartRow>

          <ModuleChartPanel

            title={

              <span>

                <ExperimentOutlined style={{ marginRight: 8 }} />

                {t('app.kuaiplm.dashboard.chart.ganttTitle')}

              </span>

            }

            extra={
              <a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>
                {t('app.kuaiplm.common.actions.manageProjects')}
              </a>
            }

            loading={isLoading}

            height={560}

            lg={24}

          >

            <RdProjectGanttChart items={data?.project_gantt ?? []} />

          </ModuleChartPanel>

        </ModuleChartRow>

      }

    />

  );

};



export default KuaiplmDashboard;

