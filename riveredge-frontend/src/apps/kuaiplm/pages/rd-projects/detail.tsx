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
import { buildFutureDateShortcutFieldProps } from '../../../../utils/futureDatePickerShortcuts';
import { formatDateTime } from '../../../../utils/format';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  type RdProjectWorkbench,
  type RdProjectGate,
  type RdProjectTask,
  type RdProjectLink,
  type RdProjectDeliverable,
  type ProjectType,
} from '../../services/rd-project';
import { openMasterDataInNewTab, type EngineeringLinkType } from '../../services/master-data-links';
import { RdProjectGateStepper } from '../../components/RdProjectGateStepper';
import { UniUserSelect } from '../../../../components/uni-user-select';
import { resolveUserDisplay } from '../../../../services/user';
import {
  getKuaiplmDeliverableStatusOptions,
  getKuaiplmDeliverableStatusText,
  getKuaiplmEngineeringLinkOptions,
  getKuaiplmEngineeringLinkText,
  getKuaiplmGateStatusText,
  getKuaiplmProjectStatusText,
  getKuaiplmProjectTypeText,
  getKuaiplmTaskStatusOptions,
  getKuaiplmTaskStatusText,
} from '../../components/kuaiplmMeta';
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
    .filter((task) => !task.parent_task_id)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const childrenByParent = new Map<number, RdProjectTask[]>();
  tasks
    .filter((task) => task.parent_task_id)
    .forEach((task) => {
      const pid = task.parent_task_id!;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(task);
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
    .filter((task) => task.parent_task_id && !shown.has(task.id))
    .forEach((task) => rows.push({ task, isChild: true }));
  return rows;
}

const RdProjectDetailPage: React.FC = () => {
  const { t } = useTranslation();
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

  const taskStatusOptions = useMemo(() => getKuaiplmTaskStatusOptions(t), [t]);
  const deliverableStatusOptions = useMemo(() => getKuaiplmDeliverableStatusOptions(t), [t]);
  const engineeringLinkOptions = useMemo(() => getKuaiplmEngineeringLinkOptions(t), [t]);

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
      messageApi.error(e?.message || t('app.kuaiplm.rdProjects.detail.loadFailed'));
      setWorkbench(null);
    } finally {
      setLoading(false);
    }
  }, [id, messageApi, t]);

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
      title: `${t('app.kuaiplm.common.actions.approve')} · ${gate.gate_name}`,
      content: t('app.kuaiplm.rdProjects.detail.gatePassConfirm'),
      onOk: async () => {
        try {
          await updateRdProjectGate(id, gate.id!, {
            status: 'PASSED',
            actual_date: formatDateTime(dayjs(), 'YYYY-MM-DD'),
          });
          messageApi.success(t('app.kuaiplm.rdProjects.detail.gatePassSuccess'));
          load();
        } catch (e: any) {
          messageApi.error(e?.message || t('app.kuaiplm.rdProjects.detail.gatePassFailed'));
          throw e;
        }
      },
    });
  };

  const parentTaskOptions = useMemo(() => {
    if (!activeGate?.id) return [];
    return tasks
      .filter((task) => task.gate_id === activeGate.id && !task.parent_task_id && task.id !== editingTask?.id)
      .map((task) => ({ value: task.id, label: task.task_name }));
  }, [tasks, activeGate?.id, editingTask?.id]);

  const linkColumns = useMemo(
    () => [
      {
        title: t('app.kuaiplm.common.columns.type'),
        dataIndex: 'link_type',
        width: 100,
        render: (linkType: string) => getKuaiplmEngineeringLinkText(t, linkType),
      },
      { title: t('app.kuaiplm.common.columns.name'), dataIndex: 'target_name', ellipsis: true },
      { title: t('app.kuaiplm.common.columns.version'), dataIndex: 'version', width: 80 },
      {
        title: t('app.kuaiplm.common.columns.actions'),
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
              {t('app.kuaiplm.common.actions.detail')}
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                modalApi.confirm({
                  title: t('app.kuaiplm.rdProjects.detail.link.deleteConfirm'),
                  onOk: async () => {
                    await deleteRdProjectLink(id!, row.id!);
                    messageApi.success(t('app.kuaiplm.common.messages.deleteSuccess'));
                    load();
                  },
                });
              }}
            />
          </Space>
        ),
      },
    ],
    [t, id, modalApi, messageApi, load],
  );

  const renderGatePanel = useCallback(
    (gate: RdProjectGate) => {
      const gateTasks = tasks.filter((task) => task.gate_id === gate.id);
      const gateDeliverables = deliverables.filter((item) => item.gate_id === gate.id);
      const taskRows = buildTaskRows(gateTasks);
      const gateStatus = gate.status ?? 'PENDING';

      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card
            size="small"
            className="rd-project-gate-section-card"
            title={t('app.kuaiplm.rdProjects.detail.section.gateInfo')}
            extra={
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openGateEdit(gate)}>
                  {t('app.kuaiplm.common.actions.edit')}
                </Button>
                <Button
                  type="primary"
                  size="small"
                  disabled={gateStatus === 'PASSED' || gateStatus === 'SKIPPED'}
                  onClick={() => handlePassGate(gate)}
                >
                  {t('app.kuaiplm.common.actions.approve')}
                </Button>
              </Space>
            }
          >
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t('app.kuaiplm.common.columns.status')}>
                <Tag color={GATE_STATUS_COLOR[gateStatus] ?? 'default'}>
                  {getKuaiplmGateStatusText(t, gateStatus)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.plannedDate')}>
                {gate.planned_date ? formatDateTime(gate.planned_date, 'YYYY-MM-DD') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.actualDate')}>
                {gate.actual_date ? formatDateTime(gate.actual_date, 'YYYY-MM-DD') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.reviewer')}>
                {gate.reviewer_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.passCriteria')} span={2}>
                {gate.criteria || '—'}
              </Descriptions.Item>
              {gate.review_notes ? (
                <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.reviewNotes')} span={2}>
                  {gate.review_notes}
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </Card>

          <Card
            size="small"
            className="rd-project-gate-section-card"
            title={`${t('app.kuaiplm.common.columns.task')} (${gateTasks.length})`}
            extra={
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreateTask(gate)}>
                {t('app.kuaiplm.rdProjects.detail.task.createTitle')}
              </Button>
            }
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: t('app.kuaiplm.rdProjects.detail.empty.gateTasks') }}
              dataSource={taskRows.map((r) => r.task)}
              columns={[
                {
                  title: t('app.kuaiplm.common.columns.task'),
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
                  title: t('app.kuaiplm.common.columns.owner'),
                  dataIndex: 'assignee_name',
                  width: 100,
                  render: (v) => v || '—',
                },
                {
                  title: t('app.kuaiplm.common.columns.status'),
                  dataIndex: 'status',
                  width: 88,
                  render: (s: string) => (
                    <Tag color={TASK_STATUS_COLOR[s] ?? 'default'}>{getKuaiplmTaskStatusText(t, s)}</Tag>
                  ),
                },
                {
                  title: t('app.kuaiplm.common.columns.dueDate'),
                  dataIndex: 'due_date',
                  width: 108,
                  render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '—'),
                },
                {
                  title: t('app.kuaiplm.common.columns.actions'),
                  width: 120,
                  render: (_: unknown, row: RdProjectTask) => (
                    <Space size="small">
                      <Button type="link" size="small" onClick={() => openEditTask(row)}>
                        {t('app.kuaiplm.common.actions.edit')}
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => {
                          modalApi.confirm({
                            title: t('app.kuaiplm.rdProjects.detail.task.deleteConfirm'),
                            onOk: async () => {
                              await deleteRdProjectTask(id!, row.id!);
                              messageApi.success(t('app.kuaiplm.common.messages.deleteSuccess'));
                              load();
                            },
                          });
                        }}
                      >
                        {t('app.kuaiplm.common.actions.delete')}
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
            title={`${t('app.kuaiplm.rdProjects.detail.deliverable.name')} (${gateDeliverables.length})`}
            extra={
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openCreateDeliverable(gate)}
              >
                {t('app.kuaiplm.rdProjects.detail.deliverable.createTitle')}
              </Button>
            }
          >
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              locale={{ emptyText: t('app.kuaiplm.rdProjects.detail.empty.gateDeliverables') }}
              dataSource={gateDeliverables}
              columns={[
                { title: t('app.kuaiplm.common.columns.name'), dataIndex: 'name', ellipsis: true },
                {
                  title: t('app.kuaiplm.common.columns.type'),
                  dataIndex: 'deliverable_type',
                  width: 100,
                  render: (v) => v || '—',
                },
                {
                  title: t('app.kuaiplm.common.columns.status'),
                  dataIndex: 'status',
                  width: 88,
                  render: (s: string) => (
                    <Tag color={DELIVERABLE_STATUS_COLOR[s] ?? 'default'}>
                      {getKuaiplmDeliverableStatusText(t, s)}
                    </Tag>
                  ),
                },
                {
                  title: t('app.kuaiplm.common.columns.actions'),
                  width: 220,
                  render: (_: unknown, row: RdProjectDeliverable) => (
                    <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                      <Button type="link" size="small" onClick={() => openEditDeliverable(row)}>
                        {t('app.kuaiplm.common.actions.edit')}
                      </Button>
                      {row.status !== 'SUBMITTED' && row.status !== 'APPROVED' ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={async () => {
                            await updateRdProjectDeliverable(id!, row.id!, { status: 'SUBMITTED' });
                            messageApi.success(t('app.kuaiplm.rdProjects.detail.deliverable.submitSuccess'));
                            load();
                          }}
                        >
                          {t('app.kuaiplm.common.deliverableStatus.submitted')}
                        </Button>
                      ) : null}
                      {row.status !== 'APPROVED' ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={async () => {
                            await updateRdProjectDeliverable(id!, row.id!, { status: 'APPROVED' });
                            messageApi.success(t('app.kuaiplm.rdProjects.detail.deliverable.approveSuccess'));
                            load();
                          }}
                        >
                          {t('app.kuaiplm.common.actions.approve')}
                        </Button>
                      ) : null}
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => {
                          modalApi.confirm({
                            title: t('app.kuaiplm.rdProjects.detail.deliverable.deleteConfirm'),
                            onOk: async () => {
                              await deleteRdProjectDeliverable(id!, row.id!);
                              messageApi.success(t('app.kuaiplm.common.messages.deleteSuccess'));
                              load();
                            },
                          });
                        }}
                      >
                        {t('app.kuaiplm.common.actions.delete')}
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      );
    },
    [t, tasks, deliverables, id, modalApi, messageApi, load],
  );

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
        <Empty description={t('app.kuaiplm.rdProjects.detail.notFound')}>
          <Button onClick={() => navigate('/apps/kuaiplm/rd-projects')}>
            {t('app.kuaiplm.common.actions.allProjects')}
          </Button>
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
          title: t('app.kuaiplm.rdProjects.detail.shortcut.requirements'),
          count: collaboration.requirement_count ?? 0,
          icon: FileSearchOutlined,
          path: `/apps/kuaiplm/phase2/requirements?project_id=${projectId}`,
        },
        {
          key: 'design-reviews',
          title: t('app.kuaiplm.rdProjects.detail.shortcut.designReviews'),
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
            {t('app.kuaiplm.common.actions.allProjects')}
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {project.project_code} · {project.project_name}
          </Typography.Title>
          <Tag color={projectType === 'DELIVERY' ? 'blue' : 'purple'}>
            {getKuaiplmProjectTypeText(t, projectType)}
          </Tag>
          {project.status ? (
            <Tag color={project.status === 'DRAFT' ? 'default' : 'processing'}>
              {getKuaiplmProjectStatusText(t, project.status)}
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
              {t('app.kuaiplm.rdProjects.form.sourceProject')}:{' '}
              {project.source_project_code ?? `#${project.source_project_id}`}
            </Button>
          ) : null}
          {project.status === 'DRAFT' ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                modalApi.confirm({
                  title: t('app.kuaiplm.rdProjects.detail.startConfirmTitle'),
                  content: t('app.kuaiplm.rdProjects.detail.startConfirmContent'),
                  onOk: async () => {
                    await updateRdProject(id!, {
                      status: 'IN_PROGRESS',
                      actual_start_date: formatDateTime(dayjs(), 'YYYY-MM-DD'),
                    });
                    messageApi.success(t('app.kuaiplm.rdProjects.detail.startSuccess'));
                    load();
                  },
                });
              }}
            >
              {t('app.kuaiplm.rdProjects.detail.startConfirmTitle').replace('?', '')}
            </Button>
          ) : null}
          {isRdProject && releasePassed ? (
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => {
                modalApi.confirm({
                  title: t('app.kuaiplm.rdProjects.detail.createDeliveryTitle'),
                  content: t('app.kuaiplm.rdProjects.detail.createDeliveryContent'),
                  onOk: async () => {
                    const created = await spawnDeliveryProject(projectId);
                    messageApi.success(t('app.kuaiplm.rdProjects.detail.createDeliverySuccess'));
                    navigate(`/apps/kuaiplm/rd-projects/detail/${created.id}`);
                  },
                });
              }}
            >
              {t('app.kuaiplm.rdProjects.detail.createDeliveryTitle').replace('?', '')}
            </Button>
          ) : null}
          {isRdProject ? (
            <Button icon={<RocketOutlined />} onClick={() => setPushModalOpen(true)}>
              {t('app.kuaiplm.rdProjects.detail.trialWo.title')}
            </Button>
          ) : null}
        </Space>

        <Card size="small">
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={16}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.product')}>
                  {project.material_name || project.material_code || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.owner')}>
                  {project.owner_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.currentGate')}>
                  {project.current_gate_name || activeGate?.gate_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.rdProjects.detail.label.plannedPeriod')}>
                  {project.planned_start_date
                    ? formatDateTime(project.planned_start_date, 'YYYY-MM-DD')
                    : '—'}
                  {' ~ '}
                  {project.planned_end_date
                    ? formatDateTime(project.planned_end_date, 'YYYY-MM-DD')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text type="secondary">{t('app.kuaiplm.common.columns.progress')}</Typography.Text>
              <Progress percent={Math.round(progress)} status="active" />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('app.kuaiplm.common.columns.gate')} 40% · {t('app.kuaiplm.common.columns.task')} 30% ·{' '}
                {t('app.kuaiplm.rdProjects.detail.deliverable.name')} 30%
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
                <Empty description={t('app.kuaiplm.rdProjects.detail.empty.gates')} />
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            {collaborationItems.length > 0 ? (
              <Card size="small" title={t('app.kuaiplm.rdProjects.detail.section.collaboration')} style={{ marginBottom: 16 }}>
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
              title={t('app.kuaiplm.rdProjects.detail.section.engineeringLinks')}
              extra={
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setLinkModalOpen(true)}>
                  {t('app.kuaiplm.rdProjects.detail.link.addTitle')}
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
                locale={{ emptyText: t('app.kuaiplm.rdProjects.detail.empty.engineeringLinks') }}
              />
            </Card>

            <Card size="small" title={t('app.kuaiplm.rdProjects.detail.section.relatedKnowledge')}>
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
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('app.kuaiplm.rdProjects.detail.empty.relatedArticles')}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.detail.link.addTitle')}
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        formRef={linkFormRef}
        onFinish={async (values) => {
          await createRdProjectLink(id!, values);
          messageApi.success(t('app.kuaiplm.rdProjects.detail.link.addSuccess'));
          setLinkModalOpen(false);
          load();
        }}
      >
        <ProFormSelect
          name="link_type"
          label={t('app.kuaiplm.rdProjects.detail.link.linkType')}
          rules={[{ required: true }]}
          options={engineeringLinkOptions}
        />
        <ProFormText name="link_label" label={t('app.kuaiplm.rdProjects.detail.link.displayName')} />
        <ProFormText name="target_uuid" label={t('app.kuaiplm.rdProjects.detail.link.targetUuid')} />
        <ProFormText name="target_id" label={t('app.kuaiplm.rdProjects.detail.link.targetId')} />
        <ProFormText name="material_id" label={t('app.kuaiplm.rdProjects.detail.link.materialId')} />
        <ProFormText name="version" label={t('app.kuaiplm.common.columns.version')} />
        <ProFormTextArea name="notes" label={t('app.kuaiplm.rdProjects.form.notes')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={
          editingTask
            ? t('app.kuaiplm.rdProjects.detail.task.editTitle')
            : t('app.kuaiplm.rdProjects.detail.task.createTitle')
        }
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
            due_date: values.due_date ? formatDateTime(values.due_date, 'YYYY-MM-DD') : undefined,
            parent_task_id: values.parent_task_id ?? null,
          };
          if (!payload.gate_id) {
            messageApi.error(t('app.kuaiplm.rdProjects.detail.task.gateRequired'));
            return;
          }
          if (editingTask?.id) {
            await updateRdProjectTask(id!, editingTask.id, payload);
            messageApi.success(t('app.kuaiplm.rdProjects.detail.task.updateSuccess'));
          } else {
            await createRdProjectTask(id!, payload);
            messageApi.success(t('app.kuaiplm.rdProjects.detail.task.createSuccess'));
          }
          setTaskModalOpen(false);
          setEditingTask(null);
          load();
        }}
      >
        <ProFormSelect
          name="gate_id"
          label={t('app.kuaiplm.rdProjects.detail.task.gateField')}
          rules={[{ required: true, message: t('app.kuaiplm.rdProjects.detail.task.gateRequired') }]}
          options={gates.map((g) => ({ value: g.id, label: g.gate_name }))}
          initialValue={activeGate?.id}
        />
        <ProFormText
          name="task_name"
          label={t('app.kuaiplm.rdProjects.detail.task.name')}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="parent_task_id"
          label={t('app.kuaiplm.rdProjects.detail.task.parentTask')}
          allowClear
          options={parentTaskOptions}
        />
        <ProFormText name="assignee_name" label={t('app.kuaiplm.rdProjects.detail.task.assignee')} />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.common.columns.status')}
          initialValue="TODO"
          options={taskStatusOptions}
        />
        <ProFormDatePicker
          name="due_date"
          label={t('app.kuaiplm.common.columns.dueDate')}
          fieldProps={buildFutureDateShortcutFieldProps({
            getForm: () => taskFormRef.current,
            fieldName: 'due_date',
            t,
          })}
        />
        <ProFormTextArea name="description" label={t('app.kuaiplm.rdProjects.detail.task.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={
          editingDeliverable
            ? t('app.kuaiplm.rdProjects.detail.deliverable.editTitle')
            : t('app.kuaiplm.rdProjects.detail.deliverable.createTitle')
        }
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
            messageApi.error(t('app.kuaiplm.rdProjects.detail.task.gateRequired'));
            return;
          }
          if (editingDeliverable?.id) {
            await updateRdProjectDeliverable(id!, editingDeliverable.id, payload);
            messageApi.success(t('app.kuaiplm.rdProjects.detail.deliverable.updateSuccess'));
          } else {
            await createRdProjectDeliverable(id!, payload);
            messageApi.success(t('app.kuaiplm.rdProjects.detail.deliverable.createSuccess'));
          }
          setDeliverableModalOpen(false);
          setEditingDeliverable(null);
          load();
        }}
      >
        <ProFormSelect
          name="gate_id"
          label={t('app.kuaiplm.rdProjects.detail.task.gateField')}
          rules={[{ required: true }]}
          options={gates.map((g) => ({ value: g.id, label: g.gate_name }))}
          initialValue={activeGate?.id}
        />
        <ProFormText
          name="name"
          label={t('app.kuaiplm.rdProjects.detail.deliverable.name')}
          rules={[{ required: true }]}
        />
        <ProFormText
          name="deliverable_type"
          label={t('app.kuaiplm.common.columns.type')}
          placeholder={t('app.kuaiplm.rdProjects.detail.deliverable.typePlaceholder')}
        />
        <ProFormSelect
          name="status"
          label={t('app.kuaiplm.common.columns.status')}
          initialValue="PENDING"
          options={deliverableStatusOptions}
        />
        <ProFormText name="file_url" label={t('app.kuaiplm.rdProjects.detail.deliverable.fileUrl')} />
        <ProFormText name="file_name" label={t('app.kuaiplm.rdProjects.detail.deliverable.fileName')} />
        <ProFormTextArea name="description" label={t('app.kuaiplm.rdProjects.detail.task.description')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={`${t('app.kuaiplm.common.actions.edit')} · ${editingGate?.gate_name ?? ''}`}
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
              ? formatDateTime(values.planned_date, 'YYYY-MM-DD')
              : undefined,
            actual_date: values.actual_date
              ? formatDateTime(values.actual_date, 'YYYY-MM-DD')
              : undefined,
            reviewer_id: selectedReviewerRef.current?.id ?? null,
            reviewer_name: selectedReviewerRef.current?.name ?? undefined,
            criteria: values.criteria,
            review_notes: values.review_notes,
          });
          messageApi.success(t('app.kuaiplm.rdProjects.detail.gate.updateSuccess'));
          setGateEditOpen(false);
          setEditingGate(null);
          selectedReviewerRef.current = null;
          load();
        }}
      >
        <ProFormDatePicker
          name="planned_date"
          label={t('app.kuaiplm.rdProjects.detail.label.plannedDate')}
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="actual_date"
          label={t('app.kuaiplm.rdProjects.detail.label.actualDate')}
          colProps={{ span: 12 }}
          width="100%"
          fieldProps={{ style: { width: '100%' } }}
        />
        <UniUserSelect
          name="reviewer_uuid"
          label={t('app.kuaiplm.rdProjects.detail.label.reviewer')}
          placeholder={t('app.kuaiplm.rdProjects.detail.gate.reviewerPlaceholder')}
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
        <ProFormTextArea
          name="criteria"
          label={t('app.kuaiplm.rdProjects.detail.label.passCriteria')}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea
          name="review_notes"
          label={t('app.kuaiplm.rdProjects.detail.label.reviewNotes')}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <Modal
        title={t('app.kuaiplm.rdProjects.detail.trialWo.title')}
        open={pushModalOpen}
        confirmLoading={pushing}
        onCancel={() => setPushModalOpen(false)}
        onOk={async () => {
          setPushing(true);
          try {
            const res = await pushTrialWorkOrder(id!, { quantity: pushQty, notes: pushNotes });
            messageApi.success(
              res.work_order_code
                ? t('app.kuaiplm.rdProjects.detail.trialWo.successWithCode', { code: res.work_order_code })
                : t('app.kuaiplm.rdProjects.detail.trialWo.success'),
            );
            setPushModalOpen(false);
          } catch (e: any) {
            messageApi.error(e?.message || t('app.kuaiplm.rdProjects.detail.trialWo.failed'));
          } finally {
            setPushing(false);
          }
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Typography.Text>{t('app.kuaiplm.common.columns.progress')}</Typography.Text>
            <InputNumber
              min={1}
              value={pushQty}
              onChange={(v) => setPushQty(v ?? 1)}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div>
            <Typography.Text>{t('app.kuaiplm.rdProjects.form.notes')}</Typography.Text>
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
