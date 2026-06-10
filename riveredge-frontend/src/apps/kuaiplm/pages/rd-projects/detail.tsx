/**
 * 研发项目工作台：按 NPI 阶段门分区，任务 / 交付物 / 工程链接 / 协同事项
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  DeleteOutlined,
  AuditOutlined,
  FileSearchOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import {
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import {
  getRdProjectWorkbench,
  pushTrialWorkOrder,
  spawnDeliveryProject,
  updateRdProject,
  createRdProjectLink,
  deleteRdProjectLink,
  createRdProjectTask,
  updateRdProjectTask,
  deleteRdProjectTask,
  createRdProjectDeliverable,
  updateRdProjectDeliverable,
  deleteRdProjectDeliverable,
  updateRdProjectGate,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  TASK_STATUS_LABELS,
  DELIVERABLE_STATUS_LABELS,
  GATE_STATUS_LABELS,
  type RdProjectWorkbench,
  type RdProjectGate,
  type RdProjectTask,
  type RdProjectLink,
  type RdProjectDeliverable,
  type ProjectType,
} from '../../services/rd-project';
import {
  ENGINEERING_LINK_TYPE_LABELS,
  openMasterDataInNewTab,
  type EngineeringLinkType,
} from '../../services/master-data-links';
import { RdProjectGateStepper } from '../../components/RdProjectGateStepper';
import { UniUserSelect } from '../../../../components/uni-user-select';
import { resolveUserDisplay } from '../../../../services/user';
import './detail.less';

const GATE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  PASSED: 'success',
  FAILED: 'error',
  SKIPPED: 'default',
};

const DELIVERABLE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

const TASK_STATUS_COLOR: Record<string, string> = {
  TODO: 'default',
  IN_PROGRESS: 'processing',
  DONE: 'success',
  CANCELLED: 'default',
};

function buildTaskRows(tasks: RdProjectTask[]) {
  const roots = tasks
    .filter((t) => !t.parent_task_id)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const childrenByParent = new Map<number, RdProjectTask[]>();
  tasks
    .filter((t) => t.parent_task_id)
    .forEach((t) => {
      const pid = t.parent_task_id!;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(t);
    });
  const rows: Array<{ task: RdProjectTask; isChild: boolean }> = [];
  for (const root of roots) {
    rows.push({ task: root, isChild: false });
    for (const child of childrenByParent.get(root.id!) ?? []) {
      rows.push({ task: child, isChild: true });
    }
  }
  const shown = new Set(rows.map((r) => r.task.id));
  tasks
    .filter((t) => t.parent_task_id && !shown.has(t.id))
    .forEach((t) => rows.push({ task: t, isChild: true }));
  return rows;
}

const RdProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [workbench, setWorkbench] = useState<RdProjectWorkbench | null>(null);
  const [activeGateKey, setActiveGateKey] = useState<string>();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RdProjectTask | null>(null);
  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<RdProjectDeliverable | null>(null);
  const [gateEditOpen, setGateEditOpen] = useState(false);
  const [editingGate, setEditingGate] = useState<RdProjectGate | null>(null);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushQty, setPushQty] = useState(1);
  const [pushNotes, setPushNotes] = useState('');
  const [pushing, setPushing] = useState(false);
  const linkFormRef = React.useRef<any>(null);
  const taskFormRef = React.useRef<any>(null);
  const deliverableFormRef = React.useRef<any>(null);
  const gateFormRef = React.useRef<any>(null);
  const selectedReviewerRef = React.useRef<{ id: number; name: string } | null>(null);

  const openGateEdit = async (gate: RdProjectGate) => {
    setEditingGate(gate);
    setGateEditOpen(true);
    selectedReviewerRef.current =
      gate.reviewer_id != null
        ? { id: gate.reviewer_id, name: gate.reviewer_name || '' }
        : null;

    let reviewerUuid: string | undefined;
    if (gate.reviewer_id != null || gate.reviewer_name) {
      try {
        if (gate.reviewer_id != null) {
          const resolved = await resolveUserDisplay({ user_ids: [gate.reviewer_id] });
          const user = resolved[0];
          reviewerUuid = user?.uuid;
          if (user) {
            selectedReviewerRef.current = {
              id: user.id,
              name: user.label || user.full_name || user.username || '',
            };
          }
        }
      } catch {
        // 保留 gate 快照，下拉仍可重新选择
      }
    }

    setTimeout(() => {
      gateFormRef.current?.setFieldsValue({
        planned_date: gate.planned_date ? dayjs(gate.planned_date) : undefined,
        actual_date: gate.actual_date ? dayjs(gate.actual_date) : undefined,
        reviewer_uuid: reviewerUuid,
        criteria: gate.criteria,
        review_notes: gate.review_notes,
      });
    }, 0);
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getRdProjectWorkbench(id);
      setWorkbench(data);
    } catch (e: any) {
      messageApi.error(e?.message || '加载项目工作台失败');
      setWorkbench(null);
    } finally {
      setLoading(false);
    }
  }, [id, messageApi]);

  useEffect(() => {
    load();
  }, [load]);

  const project = workbench?.project;

  useEffect(() => {
    const code = project?.project_code?.trim();
    if (!code) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: code },
      }),
    );
  }, [project?.project_code, location.pathname, location.search]);

  const gates = useMemo(
    () => [...(workbench?.gates ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [workbench?.gates],
  );
  const tasks = workbench?.tasks ?? [];
  const deliverables = workbench?.deliverables ?? [];
  const links = workbench?.links ?? [];
  const articles = workbench?.related_articles ?? [];
  const progress = workbench?.progress ?? 0;
  const collaboration = workbench?.collaboration ?? {};

  useEffect(() => {
    if (gates.length === 0) return;
    if (activeGateKey && gates.some((g) => g.gate_key === activeGateKey)) return;
    const current = gates.find((g) => g.gate_key === project?.current_gate_key);
    const firstOpen = gates.find((g) => g.status !== 'PASSED' && g.status !== 'SKIPPED');
    setActiveGateKey(current?.gate_key ?? firstOpen?.gate_key ?? gates[0].gate_key);
  }, [gates, project?.current_gate_key, activeGateKey]);

  const activeGate = gates.find((g) => g.gate_key === activeGateKey);

  const openCreateTask = (gate: RdProjectGate) => {
    setEditingTask(null);
    setActiveGateKey(gate.gate_key);
    setTaskModalOpen(true);
    setTimeout(() => {
      taskFormRef.current?.resetFields();
      taskFormRef.current?.setFieldsValue({ gate_id: gate.id, status: 'TODO' });
    }, 0);
  };

  const openEditTask = (task: RdProjectTask) => {
    setEditingTask(task);
    setTaskModalOpen(true);
    setTimeout(() => {
      taskFormRef.current?.setFieldsValue({
        ...task,
        due_date: task.due_date ? dayjs(task.due_date) : undefined,
      });
    }, 0);
  };

  const openCreateDeliverable = (gate: RdProjectGate) => {
    setEditingDeliverable(null);
    setActiveGateKey(gate.gate_key);
    setDeliverableModalOpen(true);
    setTimeout(() => {
      deliverableFormRef.current?.resetFields();
      deliverableFormRef.current?.setFieldsValue({ gate_id: gate.id, status: 'PENDING' });
    }, 0);
  };

  const openEditDeliverable = (item: RdProjectDeliverable) => {
    setEditingDeliverable(item);
    setDeliverableModalOpen(true);
    setTimeout(() => {
      deliverableFormRef.current?.setFieldsValue(item);
    }, 0);
  };

  const handlePassGate = (gate: RdProjectGate) => {
    if (!id || !gate.id) return;
    modalApi.confirm({
      title: `确认通过阶段门「${gate.gate_name}」？`,
      content: '若存在未批准的阻塞交付物，将无法通过。',
      onOk: async () => {
        try {
          await updateRdProjectGate(id, gate.id!, {
            status: 'PASSED',
            actual_date: dayjs().format('YYYY-MM-DD'),
          });
          messageApi.success('阶段门已通过');
          load();
        } catch (e: any) {
          messageApi.error(e?.message || '阶段门更新失败');
          throw e;
        }
      },
    });
  };

  const parentTaskOptions = useMemo(() => {
    if (!activeGate?.id) return [];
    return tasks
      .filter((t) => t.gate_id === activeGate.id && !t.parent_task_id && t.id !== editingTask?.id)
      .map((t) => ({ value: t.id, label: t.task_name }));
  }, [tasks, activeGate?.id, editingTask?.id]);

  const linkColumns = [
    {
      title: '类型',
      dataIndex: 'link_type',
      width: 100,
      render: (t: string) => ENGINEERING_LINK_TYPE_LABELS[t as EngineeringLinkType] ?? t,
    },
    { title: '名称', dataIndex: 'target_name', ellipsis: true },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, row: RdProjectLink) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() =>
              openMasterDataInNewTab({
                link_type: (row.link_type ?? 'material') as EngineeringLinkType,
                target_uuid: row.target_uuid ?? undefined,
                target_id: row.target_id ?? undefined,
                version: row.version ?? undefined,
                material_id: row.material_id ?? undefined,
              })
            }
          >
            打开
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              modalApi.confirm({
                title: '删除此工程链接？',
                onOk: async () => {
                  await deleteRdProjectLink(id!, row.id!);
                  messageApi.success('已删除');
                  load();
                },
              });
            }}
          />
        </Space>
      ),
    },
  ];

  const renderGatePanel = (gate: RdProjectGate) => {
    const gateTasks = tasks.filter((t) => t.gate_id === gate.id);
    const gateDeliverables = deliverables.filter((d) => d.gate_id === gate.id);
    const taskRows = buildTaskRows(gateTasks);
    const gateStatus = gate.status ?? 'PENDING';

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card
          size="small"
          className="rd-project-gate-section-card"
          title="阶段门信息"
          extra={
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => openGateEdit(gate)}
              >
                编辑
              </Button>
              <Button
                type="primary"
                size="small"
                disabled={gateStatus === 'PASSED' || gateStatus === 'SKIPPED'}
                onClick={() => handlePassGate(gate)}
              >
                通过评审
              </Button>
            </Space>
          }
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label="状态">
              <Tag color={GATE_STATUS_COLOR[gateStatus] ?? 'default'}>
                {GATE_STATUS_LABELS[gateStatus] ?? gateStatus}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="计划日期">
              {gate.planned_date ? dayjs(gate.planned_date).format('YYYY-MM-DD') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="实际日期">
              {gate.actual_date ? dayjs(gate.actual_date).format('YYYY-MM-DD') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="评审人">{gate.reviewer_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="通过准则" span={2}>
              {gate.criteria || '—'}
            </Descriptions.Item>
            {gate.review_notes ? (
              <Descriptions.Item label="评审意见" span={2}>
                {gate.review_notes}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        <Card
          size="small"
          className="rd-project-gate-section-card"
          title={`任务 (${gateTasks.length})`}
          extra={
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreateTask(gate)}>
              新建任务
            </Button>
          }
        >
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '本阶段暂无任务' }}
            dataSource={taskRows.map((r) => r.task)}
            columns={[
              {
                title: '任务',
                dataIndex: 'task_name',
                render: (name: string, row: RdProjectTask) => {
                  const isChild = taskRows.find((r) => r.task.id === row.id)?.isChild;
                  return (
                    <span style={{ paddingLeft: isChild ? 20 : 0 }}>
                      {isChild ? '↳ ' : ''}
                      {name}
                    </span>
                  );
                },
              },
              {
                title: '负责人',
                dataIndex: 'assignee_name',
                width: 100,
                render: (v) => v || '—',
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 88,
                render: (s: string) => (
                  <Tag color={TASK_STATUS_COLOR[s] ?? 'default'}>{TASK_STATUS_LABELS[s] ?? s}</Tag>
                ),
              },
              {
                title: '截止',
                dataIndex: 'due_date',
                width: 108,
                render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—'),
              },
              {
                title: '操作',
                width: 120,
                render: (_: unknown, row: RdProjectTask) => (
                  <Space size="small">
                    <Button type="link" size="small" onClick={() => openEditTask(row)}>
                      编辑
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => {
                        modalApi.confirm({
                          title: '删除任务？',
                          onOk: async () => {
                            await deleteRdProjectTask(id!, row.id!);
                            messageApi.success('已删除');
                            load();
                          },
                        });
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>

        <Card
          size="small"
          className="rd-project-gate-section-card"
          title={`交付物 (${gateDeliverables.length})`}
          extra={
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => openCreateDeliverable(gate)}
            >
              新建交付物
            </Button>
          }
        >
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '本阶段暂无交付物' }}
            dataSource={gateDeliverables}
            columns={[
              { title: '名称', dataIndex: 'name', ellipsis: true },
              {
                title: '类型',
                dataIndex: 'deliverable_type',
                width: 100,
                render: (v) => v || '—',
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 88,
                render: (s: string) => (
                  <Tag color={DELIVERABLE_STATUS_COLOR[s] ?? 'default'}>
                    {DELIVERABLE_STATUS_LABELS[s] ?? s}
                  </Tag>
                ),
              },
              {
                title: '操作',
                width: 220,
                render: (_: unknown, row: RdProjectDeliverable) => (
                  <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                    <Button type="link" size="small" onClick={() => openEditDeliverable(row)}>
                      编辑
                    </Button>
                    {row.status !== 'SUBMITTED' && row.status !== 'APPROVED' ? (
                      <Button
                        type="link"
                        size="small"
                        onClick={async () => {
                          await updateRdProjectDeliverable(id!, row.id!, { status: 'SUBMITTED' });
                          messageApi.success('已标记为已提交');
                          load();
                        }}
                      >
                        提交
                      </Button>
                    ) : null}
                    {row.status !== 'APPROVED' ? (
                      <Button
                        type="link"
                        size="small"
                        onClick={async () => {
                          await updateRdProjectDeliverable(id!, row.id!, { status: 'APPROVED' });
                          messageApi.success('已批准');
                          load();
                        }}
                      >
                        批准
                      </Button>
                    ) : null}
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => {
                        modalApi.confirm({
                          title: '删除交付物？',
                          onOk: async () => {
                            await deleteRdProjectDeliverable(id!, row.id!);
                            messageApi.success('已删除');
                            load();
                          },
                        });
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    );
  };

  if (loading) {
    return (
      <ListPageTemplate>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </ListPageTemplate>
    );
  }

  if (!project) {
    return (
      <ListPageTemplate>
        <Empty description="项目不存在或无权访问">
          <Button onClick={() => navigate('/apps/kuaiplm/rd-projects')}>返回列表</Button>
        </Empty>
      </ListPageTemplate>
    );
  }

  const projectId = project.id ?? id;
  const projectType = (project.project_type ?? 'RD') as ProjectType;
  const isRdProject = projectType === 'RD';
  const releaseGate = gates.find((g) => g.gate_key === 'release');
  const releasePassed = releaseGate?.status === 'PASSED';

  const collaborationItems = isRdProject
    ? [
        {
          key: 'requirements',
          title: '研发需求',
          count: collaboration.requirement_count ?? 0,
          icon: FileSearchOutlined,
          path: `/apps/kuaiplm/phase2/requirements?project_id=${projectId}`,
        },
        {
          key: 'design-reviews',
          title: '设计评审',
          count: collaboration.design_review_count ?? 0,
          icon: AuditOutlined,
          path: `/apps/kuaiplm/phase2/design-reviews?project_id=${projectId}`,
        },
        {
          key: 'fmea',
          title: 'FMEA',
          count: collaboration.fmea_count ?? 0,
          icon: ExperimentOutlined,
          path: `/apps/kuaiplm/phase2/fmea?project_id=${projectId}`,
        },
      ]
    : [];

  return (
    <ListPageTemplate>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps/kuaiplm/rd-projects')}>
            返回列表
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {project.project_code} · {project.project_name}
          </Typography.Title>
          <Tag color={projectType === 'DELIVERY' ? 'blue' : 'purple'}>
            {PROJECT_TYPE_LABELS[projectType]}
          </Tag>
          {project.status ? (
            <Tag color={project.status === 'DRAFT' ? 'default' : 'processing'}>
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </Tag>
          ) : null}
          {projectType === 'DELIVERY' && project.source_project_id ? (
            <Button
              type="link"
              size="small"
              onClick={() =>
                navigate(`/apps/kuaiplm/rd-projects/detail/${project.source_project_id}`)
              }
            >
              来源研发：{project.source_project_code ?? `#${project.source_project_id}`}
            </Button>
          ) : null}
          {project.status === 'DRAFT' ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                modalApi.confirm({
                  title: '启动项目？',
                  content:
                    '启动后项目状态将变为「进行中」，可正式推进 NPI 阶段门、任务与交付物。此操作不可撤销为草稿。',
                  onOk: async () => {
                    await updateRdProject(id!, {
                      status: 'IN_PROGRESS',
                      actual_start_date: dayjs().format('YYYY-MM-DD'),
                    });
                    messageApi.success('项目已启动');
                    load();
                  },
                });
              }}
            >
              启动项目
            </Button>
          ) : null}
          {isRdProject && releasePassed ? (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => {
                modalApi.confirm({
                  title: '创建交付项目？',
                  content: '将从当前研发项目下推交付项目，继承物料与工程资料关联。',
                  onOk: async () => {
                    const created = await spawnDeliveryProject(projectId);
                    messageApi.success('交付项目已创建');
                    navigate(`/apps/kuaiplm/rd-projects/detail/${created.id}`);
                  },
                });
              }}
            >
              创建交付项目
            </Button>
          ) : null}
          {isRdProject ? (
            <Button icon={<RocketOutlined />} onClick={() => setPushModalOpen(true)}>
              下推试制工单
            </Button>
          ) : null}
        </Space>

        <Card size="small">
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={16}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="产品">
                  {project.material_name || project.material_code || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="负责人">{project.owner_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="当前阶段门">
                  {project.current_gate_name || activeGate?.gate_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="计划周期">
                  {project.planned_start_date
                    ? dayjs(project.planned_start_date).format('YYYY-MM-DD')
                    : '—'}
                  {' ~ '}
                  {project.planned_end_date
                    ? dayjs(project.planned_end_date).format('YYYY-MM-DD')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">综合进度</Typography.Text>
              <Progress percent={Math.round(progress)} status="active" />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                阶段门 40% · 任务 30% · 交付物 30%
              </Typography.Text>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            {gates.length > 0 ? (
              <Card size="small" styles={{ body: { paddingTop: 12 } }}>
                <RdProjectGateStepper
                  gates={gates}
                  activeGateKey={activeGateKey}
                  onChange={setActiveGateKey}
                  projectType={projectType}
                />
                <div className="rd-project-gate-panel" style={{ marginTop: 16 }}>
                  {activeGate ? renderGatePanel(activeGate) : null}
                </div>
              </Card>
            ) : (
              <Card>
                <Empty description="暂无阶段门" />
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            {collaborationItems.length > 0 ? (
              <Card
                size="small"
                title="协同事项"
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[8, 8]}>
                  {collaborationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Col span={8} key={item.key}>
                        <Card
                          hoverable
                          size="small"
                          onClick={() => navigate(item.path)}
                          styles={{
                            body: {
                              padding: '10px 6px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 4,
                            },
                          }}
                          style={{ borderRadius: token.borderRadius }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: token.borderRadius,
                              background: token.colorPrimaryBg,
                              border: `1px solid ${token.colorPrimaryBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon style={{ fontSize: 18, color: token.colorPrimary }} />
                          </div>
                          <Typography.Text style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.3 }}>
                            {item.title}
                          </Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {item.count}
                          </Typography.Text>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            ) : null}

            <Card
              size="small"
              title="工程资料链接"
              extra={
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setLinkModalOpen(true)}>
                  添加
                </Button>
              }
              style={{ marginBottom: 16 }}
            >
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={linkColumns}
                dataSource={links}
                locale={{ emptyText: '暂无工程链接' }}
              />
            </Card>

            <Card size="small" title="关联知识">
              {articles.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {articles.map((a) => (
                    <div key={a.id}>
                      <a onClick={() => navigate(`/apps/kuaiplm/knowledge-base/detail/${a.id}`)}>
                        {a.title}
                      </a>
                      {a.space_name ? (
                        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          ({a.space_name})
                        </Typography.Text>
                      ) : null}
                    </div>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联文章" />
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      <FormModalTemplate
        title="添加工程链接"
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        formRef={linkFormRef}
        onFinish={async (values) => {
          await createRdProjectLink(id!, values);
          messageApi.success('链接已添加');
          setLinkModalOpen(false);
          load();
        }}
      >
        <ProFormSelect
          name="link_type"
          label="链接类型"
          rules={[{ required: true }]}
          options={Object.entries(ENGINEERING_LINK_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ProFormText name="link_label" label="显示名称" />
        <ProFormText name="target_uuid" label="目标 UUID" />
        <ProFormText name="target_id" label="目标 ID" />
        <ProFormText name="material_id" label="物料 ID（BOM/物料）" />
        <ProFormText name="version" label="版本" />
        <ProFormTextArea name="notes" label="备注" />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingTask ? '编辑任务' : '新建任务'}
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        formRef={taskFormRef}
        onFinish={async (values) => {
          const payload = {
            ...values,
            gate_id: values.gate_id ?? activeGate?.id,
            due_date: values.due_date
              ? dayjs(values.due_date).format('YYYY-MM-DD')
              : undefined,
            parent_task_id: values.parent_task_id ?? null,
          };
          if (!payload.gate_id) {
            messageApi.error('请选择所属阶段门');
            return;
          }
          if (editingTask?.id) {
            await updateRdProjectTask(id!, editingTask.id, payload);
            messageApi.success('任务已更新');
          } else {
            await createRdProjectTask(id!, payload);
            messageApi.success('任务已创建');
          }
          setTaskModalOpen(false);
          setEditingTask(null);
          load();
        }}
      >
        <ProFormSelect
          name="gate_id"
          label="所属阶段门"
          rules={[{ required: true, message: '请选择阶段门' }]}
          options={gates.map((g) => ({ value: g.id, label: g.gate_name }))}
          initialValue={activeGate?.id}
        />
        <ProFormText name="task_name" label="任务名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="parent_task_id"
          label="父任务（可选，仅一级子任务）"
          allowClear
          options={parentTaskOptions}
        />
        <ProFormText name="assignee_name" label="负责人" />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue="TODO"
          options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <ProFormDatePicker name="due_date" label="截止日期" />
        <ProFormTextArea name="description" label="说明" />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingDeliverable ? '编辑交付物' : '新建交付物'}
        open={deliverableModalOpen}
        onClose={() => {
          setDeliverableModalOpen(false);
          setEditingDeliverable(null);
        }}
        formRef={deliverableFormRef}
        onFinish={async (values) => {
          const payload = {
            ...values,
            gate_id: values.gate_id ?? activeGate?.id,
          };
          if (!payload.gate_id) {
            messageApi.error('请选择所属阶段门');
            return;
          }
          if (editingDeliverable?.id) {
            await updateRdProjectDeliverable(id!, editingDeliverable.id, payload);
            messageApi.success('交付物已更新');
          } else {
            await createRdProjectDeliverable(id!, payload);
            messageApi.success('交付物已创建');
          }
          setDeliverableModalOpen(false);
          setEditingDeliverable(null);
          load();
        }}
      >
        <ProFormSelect
          name="gate_id"
          label="所属阶段门"
          rules={[{ required: true }]}
          options={gates.map((g) => ({ value: g.id, label: g.gate_name }))}
          initialValue={activeGate?.id}
        />
        <ProFormText name="name" label="交付物名称" rules={[{ required: true }]} />
        <ProFormText name="deliverable_type" label="类型" placeholder="如：文档、图纸包" />
        <ProFormSelect
          name="status"
          label="状态"
          initialValue="PENDING"
          options={Object.entries(DELIVERABLE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ProFormText name="file_url" label="文件链接" />
        <ProFormText name="file_name" label="文件名" />
        <ProFormTextArea name="description" label="说明" />
      </FormModalTemplate>

      <FormModalTemplate
        title={`编辑阶段门 · ${editingGate?.gate_name ?? ''}`}
        open={gateEditOpen}
        grid
        onClose={() => {
          setGateEditOpen(false);
          setEditingGate(null);
          selectedReviewerRef.current = null;
        }}
        formRef={gateFormRef}
        onFinish={async (values) => {
          if (!editingGate?.id) return;
          await updateRdProjectGate(id!, editingGate.id, {
            planned_date: values.planned_date
              ? dayjs(values.planned_date).format('YYYY-MM-DD')
              : undefined,
            actual_date: values.actual_date
              ? dayjs(values.actual_date).format('YYYY-MM-DD')
              : undefined,
            reviewer_id: selectedReviewerRef.current?.id ?? null,
            reviewer_name: selectedReviewerRef.current?.name ?? undefined,
            criteria: values.criteria,
            review_notes: values.review_notes,
          });
          messageApi.success('阶段门已更新');
          setGateEditOpen(false);
          setEditingGate(null);
          selectedReviewerRef.current = null;
          load();
        }}
      >
        <ProFormDatePicker
          name="planned_date"
          label="计划日期"
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="actual_date"
          label="实际日期"
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <UniUserSelect
          name="reviewer_uuid"
          label="评审人"
          placeholder="请选择评审人"
          colProps={{ span: 24 }}
          onChange={(_uuid, user) => {
            if (user && !Array.isArray(user)) {
              selectedReviewerRef.current = {
                id: user.id,
                name: user.full_name || user.username || '',
              };
            } else {
              selectedReviewerRef.current = null;
            }
          }}
        />
        <ProFormTextArea name="criteria" label="通过准则" colProps={{ span: 24 }} />
        <ProFormTextArea name="review_notes" label="评审意见" colProps={{ span: 24 }} />
      </FormModalTemplate>

      <Modal
        title="下推试制工单"
        open={pushModalOpen}
        confirmLoading={pushing}
        onCancel={() => setPushModalOpen(false)}
        onOk={async () => {
          setPushing(true);
          try {
            const res = await pushTrialWorkOrder(id!, { quantity: pushQty, notes: pushNotes });
            messageApi.success(
              res.work_order_code ? `已创建试制工单 ${res.work_order_code}` : '试制工单已下推',
            );
            setPushModalOpen(false);
          } catch (e: any) {
            messageApi.error(e?.message || '下推失败');
          } finally {
            setPushing(false);
          }
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text>试制数量</Typography.Text>
            <InputNumber
              min={1}
              value={pushQty}
              onChange={(v) => setPushQty(v ?? 1)}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div>
            <Typography.Text>备注</Typography.Text>
            <Input.TextArea
              rows={3}
              value={pushNotes}
              onChange={(e) => setPushNotes(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </ListPageTemplate>
  );
};

export default RdProjectDetailPage;
