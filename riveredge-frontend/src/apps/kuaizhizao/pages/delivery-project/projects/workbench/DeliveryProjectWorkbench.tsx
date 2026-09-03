/**
 * 交付项目工作台（枢纽型全页）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  Card,
  Row,
  Col,
  theme,
} from 'antd';
import { BugOutlined, FileTextOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  ProjectWorkbenchToolbar,
} from '../../../../../../components/layout-templates';
import { useLeaveFormTab } from '../../../../../../components/uni-tabs/navigateClosingTab';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { useOptionalLinkedDocumentDetail } from '../../../../../../components/linked-document-detail/LinkedDocumentDetailContext';
import { resolveKuaizhizaoDocumentAction } from '../../../../constants/documentActionRegistry';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from '../../shared/deliveryProgressColumn';
import { renderDeliveryIssuePriorityTag, renderDeliveryStatusTag } from '../../shared/deliveryListPresentation';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { formatBusinessDateOnly } from '../../../../../../utils/format';
import { resolveUserDisplay, type User } from '../../../../../../services/user';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import {
  deliveryIssueApi,
  deliveryNodeReportApi,
  deliveryProcessTemplateApi,
  deliveryProjectApi,
  DELIVERY_ISSUE_STATUS,
  DELIVERY_ISSUE_TYPE,
  DELIVERY_NODE_DOCUMENT_TYPES,
  DELIVERY_NODE_REPORT_STATUS,
  DELIVERY_NODE_STATUS,
  DELIVERY_NODE_TASK_STATUS,
  DELIVERY_PROJECT_STATUS,
  type DeliveryIssue,
  type DeliveryLinkedRdProject,
  type DeliveryMember,
  type DeliveryNodeReport,
  type DeliveryProcessTemplate,
  type DeliveryProject,
  type DeliveryProjectNode,
  type DeliveryProjectNodeDocument,
  type DeliveryProjectNodeTask,
} from '../../../../services/delivery-project';
import { UniUserSelect } from '../../../../../../components/uni-user-select';
import DeliveryProjectNodeStepper from '../../components/DeliveryProjectNodeStepper';
import DeliveryNodeDocumentSelect from '../../shared/DeliveryNodeDocumentSelect';
import './workbench.less';

const PLACEHOLDER: DeliveryProject = {
  id: 0,
  project_code: '',
  project_name: '',
  status: 'draft',
  progress_percent: 0,
};

const RESOURCE = 'kuaizhizao:delivery-project';

/** 侧栏窄表：单号列宽够 DNR/DPI 不换行 */
const WORKBENCH_SIDE_CODE_COL = 148;
const WORKBENCH_SIDE_NODE_COL = 56;
const WORKBENCH_SIDE_BADGE_COL = 72;
const WORKBENCH_SIDE_PRIORITY_COL = 64;

export const DeliveryProjectWorkbench: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const leaveProjectsList = useLeaveFormTab('/apps/kuaizhizao/delivery-project/projects');
  const perms = useResourcePermissions(RESOURCE);
  const canUpdate = perms.canUpdate;
  const canExecute = perms.canAction?.('execute') ?? false;
  const canDelete = perms.canDelete;
  const linkedDetail = useOptionalLinkedDocumentDetail();
  const pushShipmentAction = resolveKuaizhizaoDocumentAction(t, 'shipment_notice.pull_from_sales_order');
  const createInstallAction = resolveKuaizhizaoDocumentAction(t, 'install_execution.pull_from_sales_order');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<DeliveryProject | null>(null);
  const [linkedRdProject, setLinkedRdProject] = useState<DeliveryLinkedRdProject | null>(null);
  const [reports, setReports] = useState<DeliveryNodeReport[]>([]);
  const [issues, setIssues] = useState<DeliveryIssue[]>([]);
  const [nodeScheduleModalOpen, setNodeScheduleModalOpen] = useState(false);
  const [nodeScheduleEditing, setNodeScheduleEditing] = useState<DeliveryProjectNode | null>(null);
  const [nodeScheduleForm] = Form.useForm();
  const nodeScheduleOwnerRef = useRef<number | undefined>();
  const [nodeDocuments, setNodeDocuments] = useState<DeliveryProjectNodeDocument[]>([]);
  const [docLinkModalOpen, setDocLinkModalOpen] = useState(false);
  const [docLinkNode, setDocLinkNode] = useState<DeliveryProjectNode | null>(null);
  const [docLinkForm] = Form.useForm();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<DeliveryProcessTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskEditingNode, setTaskEditingNode] = useState<DeliveryProjectNode | null>(null);
  const [editingTask, setEditingTask] = useState<DeliveryProjectNodeTask | null>(null);
  const [taskForm] = Form.useForm();
  const taskOwnerRef = useRef<number | undefined>();
  const taskOwnerNameRef = useRef<string | undefined>();
  const taskMembersRef = useRef<DeliveryMember[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [reportForm] = Form.useForm();
  const [issueForm] = Form.useForm();
  const [editOpen, setEditOpen] = useState(false);
  const [activeNodeKey, setActiveNodeKey] = useState<string>();
  const [templates, setTemplates] = useState<DeliveryProcessTemplate[]>([]);
  const editFormRef = useRef<ProFormInstance>();
  const selectedOwnerRef = useRef<number | undefined>();
  const selectedMembersRef = useRef<DeliveryMember[]>([]);

  const load = useCallback(async () => {
    if (!projectId || Number.isNaN(projectId)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await deliveryProjectApi.getWorkbench(projectId);
      setProject(data);
      setReports(data.recent_reports ?? []);
      setIssues(data.open_issues ?? []);
      setLinkedRdProject(data.linked_rd_project ?? null);
      setNodeDocuments(data.node_documents ?? []);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? t('common.loadFailed'));
      setProject(null);
      setReports([]);
      setIssues([]);
      setLinkedRdProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (projectId && !Number.isNaN(projectId)) void load();
  }, [projectId, load]);

  useEffect(() => {
    const code = project?.project_code?.trim();
    if (!code) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: `${code} ${t('app.kuaizhizao.deliveryProject.workbench.tabTitleSuffix')}` },
      }),
    );
  }, [project?.project_code, location.pathname, location.search, t]);

  const runAction = async (action: () => Promise<DeliveryProject>, successKey: string) => {
    try {
      const updated = await action();
      setProject(updated);
      message.success(t(successKey));
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const handleStart = () =>
    void runAction(() => deliveryProjectApi.start(projectId!), 'app.kuaizhizao.deliveryProject.started');
  const handlePause = () =>
    void runAction(() => deliveryProjectApi.pause(projectId!), 'app.kuaizhizao.deliveryProject.paused');
  const handleResume = () =>
    void runAction(() => deliveryProjectApi.resume(projectId!), 'app.kuaizhizao.deliveryProject.resumed');
  const handleCancelProject = () =>
    void runAction(() => deliveryProjectApi.cancel(projectId!), 'app.kuaizhizao.deliveryProject.cancelled');

  const handleCompleteProject = () =>
    void runAction(() => deliveryProjectApi.complete(projectId!), 'app.kuaizhizao.deliveryProject.completed');

  const handleDeleteProject = async () => {
    try {
      await deliveryProjectApi.delete(projectId!);
      message.success(t('common.deleted'));
      leaveProjectsList();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const openProjectEdit = async () => {
    if (!project) return;
    selectedOwnerRef.current = project.owner_id ?? undefined;
    selectedMembersRef.current = project.members ?? [];
    const res = await deliveryProcessTemplateApi.list({ limit: 100, is_active: true });
    setTemplates(res.items);
    let memberUuids: string[] = [];
    const memberIds = (project.members ?? []).map((m) => m.user_id);
    if (memberIds.length > 0) {
      try {
        const resolved = await resolveUserDisplay({ user_ids: memberIds });
        memberUuids = resolved.map((u) => u.uuid).filter(Boolean);
      } catch {
        memberUuids = [];
      }
    }
    let ownerUuid: string | undefined;
    if (project.owner_id) {
      try {
        const resolved = await resolveUserDisplay({ user_ids: [project.owner_id] });
        ownerUuid = resolved[0]?.uuid;
      } catch {
        ownerUuid = undefined;
      }
    }
    editFormRef.current?.resetFields();
    editFormRef.current?.setFieldsValue({
      project_name: project.project_name,
      process_template_id: project.process_template_id,
      delivery_date: project.delivery_date ? dayjs(project.delivery_date) : undefined,
      notes: project.notes,
      owner_uuid: ownerUuid,
      member_uuids: memberUuids,
    });
    setEditOpen(true);
  };

  const handleProjectUpdate = async (values: Record<string, unknown>) => {
    if (!projectId || !project) return;
    const deliveryDate = values.delivery_date as dayjs.Dayjs | undefined;
    await deliveryProjectApi.update(projectId, {
      project_name: values.project_name as string,
      delivery_date: deliveryDate?.format('YYYY-MM-DD'),
      owner_id: selectedOwnerRef.current,
      members: selectedMembersRef.current,
      notes: values.notes as string | undefined,
    });
    message.success(t('common.updated'));
    setEditOpen(false);
    await load();
  };

  const editTemplateOptions = useMemo(
    () => templates.map((tpl) => ({ label: tpl.template_name, value: tpl.id })),
    [templates],
  );

  const openCreateReport = (node?: DeliveryProjectNode) => {
    reportForm.resetFields();
    reportForm.setFieldsValue({
      node_id: node?.id,
      progress_percent: Number(node?.progress_percent ?? 0),
      status: 'draft',
      report_date: dayjs(),
    });
    setReportModalOpen(true);
  };

  const openCreateIssue = (node?: DeliveryProjectNode) => {
    issueForm.resetFields();
    issueForm.setFieldsValue({
      node_id: node?.id,
      issue_type: 'quality',
      priority: 'medium',
      status: 'open',
    });
    setIssueModalOpen(true);
  };

  const openSalesOrderForPush = () => {
    const salesOrderId = project?.sales_order_id;
    if (!salesOrderId) return;
    if (linkedDetail?.openLinkedDocumentDetail('sales_order', salesOrderId)) return;
    navigate(`/apps/kuaizhizao/sales-management/sales-orders?salesOrderId=${salesOrderId}`);
  };

  const openInstallExecution = () => {
    const salesOrderId = project?.sales_order_id;
    if (!salesOrderId) return;
    navigate(
      `/apps/kuaizhizao/after-sales-service/install-execution?action=pull&sales_order_id=${salesOrderId}`,
    );
  };

  const openChangeTemplateModal = async () => {
    const res = await deliveryProcessTemplateApi.list({ limit: 100, is_active: true });
    setTemplateOptions(res.items);
    setSelectedTemplateId(project?.process_template_id ?? undefined);
    setTemplateModalOpen(true);
  };

  const saveChangeTemplate = async () => {
    if (!projectId || !selectedTemplateId) return;
    try {
      const updated = await deliveryProjectApi.changeTemplate(projectId, selectedTemplateId);
      setProject(updated);
      message.success(t('app.kuaizhizao.deliveryProject.templateChanged'));
      setTemplateModalOpen(false);
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const openNodeScheduleModal = async (node: DeliveryProjectNode) => {
    nodeScheduleOwnerRef.current = node.owner_id ?? undefined;
    setNodeScheduleEditing(node);
    nodeScheduleForm.resetFields();
    let ownerUuid: string | undefined;
    if (node.owner_id) {
      try {
        const resolved = await resolveUserDisplay({ user_ids: [node.owner_id] });
        ownerUuid = resolved[0]?.uuid;
      } catch {
        ownerUuid = undefined;
      }
    }
    nodeScheduleForm.setFieldsValue({
      owner_uuid: ownerUuid,
      planned_start_date: node.planned_start_date ? dayjs(node.planned_start_date) : undefined,
      planned_end_date: node.planned_end_date ? dayjs(node.planned_end_date) : undefined,
      actual_start_date: node.actual_start_date ? dayjs(node.actual_start_date) : undefined,
      actual_end_date: node.actual_end_date ? dayjs(node.actual_end_date) : undefined,
    });
    setNodeScheduleModalOpen(true);
  };

  const saveNodeSchedule = async () => {
    if (!projectId || !nodeScheduleEditing) return;
    try {
      const values = await nodeScheduleForm.validateFields();
      const fmt = (v: dayjs.Dayjs | undefined) => v?.format('YYYY-MM-DD');
      await deliveryProjectApi.updateNode(projectId, nodeScheduleEditing.id, {
        owner_id: nodeScheduleOwnerRef.current ?? null,
        planned_start_date: fmt(values.planned_start_date as dayjs.Dayjs | undefined),
        planned_end_date: fmt(values.planned_end_date as dayjs.Dayjs | undefined),
        actual_start_date: fmt(values.actual_start_date as dayjs.Dayjs | undefined),
        actual_end_date: fmt(values.actual_end_date as dayjs.Dayjs | undefined),
      });
      message.success(t('common.updated'));
      setNodeScheduleModalOpen(false);
      setNodeScheduleEditing(null);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const handleStartNode = (node: DeliveryProjectNode) => {
    if (!projectId) return;
    void runAction(
      async () => {
        await deliveryProjectApi.startNode(projectId, node.id);
        return (await deliveryProjectApi.getWorkbench(projectId)) as DeliveryProject;
      },
      'app.kuaizhizao.deliveryProject.nodeStarted',
    );
  };

  const confirmCompleteNode = (node: DeliveryProjectNode) => {
    if (!projectId) return;
    void runAction(
      async () => {
        await deliveryProjectApi.completeNode(projectId, node.id);
        return (await deliveryProjectApi.getWorkbench(projectId)) as DeliveryProject;
      },
      'app.kuaizhizao.deliveryProject.nodeCompleted',
    );
  };

  const openDocLinkModal = (node: DeliveryProjectNode) => {
    setDocLinkNode(node);
    docLinkForm.resetFields();
    docLinkForm.setFieldsValue({ node_id: node.id });
    setDocLinkModalOpen(true);
  };

  const saveDocLink = async () => {
    if (!projectId) return;
    try {
      const values = await docLinkForm.validateFields();
      await deliveryProjectApi.linkNodeDocument(projectId, {
        node_id: values.node_id as number,
        doc_type: values.doc_type as string,
        doc_id: values.doc_id as number,
        doc_code: values.doc_code as string,
        title: values.title as string | undefined,
      });
      message.success(t('common.updated'));
      setDocLinkModalOpen(false);
      setDocLinkNode(null);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const confirmUnlinkDoc = async (link: DeliveryProjectNodeDocument) => {
    if (!projectId) return;
    await deliveryProjectApi.unlinkNodeDocument(projectId, link.id);
    message.success(t('common.deleted'));
    await load();
  };

  const openLinkedDoc = (link: DeliveryProjectNodeDocument) => {
    if (link.doc_type === 'rd_project') {
      navigate(`/apps/kuaiplm/rd-projects/detail/${link.doc_id}`);
      return;
    }
    if (link.doc_type === 'quality_inspection') {
      navigate(`/apps/kuaizhizao/quality-management/inspections?highlight=${link.doc_id}`);
      return;
    }
    linkedDetail?.openLinkedDocumentDetail(link.doc_type, link.doc_id);
  };

  const openTaskModal = async (node: DeliveryProjectNode, task?: DeliveryProjectNodeTask) => {
    setTaskEditingNode(node);
    setEditingTask(task ?? null);
    taskOwnerRef.current = task?.owner_id ?? undefined;
    taskOwnerNameRef.current = task?.owner_name ?? undefined;
    taskMembersRef.current = task?.members ?? [];
    taskForm.resetFields();
    let ownerUuid: string | undefined;
    let memberUuids: string[] = [];
    const ids = [
      ...(task?.owner_id ? [task.owner_id] : []),
      ...(task?.members ?? []).map((m) => m.user_id),
    ];
    if (ids.length > 0) {
      try {
        const resolved = await resolveUserDisplay({ user_ids: ids });
        ownerUuid = task?.owner_id
          ? resolved.find((u) => u.id === task.owner_id)?.uuid
          : undefined;
        memberUuids = resolved
          .filter((u) => (task?.members ?? []).some((m) => m.user_id === u.id))
          .map((u) => u.uuid)
          .filter(Boolean);
      } catch {
        /* ignore */
      }
    }
    taskForm.setFieldsValue({
      task_name: task?.task_name,
      status: task?.status ?? 'todo',
      owner_uuid: ownerUuid,
      member_uuids: memberUuids,
      planned_start_date: task?.planned_start_date ? dayjs(task.planned_start_date) : undefined,
      planned_end_date: task?.planned_end_date ? dayjs(task.planned_end_date) : undefined,
      actual_start_date: task?.actual_start_date ? dayjs(task.actual_start_date) : undefined,
      actual_end_date: task?.actual_end_date ? dayjs(task.actual_end_date) : undefined,
    });
    setTaskModalOpen(true);
  };

  const saveNodeTask = async () => {
    if (!projectId || !taskEditingNode) return;
    try {
      const values = await taskForm.validateFields();
      const fmt = (v: dayjs.Dayjs | undefined) => v?.format('YYYY-MM-DD');
      const payload = {
        node_id: taskEditingNode.id,
        task_name: values.task_name as string,
        status: values.status as string,
        owner_id: taskOwnerRef.current ?? null,
        owner_name: taskOwnerNameRef.current ?? null,
        members: taskMembersRef.current,
        planned_start_date: fmt(values.planned_start_date as dayjs.Dayjs | undefined),
        planned_end_date: fmt(values.planned_end_date as dayjs.Dayjs | undefined),
        actual_start_date: fmt(values.actual_start_date as dayjs.Dayjs | undefined),
        actual_end_date: fmt(values.actual_end_date as dayjs.Dayjs | undefined),
      };
      if (editingTask?.id) {
        await deliveryProjectApi.updateNodeTask(projectId, editingTask.id, payload);
      } else {
        await deliveryProjectApi.createNodeTask(projectId, payload);
      }
      message.success(t('common.updated'));
      setTaskModalOpen(false);
      setEditingTask(null);
      setTaskEditingNode(null);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const confirmDeleteNodeTask = async (task: DeliveryProjectNodeTask) => {
    if (!projectId) return;
    await deliveryProjectApi.deleteNodeTask(projectId, task.id);
    message.success(t('common.deleted'));
    await load();
  };

  const saveReport = async () => {
    if (!projectId) return;
    try {
      const values = await reportForm.validateFields();
      const reportDate = values.report_date as dayjs.Dayjs;
      await deliveryNodeReportApi.create({
        project_id: projectId,
        node_id: values.node_id as number,
        report_date: reportDate.format('YYYY-MM-DD'),
        progress_percent: values.progress_percent as number,
        content: values.content as string | undefined,
      });
      message.success(t('common.created'));
      setReportModalOpen(false);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const saveIssue = async () => {
    if (!projectId) return;
    try {
      const values = await issueForm.validateFields();
      const dueDate = values.due_date as dayjs.Dayjs | undefined;
      await deliveryIssueApi.create({
        project_id: projectId,
        node_id: values.node_id as number | undefined,
        title: values.title as string,
        issue_type: values.issue_type as string,
        priority: values.priority as string,
        description: values.description as string | undefined,
        due_date: dueDate?.format('YYYY-MM-DD'),
      });
      message.success(t('common.created'));
      setIssueModalOpen(false);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const contentReady = Boolean(project);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = project ?? PLACEHOLDER;

  const nodes = useMemo(
    () =>
      [...(effective.nodes ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0),
      ),
    [effective.nodes],
  );

  useEffect(() => {
    if (nodes.length === 0) return;
    if (activeNodeKey && nodes.some((n) => n.node_key === activeNodeKey)) return;
    const current = nodes.find((n) => n.node_key === effective.current_node_key);
    const firstOpen = nodes.find((n) => n.status !== 'completed');
    setActiveNodeKey(current?.node_key ?? firstOpen?.node_key ?? nodes[0].node_key);
  }, [nodes, effective.current_node_key, activeNodeKey]);

  const activeNode = nodes.find((n) => n.node_key === activeNodeKey);
  const progressPercent = Math.round(Number(effective.progress_percent ?? 0));
  const progressStatus = useMemo(() => {
    if (nodes.some((n) => n.status === 'overdue')) return 'exception' as const;
    if (effective.status === 'completed') return 'success' as const;
    return 'active' as const;
  }, [nodes, effective.status]);

  const allNodesDone = useMemo(
    () => (effective.nodes ?? []).length > 0 && (effective.nodes ?? []).every((n) => n.status === 'completed'),
    [effective.nodes],
  );

  const atShippingOrCompleted = useMemo(() => {
    if (effective.status === 'completed') return true;
    const shippingNode = (effective.nodes ?? []).find((n) => n.node_key === 'shipping');
    if (!shippingNode) return allNodesDone;
    return (
      effective.current_node_key === 'shipping' ||
      shippingNode.status === 'in_progress' ||
      shippingNode.status === 'completed'
    );
  }, [allNodesDone, effective.current_node_key, effective.nodes, effective.status]);

  const canCompleteProject =
    canUpdate && effective.status === 'in_progress' && (allNodesDone || atShippingOrCompleted);

  const showDownstreamPush =
    Boolean(effective.sales_order_id) &&
    (atShippingOrCompleted || effective.status === 'completed');

  const extra = contentReady && (canUpdate || canDelete || showDownstreamPush) ? (
    <Space wrap>
      {canUpdate && ['draft', 'paused'].includes(effective.status) ? (
        <Button onClick={() => void openProjectEdit()}>{t('common.edit')}</Button>
      ) : null}
      {effective.status === 'draft' && canUpdate ? (
        <Button type="primary" onClick={() => void handleStart()}>
          {t('app.kuaizhizao.deliveryProject.startProject')}
        </Button>
      ) : null}
      {canCompleteProject ? (
        <Popconfirm
          title={t('app.kuaizhizao.deliveryProject.completeProjectConfirm')}
          onConfirm={() => handleCompleteProject()}
        >
          <Button type="primary">{t('app.kuaizhizao.deliveryProject.completeProject')}</Button>
        </Popconfirm>
      ) : null}
      {effective.status === 'in_progress' && canUpdate ? (
        <Button onClick={() => void handlePause()}>{t('app.kuaizhizao.deliveryProject.pauseProject')}</Button>
      ) : null}
      {effective.status === 'paused' && canUpdate ? (
        <>
          <Button type="primary" onClick={() => void handleResume()}>
            {t('app.kuaizhizao.deliveryProject.resumeProject')}
          </Button>
          <Button onClick={() => void openChangeTemplateModal()}>
            {t('app.kuaizhizao.deliveryProject.changeTemplate')}
          </Button>
        </>
      ) : null}
      {showDownstreamPush ? (
        <>
          <Button onClick={openSalesOrderForPush}>{pushShipmentAction.label}</Button>
          <Button onClick={openInstallExecution}>{createInstallAction.label}</Button>
        </>
      ) : null}
      {effective.status === 'draft' && canDelete ? (
        <Popconfirm
          title={t('app.kuaizhizao.deliveryProject.deleteProjectConfirm')}
          onConfirm={() => void handleDeleteProject()}
        >
          <Button danger>{t('common.delete')}</Button>
        </Popconfirm>
      ) : null}
      {!['completed', 'cancelled'].includes(effective.status) && canUpdate ? (
        <Popconfirm
          title={t('app.kuaizhizao.deliveryProject.cancelProjectConfirm')}
          onConfirm={() => handleCancelProject()}
        >
          <Button danger>{t('app.kuaizhizao.deliveryProject.cancelProject')}</Button>
        </Popconfirm>
      ) : null}
    </Space>
  ) : null;

  if (showLoading && !contentReady) {
    return (
      <ListPageTemplate>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </ListPageTemplate>
    );
  }

  if (showError) {
    return (
      <ListPageTemplate>
        <Result
          status="error"
          title={error}
          extra={
            <Button type="primary" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          }
        />
      </ListPageTemplate>
    );
  }

  const nodeOptions = nodes.map((n) => ({ label: n.node_name, value: n.id }));

  const renderNodePanel = (node: DeliveryProjectNode) => {
    const nodeTasks = node.tasks ?? [];
    const nodeDocs = nodeDocuments.filter((d) => d.node_id === node.id);
    const canNodeAction = (canUpdate || canExecute) && !['completed', 'cancelled'].includes(effective.status);
    const showActualDates = node.status !== 'not_started';
    return (
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <Card
          size="small"
          className="delivery-project-node-section-card"
          title={t('app.kuaizhizao.deliveryProject.workbench.section.nodeInfo')}
          extra={
            canNodeAction ? (
              <Space wrap>
                <Button size="small" onClick={() => void openNodeScheduleModal(node)}>
                  {t('app.kuaizhizao.deliveryProject.editNodeSchedule')}
                </Button>
                {node.status === 'not_started' && (canExecute || canUpdate) ? (
                  <Button size="small" type="primary" onClick={() => handleStartNode(node)}>
                    {t('app.kuaizhizao.deliveryProject.startNode')}
                  </Button>
                ) : null}
                {node.status !== 'completed' && node.status !== 'not_started' && (canExecute || canUpdate) ? (
                  <Popconfirm
                    title={t('app.kuaizhizao.deliveryProject.completeNodeConfirm')}
                    onConfirm={() => confirmCompleteNode(node)}
                  >
                    <Button size="small">{t('app.kuaizhizao.deliveryProject.completeNode')}</Button>
                  </Popconfirm>
                ) : null}
                <Button size="small" onClick={() => openCreateReport(node)}>
                  {t('app.kuaizhizao.deliveryProject.createReport')}
                </Button>
                <Button size="small" onClick={() => openCreateIssue(node)}>
                  {t('app.kuaizhizao.deliveryProject.createIssue')}
                </Button>
              </Space>
            ) : null
          }
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.status')}>
              {renderDeliveryStatusTag(node.status, DELIVERY_NODE_STATUS)}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}>
              {node.owner_name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.progress')}>
              {renderDeliveryProgressCell(node.progress_percent, t, {
                status: resolveDeliveryProgressStatus(String(node.status ?? ''), node.progress_percent),
              })}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.plannedStartDate')}>
              {formatBusinessDateOnly(node.planned_start_date) || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.plannedEndDate')}>
              <Typography.Text type={node.status === 'overdue' ? 'danger' : undefined}>
                {formatBusinessDateOnly(node.planned_end_date) || '—'}
              </Typography.Text>
            </Descriptions.Item>
            {showActualDates ? (
              <>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.actualStartDate')}>
                  {formatBusinessDateOnly(node.actual_start_date) || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.actualEndDate')}>
                  {formatBusinessDateOnly(node.actual_end_date) || '—'}
                </Descriptions.Item>
              </>
            ) : null}
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.isCritical')}>
              {node.is_critical ? t('common.yes') : t('common.no')}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.isMilestone')}>
              {node.is_milestone ? <MarkerTag variant="filled" color="gold">{t('common.yes')}</MarkerTag> : t('common.no')}
            </Descriptions.Item>
            <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.taskCount')}>
              {nodeTasks.length}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          size="small"
          className="delivery-project-node-section-card"
          title={t('app.kuaizhizao.deliveryProject.workbench.section.linkedDocuments')}
          extra={
            canUpdate ? (
              <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => openDocLinkModal(node)}>
                {t('app.kuaizhizao.deliveryProject.linkDocument')}
              </Button>
            ) : null
          }
        >
          <Table
            rowKey="id"
            size="small"
            tableLayout="fixed"
            className="delivery-project-workbench-node-table"
            pagination={false}
            locale={{ emptyText: t('app.kuaizhizao.deliveryProject.noLinkedDocuments') }}
            dataSource={nodeDocs}
            columns={[
              {
                title: t('app.kuaizhizao.deliveryProject.fields.docType'),
                dataIndex: 'doc_type',
                width: 88,
                ellipsis: true,
                render: (v: string) => DELIVERY_NODE_DOCUMENT_TYPES[v] ?? v,
              },
              {
                title: t('app.kuaizhizao.deliveryProject.fields.docCode'),
                dataIndex: 'doc_code',
                ellipsis: true,
                render: (_: unknown, row: DeliveryProjectNodeDocument) => (
                  <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => openLinkedDoc(row)}>
                    {row.doc_code}
                  </Button>
                ),
              },
              {
                title: t('common.actions'),
                width: 56,
                render: (_: unknown, row: DeliveryProjectNodeDocument) =>
                  canUpdate ? (
                    <Popconfirm
                      title={t('app.kuaizhizao.deliveryProject.unlinkDocumentConfirm')}
                      onConfirm={() => void confirmUnlinkDoc(row)}
                    >
                      <Button type="link" size="small" danger>
                        {t('app.kuaizhizao.deliveryProject.unlinkDocument')}
                      </Button>
                    </Popconfirm>
                  ) : null,
              },
            ]}
          />
        </Card>

        <Card
          size="small"
          className="delivery-project-node-section-card"
          title={`${t('app.kuaizhizao.deliveryProject.nodeTasks')} (${nodeTasks.length})`}
          extra={
            canUpdate ? (
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => void openTaskModal(node)}>
                {t('app.kuaizhizao.deliveryProject.addNodeTask')}
              </Button>
            ) : null
          }
        >
          <Table
            rowKey="id"
            size="small"
            tableLayout="fixed"
            className="delivery-project-workbench-node-table"
            pagination={false}
            locale={{ emptyText: t('app.kuaizhizao.deliveryProject.noNodeTasks') }}
            dataSource={nodeTasks}
            columns={[
              { title: t('app.kuaizhizao.deliveryProject.fields.taskName'), dataIndex: 'task_name', ellipsis: true },
              {
                title: t('app.kuaizhizao.deliveryProject.fields.ownerName'),
                dataIndex: 'owner_name',
                width: 80,
                ellipsis: true,
                render: (v) => v || '—',
              },
              {
                title: t('app.kuaizhizao.deliveryProject.fields.members'),
                dataIndex: 'members',
                width: 100,
                ellipsis: true,
                render: (members: DeliveryMember[] | undefined) =>
                  members?.length
                    ? members.map((m) => m.user_name || String(m.user_id)).join('、')
                    : '—',
              },
              {
                title: t('app.kuaizhizao.deliveryProject.fields.plannedEndDate'),
                dataIndex: 'planned_end_date',
                width: 96,
                render: (v) => formatBusinessDateOnly(v) || '—',
              },
              {
                title: t('app.kuaizhizao.deliveryProject.fields.status'),
                dataIndex: 'status',
                width: 80,
                render: (v) => renderDeliveryStatusTag(String(v), DELIVERY_NODE_TASK_STATUS),
              },
              ...(canUpdate
                ? [
                    {
                      title: t('common.actions'),
                      width: 104,
                      render: (_: unknown, task: DeliveryProjectNodeTask) => (
                        <Space size="small">
                          <Button type="link" size="small" onClick={() => void openTaskModal(node, task)}>
                            {t('common.edit')}
                          </Button>
                          <Popconfirm
                            title={t('app.kuaizhizao.deliveryProject.deleteNodeTaskConfirm')}
                            onConfirm={() => void confirmDeleteNodeTask(task)}
                          >
                            <Button type="link" size="small" danger>
                              {t('common.delete')}
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      </Space>
    );
  };

  const collabShortcuts = [
    {
      key: 'reports',
      title: t('app.kuaizhizao.deliveryProject.workbench.openReportsList'),
      count: reports.length,
      icon: FileTextOutlined,
      path: `/apps/kuaizhizao/delivery-project/node-reports?project_id=${projectId}`,
    },
    {
      key: 'issues',
      title: t('app.kuaizhizao.deliveryProject.workbench.openIssuesList'),
      count: issues.length,
      icon: BugOutlined,
      path: `/apps/kuaizhizao/delivery-project/issues?project_id=${projectId}`,
    },
  ];

  const relatedPanel = (
    <Descriptions column={1} size="small">
      <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.customerName')}>
        {effective.customer_name || '—'}
      </Descriptions.Item>
      <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.salesOrderCode')}>
        {effective.sales_order_id && effective.sales_order_code ? (
          <LinkedDocumentCode
            documentType="sales_order"
            documentId={effective.sales_order_id}
            code={effective.sales_order_code}
          />
        ) : (
          '—'
        )}
      </Descriptions.Item>
      <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.processTemplate')}>
        {effective.process_template_name || '—'}
      </Descriptions.Item>
      <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.workbench.linkedRdProject')}>
        {linkedRdProject ? (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/apps/kuaiplm/rd-projects/detail/${linkedRdProject.id}`)}
          >
            {linkedRdProject.project_code} {linkedRdProject.project_name}
          </Button>
        ) : (
          '—'
        )}
      </Descriptions.Item>
      {showDownstreamPush ? (
        <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.workbench.section.downstream')}>
          <Space wrap>
            <Button size="small" onClick={openSalesOrderForPush}>
              {pushShipmentAction.label}
            </Button>
            <Button size="small" onClick={openInstallExecution}>
              {createInstallAction.label}
            </Button>
          </Space>
        </Descriptions.Item>
      ) : null}
      {nodeDocuments.length > 0 ? (
        <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.workbench.section.allLinkedDocuments')}>
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            {nodeDocuments.map((doc) => (
              <Space key={doc.id} wrap>
                <Typography.Text type="secondary">{doc.node_name}</Typography.Text>
                <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => openLinkedDoc(doc)}>
                  {DELIVERY_NODE_DOCUMENT_TYPES[doc.doc_type] ?? doc.doc_type} {doc.doc_code}
                </Button>
              </Space>
            ))}
          </Space>
        </Descriptions.Item>
      ) : null}
    </Descriptions>
  );

  return (
    <>
    <ListPageTemplate>
      <Space orientation="vertical" size="medium" className="project-workbench-shell">
        <ProjectWorkbenchToolbar
          backLabel={t('app.kuaizhizao.deliveryProject.workbench.backToList')}
          onBack={leaveProjectsList}
          title={`${effective.project_code} - ${effective.project_name}`}
          status={renderDeliveryStatusTag(effective.status, DELIVERY_PROJECT_STATUS)}
          actions={extra}
        />

        <Card size="small" className="project-workbench-overview">
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={16}>
              <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.material')}>
                  {[effective.material_code, effective.material_name].filter(Boolean).join(' ') || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}>
                  {effective.owner_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.members')}>
                  {(effective.members ?? []).length
                    ? (effective.members ?? [])
                        .map((m) => m.user_name || String(m.user_id))
                        .join('、')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.currentNode')}>
                  {effective.current_node_name || activeNode?.node_name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.deliveryDate')}>
                  {formatBusinessDateOnly(effective.delivery_date) || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.customerName')}>
                  {effective.customer_name || '—'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Typography.Text className="project-workbench-overview-side-title">
                {t('app.kuaizhizao.deliveryProject.fields.progress')}
              </Typography.Text>
              <Progress percent={progressPercent} status={progressStatus} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('app.kuaizhizao.deliveryProject.workbench.progressDetail.nodes')} 40% -{' '}
                {t('app.kuaizhizao.deliveryProject.workbench.progressDetail.tasks')} 30%{' '}
                {t('app.kuaizhizao.deliveryProject.workbench.progressDetail.reports')} 30%
              </Typography.Text>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            {nodes.length > 0 ? (
              <Card size="small" styles={{ body: { paddingTop: 12 } }}>
                <DeliveryProjectNodeStepper
                  nodes={nodes}
                  activeNodeKey={activeNodeKey}
                  onChange={setActiveNodeKey}
                />
                <div className="delivery-project-node-panel" style={{ marginTop: 16 }}>
                  {activeNode ? renderNodePanel(activeNode) : null}
                </div>
              </Card>
            ) : (
              <Card>
                <Empty description={t('app.kuaizhizao.deliveryProject.workbench.empty.nodes')} />
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            <Card
              size="small"
              title={t('app.kuaizhizao.deliveryProject.workbench.tabs.related')}
              style={{ marginBottom: 16 }}
            >
              {relatedPanel}
            </Card>

            <Card
              size="small"
              title={t('app.kuaizhizao.deliveryProject.workbench.section.collaboration')}
              style={{ marginBottom: 16 }}
            >
              <Row gutter={[8, 8]}>
                {collabShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Col span={12} key={item.key}>
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

            <Card
              size="small"
              title={t('app.kuaizhizao.deliveryProject.recentReports')}
              extra={
                canUpdate ? (
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreateReport(activeNode)}>
                    {t('app.kuaizhizao.deliveryProject.createReport')}
                  </Button>
                ) : null
              }
              style={{ marginBottom: 16 }}
            >
              <Table
                rowKey="id"
                size="small"
                tableLayout="fixed"
                className="delivery-project-workbench-side-table"
                pagination={false}
                dataSource={reports}
                locale={{ emptyText: t('app.kuaizhizao.deliveryProject.workbench.collabEmpty') }}
                columns={[
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.reportCode'),
                    dataIndex: 'report_code',
                    width: WORKBENCH_SIDE_CODE_COL,
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
                    dataIndex: 'node_name',
                    width: WORKBENCH_SIDE_NODE_COL,
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.status'),
                    dataIndex: 'status',
                    width: WORKBENCH_SIDE_BADGE_COL,
                    render: (v) => renderDeliveryStatusTag(v, DELIVERY_NODE_REPORT_STATUS),
                  },
                ]}
              />
            </Card>

            <Card
              size="small"
              title={t('app.kuaizhizao.deliveryProject.recentIssues')}
              extra={
                canUpdate ? (
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreateIssue(activeNode)}>
                    {t('app.kuaizhizao.deliveryProject.createIssue')}
                  </Button>
                ) : null
              }
            >
              <Table
                rowKey="id"
                size="small"
                tableLayout="fixed"
                className="delivery-project-workbench-side-table"
                pagination={false}
                dataSource={issues}
                locale={{ emptyText: t('app.kuaizhizao.deliveryProject.workbench.collabEmpty') }}
                columns={[
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.issueCode'),
                    dataIndex: 'issue_code',
                    width: WORKBENCH_SIDE_CODE_COL,
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.title'),
                    dataIndex: 'title',
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.deliveryProject.fields.priority'),
                    dataIndex: 'priority',
                    width: WORKBENCH_SIDE_PRIORITY_COL,
                    render: (v) => renderDeliveryIssuePriorityTag(v),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    </ListPageTemplate>
    <Modal
      title={`${t('app.kuaizhizao.deliveryProject.editNodeSchedule')}${nodeScheduleEditing?.node_name ? ` - ${nodeScheduleEditing.node_name}` : ''}`}
      open={nodeScheduleModalOpen}
      onCancel={() => setNodeScheduleModalOpen(false)}
      onOk={() => void saveNodeSchedule()}
      destroyOnHidden
    >
      <Form form={nodeScheduleForm} layout="vertical">
        <UniUserSelect
          name="owner_uuid"
          label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}
          onChange={(_value, user) => {
            const picked = Array.isArray(user) ? user[0] : user;
            nodeScheduleOwnerRef.current = picked?.id;
          }}
        />
        <Form.Item name="planned_start_date" label={t('app.kuaizhizao.deliveryProject.fields.plannedStartDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="planned_end_date" label={t('app.kuaizhizao.deliveryProject.fields.plannedEndDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        {nodeScheduleEditing && nodeScheduleEditing.status !== 'not_started' ? (
          <>
            <Form.Item name="actual_start_date" label={t('app.kuaizhizao.deliveryProject.fields.actualStartDate')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="actual_end_date" label={t('app.kuaizhizao.deliveryProject.fields.actualEndDate')}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </>
        ) : null}
      </Form>
    </Modal>
    <Modal
      title={t('app.kuaizhizao.deliveryProject.linkDocument')}
      open={docLinkModalOpen}
      onCancel={() => setDocLinkModalOpen(false)}
      onOk={() => void saveDocLink()}
      destroyOnHidden
    >
      <Form form={docLinkForm} layout="vertical">
        <DeliveryNodeDocumentSelect
          customerId={project?.customer_id}
          salesOrderId={project?.sales_order_id}
        />
        <Form.Item name="node_id" hidden>
          <InputNumber />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      title={t('app.kuaizhizao.deliveryProject.changeTemplate')}
      open={templateModalOpen}
      onCancel={() => setTemplateModalOpen(false)}
      onOk={() => void saveChangeTemplate()}
      destroyOnHidden
    >
      <Select
        style={{ width: '100%' }}
        placeholder={t('app.kuaizhizao.deliveryProject.fields.processTemplate')}
        value={selectedTemplateId}
        options={templateOptions.map((tpl) => ({
          value: tpl.id,
          label: tpl.template_name,
        }))}
        onChange={(value) => setSelectedTemplateId(value)}
      />
    </Modal>
    <Modal
      title={
        editingTask
          ? t('app.kuaizhizao.deliveryProject.editNodeTask')
          : t('app.kuaizhizao.deliveryProject.addNodeTask')
      }
      open={taskModalOpen}
      onCancel={() => {
        setTaskModalOpen(false);
        setEditingTask(null);
        setTaskEditingNode(null);
      }}
      onOk={() => void saveNodeTask()}
      destroyOnHidden
    >
      <Form form={taskForm} layout="vertical">
        <Form.Item
          name="task_name"
          label={t('app.kuaizhizao.deliveryProject.fields.taskName')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="status" label={t('app.kuaizhizao.deliveryProject.fields.status')} initialValue="todo">
          <Select
            options={Object.entries(DELIVERY_NODE_TASK_STATUS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Form.Item>
        <UniUserSelect
          name="owner_uuid"
          label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}
          onChange={(_value, user) => {
            const picked = Array.isArray(user) ? user[0] : user;
            taskOwnerRef.current = picked?.id;
            taskOwnerNameRef.current = picked
              ? picked.full_name || picked.username || ''
              : undefined;
            if (picked?.id) {
              taskMembersRef.current = taskMembersRef.current.filter((m) => m.user_id !== picked.id);
            }
          }}
        />
        <UniUserSelect
          name="member_uuids"
          label={t('app.kuaizhizao.deliveryProject.fields.members')}
          mode="multiple"
          onChange={(_value, users) => {
            const list = (Array.isArray(users) ? users : users ? [users] : []) as User[];
            taskMembersRef.current = list
              .filter((u) => u?.id && u.id !== taskOwnerRef.current)
              .map((u) => ({
                user_id: u.id,
                user_name: u.full_name || u.username || '',
              }));
          }}
        />
        <Form.Item name="planned_start_date" label={t('app.kuaizhizao.deliveryProject.fields.plannedStartDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="planned_end_date" label={t('app.kuaizhizao.deliveryProject.fields.plannedEndDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="actual_start_date" label={t('app.kuaizhizao.deliveryProject.fields.actualStartDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="actual_end_date" label={t('app.kuaizhizao.deliveryProject.fields.actualEndDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      title={t('app.kuaizhizao.deliveryProject.createReport')}
      open={reportModalOpen}
      onCancel={() => setReportModalOpen(false)}
      onOk={() => void saveReport()}
      destroyOnHidden
    >
      <Form form={reportForm} layout="vertical">
        <Form.Item name="node_id" label={t('app.kuaizhizao.deliveryProject.fields.nodeName')} rules={[{ required: true }]}>
          <Select options={nodeOptions} placeholder={t('common.pleaseSelect')} />
        </Form.Item>
        <Form.Item name="report_date" label={t('app.kuaizhizao.deliveryProject.fields.reportDate')} rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="progress_percent" label={t('app.kuaizhizao.deliveryProject.fields.progress')} rules={[{ required: true }]}>
          <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
        </Form.Item>
        <Form.Item name="content" label={t('app.kuaizhizao.deliveryProject.fields.reportContent')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      title={t('app.kuaizhizao.deliveryProject.createIssue')}
      open={issueModalOpen}
      onCancel={() => setIssueModalOpen(false)}
      onOk={() => void saveIssue()}
      destroyOnHidden
    >
      <Form form={issueForm} layout="vertical">
        <Form.Item name="node_id" label={t('app.kuaizhizao.deliveryProject.fields.nodeName')}>
          <Select allowClear options={nodeOptions} placeholder={t('common.pleaseSelect')} />
        </Form.Item>
        <Form.Item name="title" label={t('app.kuaizhizao.deliveryProject.fields.title')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="issue_type" label={t('app.kuaizhizao.deliveryProject.fields.issueType')} rules={[{ required: true }]}>
          <Select options={Object.entries(DELIVERY_ISSUE_TYPE).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="priority" label={t('app.kuaizhizao.deliveryProject.fields.priority')} rules={[{ required: true }]}>
          <Select options={Object.entries({ low: '低', medium: '中', high: '高', urgent: '紧急' }).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="due_date" label={t('app.kuaizhizao.deliveryProject.fields.dueDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="description" label={t('app.kuaizhizao.deliveryProject.fields.description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
    <FormModalTemplate
      title={t('app.kuaizhizao.deliveryProject.editDeliveryProject')}
      open={editOpen}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      onClose={() => setEditOpen(false)}
      formRef={editFormRef}
      grid
      onFinish={handleProjectUpdate}
    >
      <ProFormText
        name="project_name"
        label={t('app.kuaizhizao.deliveryProject.fields.projectName')}
        rules={[{ required: true }]}
        colProps={{ span: 12 }}
      />
      <ProFormSelect
        name="process_template_id"
        label={t('app.kuaizhizao.deliveryProject.fields.processTemplate')}
        rules={[{ required: true }]}
        colProps={{ span: 12 }}
        options={editTemplateOptions}
        disabled
      />
      <ProFormDatePicker
        name="delivery_date"
        label={t('app.kuaizhizao.deliveryProject.fields.deliveryDate')}
        colProps={{ span: 12 }}
        width="100%"
        fieldProps={{ style: { width: '100%' } }}
      />
      <UniUserSelect
        name="owner_uuid"
        label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}
        colProps={{ span: 12 }}
        onChange={(_value, user) => {
          const picked = Array.isArray(user) ? user[0] : user;
          selectedOwnerRef.current = picked?.id;
          if (picked?.id) {
            selectedMembersRef.current = selectedMembersRef.current.filter((m) => m.user_id !== picked.id);
          }
        }}
      />
      <UniUserSelect
        name="member_uuids"
        label={t('app.kuaizhizao.deliveryProject.fields.members')}
        mode="multiple"
        colProps={{ span: 12 }}
        onChange={(_value, users) => {
          const list = (Array.isArray(users) ? users : users ? [users] : []) as User[];
          selectedMembersRef.current = list
            .filter((u) => u?.id && u.id !== selectedOwnerRef.current)
            .map((u) => ({
              user_id: u.id,
              user_name: u.full_name || u.username || '',
            }));
        }}
      />
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.deliveryProject.fields.notes')} colProps={{ span: 24 }} />
    </FormModalTemplate>
    </>
  );
};

export default DeliveryProjectWorkbench;
