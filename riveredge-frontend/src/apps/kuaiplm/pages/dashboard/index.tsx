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
import { TASK_STATUS_LABELS } from '../../services/rd-project';

import { listUnifiedChanges } from '../../services/change-desk';

import RdProjectGanttChart from '../../components/RdProjectGanttChart';



const PROJECT_STATUS_COLOR: Record<string, string> = {

  IN_PROGRESS: 'processing',

  DRAFT: 'default',

  ON_HOLD: 'warning',

  COMPLETED: 'success',

  CANCELLED: 'error',

};



const CHANGE_CATEGORY_LABEL: Record<string, string> = {

  bom: 'BOM',

  route: '工艺路线',

};



const KuaiplmDashboard: React.FC = () => {

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

        title: '在研项目',

        value: data?.project_in_progress ?? 0,

        subtitle: `全部 ${data?.project_total ?? 0} · 研发 ${data?.project_rd_total ?? 0} · 交付 ${data?.project_delivery_total ?? 0}`,

        icon: <ProjectOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',

        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/rd-projects'),

        sideMetrics: [

          { label: '暂停', value: data?.project_on_hold ?? 0 },

          { label: '待审门', value: data?.pending_gate_reviews ?? 0 },

        ],

      },

      {

        key: 'changes',

        title: '设计变更待办',

        value: (data?.pending_bom_changes ?? 0) + (data?.pending_route_changes ?? 0),

        subtitle: 'BOM 与工艺路线变更待审批/执行',

        icon: <SwapOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',

        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/change-management'),

        sideMetrics: [

          { label: 'BOM', value: data?.pending_bom_changes ?? 0 },

          { label: '工艺', value: data?.pending_route_changes ?? 0 },

        ],

      },

      {

        key: 'tasks',

        title: '协同待办',

        value: data?.open_tasks ?? 0,

        subtitle: `知识文章 ${data?.kb_article_total ?? 0} · 设计评审 ${data?.design_review_pending ?? 0}`,

        icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,

        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)',

        boxShadow: '0 4px 12px rgba(14, 165, 233, 0.18)',

        onClick: () => navigate('/apps/kuaiplm/phase2/requirements'),

        sideMetrics: [

          { label: '需求', value: data?.requirement_total ?? 0 },

          { label: 'FMEA', value: data?.fmea_total ?? 0 },

        ],

      },

    ],

    [data, navigate],

  );



  const shortcuts: ModuleShortcutDef[] = useMemo(

    () => [

      {

        key: 'rd-projects',

        title: '项目管理',

        icon: <ProjectOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/rd-projects',

      },

      {

        key: 'change-management',

        title: '设计变更',

        icon: <SwapOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/change-management',

      },

      {

        key: 'knowledge-base',

        title: '知识中心',

        icon: <BookOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/knowledge-base',

      },

      {

        key: 'engineering-bom',

        title: '工程 BOM',

        icon: <ApartmentOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/master-data/process/engineering-bom',

      },

      {

        key: 'requirements',

        title: '研发需求',

        icon: <FileSearchOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/phase2/requirements',

      },

      {

        key: 'design-reviews',

        title: '设计评审',

        icon: <AuditOutlined style={{ fontSize: 20, color: token.colorPrimary }} />,

        path: '/apps/kuaiplm/phase2/design-reviews',

      },

    ],

    [token.colorPrimary],

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

            title="在研项目"

            lg={8}

            loading={isLoading}

            extra={<a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>全部</a>}

          >

            <Table

              size="small"

              dataSource={activeProjects}

              pagination={false}

              rowKey="id"

              locale={{ emptyText: '暂无在研项目，可前往研发项目创建 NPI 项目' }}

              columns={[

                {

                  title: '项目',

                  dataIndex: 'project_code',

                  ellipsis: true,

                  render: (code, record) => (

                    <a onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${record.id}`)}>

                      {[code, record.project_name].filter(Boolean).join(' · ') || `#${record.id}`}

                    </a>

                  ),

                },

                {

                  title: '阶段门',

                  dataIndex: 'current_gate_name',

                  width: 88,

                  ellipsis: true,

                  render: (name) => name || '—',

                },

                {

                  title: '进度',

                  width: 56,

                  render: (_, record) => {

                    const pct = progressByProjectId.get(record.id);

                    return pct != null ? `${pct}%` : '—';

                  },

                },

                {

                  title: '状态',

                  dataIndex: 'status',

                  width: 72,

                  render: (status, record) => (

                    <Tag color={PROJECT_STATUS_COLOR[String(status ?? '').toUpperCase()] ?? 'default'}>

                      {record.status_label ?? status ?? '—'}

                    </Tag>

                  ),

                },

              ]}

            />

          </ModuleActionPanel>

          <ModuleActionPanel

            title="设计变更待办"

            lg={8}

            loading={changesLoading}

            extra={<a onClick={() => navigate('/apps/kuaiplm/change-management')}>全部</a>}

          >

            <Table

              size="small"

              dataSource={(pendingChanges?.items ?? []).slice(0, 6)}

              pagination={false}

              rowKey={(row) => `${row.change_category}-${row.uuid ?? row.id}`}

              locale={{ emptyText: '暂无待处理的设计变更' }}

              columns={[

                {

                  title: '变更对象',

                  dataIndex: 'target_name',

                  ellipsis: true,

                  render: (name, record) => (

                    <a onClick={() => navigate('/apps/kuaiplm/change-management')}>

                      {name || record.change_code || '—'}

                    </a>

                  ),

                },

                {

                  title: '类型',

                  dataIndex: 'change_category',

                  width: 88,

                  render: (category) => (

                    <Tag color={category === 'bom' ? 'blue' : 'purple'}>

                      {CHANGE_CATEGORY_LABEL[String(category)] ?? category}

                    </Tag>

                  ),

                },

                {

                  title: '提交时间',

                  dataIndex: 'created_at',

                  width: 96,

                  render: (val) => (val ? dayjs(val).format('MM-DD') : '—'),

                },

              ]}

            />

          </ModuleActionPanel>

          <ModuleActionPanel
            title="我的待办任务"
            lg={8}
            loading={isLoading}
            extra={<a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>全部项目</a>}
          >
            <Table
              size="small"
              dataSource={myTasks}
              pagination={false}
              rowKey="id"
              locale={{ emptyText: '暂无指派给您的待办任务' }}
              columns={[
                {
                  title: '任务',
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
                  title: '项目',
                  dataIndex: 'project_code',
                  width: 96,
                  ellipsis: true,
                  render: (code, record: MyTaskItem) => code || record.project_name || '—',
                },
                {
                  title: '阶段门',
                  dataIndex: 'gate_name',
                  width: 80,
                  ellipsis: true,
                  render: (name) => name || '—',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 72,
                  render: (status) => TASK_STATUS_LABELS[String(status)] ?? status ?? '—',
                },
                {
                  title: '截止',
                  dataIndex: 'due_date',
                  width: 72,
                  render: (val) => (val ? dayjs(val).format('MM-DD') : '—'),
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

                项目进度甘特图

              </span>

            }

            extra={<a onClick={() => navigate('/apps/kuaiplm/rd-projects')}>管理项目</a>}

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

