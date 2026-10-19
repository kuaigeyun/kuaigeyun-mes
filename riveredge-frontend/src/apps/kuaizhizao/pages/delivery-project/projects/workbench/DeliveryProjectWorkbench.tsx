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
  Segmented,
  Tabs,
  Timeline,
  Typography,
  Card,
  Row,
  Col,
  theme,
  Tooltip,
} from 'antd';
import {
  BugOutlined,
  FileTextOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PaperClipOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ProForm,
  ProFormDatePicker,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import DocumentAttachmentsField from '../../../../components/DocumentAttachmentsField';
import {
  mapAttachmentsToUploadList,
  normalizeDocumentAttachments,
  openDocumentAttachment,
} from '../../../../utils/documentAttachments';
import {
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  ProjectWorkbenchToolbar,
} from '../../../../../../components/layout-templates';
import { UniDetail } from '../../../../../../components/uni-detail';
import { useLeaveFormTab } from '../../../../../../components/uni-tabs/navigateClosingTab';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { useOptionalLinkedDocumentDetail } from '../../../../../../components/linked-document-detail/LinkedDocumentDetailContext';
import { resolveKuaizhizaoDocumentAction } from '../../../../constants/documentActionRegistry';
import { renderDeliveryProgressCell, resolveDeliveryProgressStatus } from '../../shared/deliveryProgressColumn';
import { renderDeliveryStatusTag } from '../../shared/deliveryListPresentation';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { formatBusinessDateOnly, formatDateTimeBySiteSetting } from '../../../../../../utils/format';
import { resolveUserDisplay, type User } from '../../../../../../services/user';
import { useCurrentUser } from '../../../../../../hooks/useCurrentUser';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import {
  deliveryIssueApi,
  deliveryNodeReportApi,
  deliveryProcessTemplateApi,
  deliveryProjectApi,
  DELIVERY_ISSUE_PRIORITY,
  DELIVERY_ISSUE_STATUS,
  DELIVERY_ISSUE_TYPE,
  DELIVERY_NODE_DOCUMENT_LIST_PATHS,
  DELIVERY_NODE_STATUS,
  DELIVERY_PROJECT_STATUS,
  DELIVERY_TASK_PARTICIPANT_MODE,
  type DeliveryIssue,
  type DeliveryLinkedRdProject,
  type DeliveryMember,
  type DeliveryNodeReport,
  type DeliveryProcessTemplate,
  type DeliveryProject,
  type DeliveryProjectNode,
  type DeliveryProjectNodeDocument,
  type DeliveryProjectNodeScheduleRevision,
  type DeliveryProjectNodeTask,
  type DeliveryWorkbenchRelatedAttachment,
} from '../../../../services/delivery-project';
import { UniUserSelect } from '../../../../../../components/uni-user-select';
import DeliveryProjectNodeStepper from '../../components/DeliveryProjectNodeStepper';
import DeliveryNodeTaskOperateModal from '../../components/DeliveryNodeTaskOperateModal';
import DeliveryNodeDocumentLinkModal from '../../components/DeliveryNodeDocumentLinkModal';
import DeliveryProjectGanttChart, {
  type DeliveryGanttViewMode,
  type DeliveryProjectGanttItem,
} from '../../components/DeliveryProjectGanttChart';
import DeliveryNodeReportDetailDrawer from '../../node-reports/components/DeliveryNodeReportDetailDrawer';
import DeliveryIssueDetailDrawer from '../../issues/components/DeliveryIssueDetailDrawer';
import { buildLinkedDocumentColumns } from '../../shared/deliveryLinkedDocumentPresentation';
import DeliveryWorkbenchTable from '../../shared/DeliveryWorkbenchTable';
import {
  buildWorkbenchNodeTaskColumns,
  buildWorkbenchRecentIssueColumns,
  buildWorkbenchRecentReportColumns,
} from '../../shared/deliveryWorkbenchTableColumns';
import { workbenchKeepWidth, workbenchRemainderFlex } from '../../shared/deliveryWorkbenchTableLayout';
import './workbench.less';

const PLACEHOLDER: DeliveryProject = {
  id: 0,
  project_code: '',
  project_name: '',
  status: 'draft',
  progress_percent: 0,
};

const RESOURCE = 'kuaizhizao:delivery-project';
const REPORT_RESOURCE = 'kuaizhizao:delivery-node-report';
const ISSUE_RESOURCE = 'kuaizhizao:delivery-issue';
const RIGHT_PANEL_COLLAPSED_STORAGE_KEY =
  'kuaizhizao.delivery-project.workbench.rightPanelCollapsed';

function readRightPanelCollapsed(): boolean {
  try {
    return window.localStorage.getItem(RIGHT_PANEL_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const DeliveryProjectWorkbench: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const leaveProjectsList = useLeaveFormTab('/apps/kuaizhizao/delivery-project/projects');
  const currentUser = useCurrentUser();
  const perms = useResourcePermissions(RESOURCE);
  const reportPerms = useResourcePermissions(REPORT_RESOURCE);
  const issuePerms = useResourcePermissions(ISSUE_RESOURCE);
  const canRead = perms.canRead;
  const canUpdate = perms.canUpdate;
  const canExecute = perms.canAction?.('execute') ?? false;
  const canParticipantAct = canExecute || canUpdate;
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
  const [nodeScheduleRevisions, setNodeScheduleRevisions] = useState<DeliveryProjectNodeScheduleRevision[]>([]);
  const [nodeScheduleRevisionsLoading, setNodeScheduleRevisionsLoading] = useState(false);
  const [nodeScheduleTab, setNodeScheduleTab] = useState<'edit' | 'history'>('edit');
  const [nodeScheduleForm] = Form.useForm();
  const nodeScheduleOwnerRef = useRef<number | undefined>();

  const formatNodeScheduleDate = (value: dayjs.Dayjs | undefined) =>
    value ? value.format('YYYY-MM-DD') : null;

  const hasNodeScheduleChanges = (
    node: DeliveryProjectNode,
    values: Record<string, unknown>,
    ownerId: number | undefined,
  ) => {
    const fmt = formatNodeScheduleDate;
    if ((ownerId ?? null) !== (node.owner_id ?? null)) return true;
    if (fmt(values.planned_start_date as dayjs.Dayjs | undefined) !== (node.planned_start_date ?? null)) {
      return true;
    }
    if (fmt(values.planned_end_date as dayjs.Dayjs | undefined) !== (node.planned_end_date ?? null)) {
      return true;
    }
    if (fmt(values.actual_start_date as dayjs.Dayjs | undefined) !== (node.actual_start_date ?? null)) {
      return true;
    }
    if (fmt(values.actual_end_date as dayjs.Dayjs | undefined) !== (node.actual_end_date ?? null)) {
      return true;
    }
    return false;
  };

  const renderNodeScheduleFieldLabel = (field: string) => {
    const keyMap: Record<string, string> = {
      owner_name: 'app.kuaizhizao.deliveryProject.fields.ownerName',
      planned_start_date: 'app.kuaizhizao.deliveryProject.fields.plannedStartDate',
      planned_end_date: 'app.kuaizhizao.deliveryProject.fields.plannedEndDate',
      actual_start_date: 'app.kuaizhizao.deliveryProject.fields.actualStartDate',
      actual_end_date: 'app.kuaizhizao.deliveryProject.fields.actualEndDate',
    };
    const key = keyMap[field];
    return key ? t(key) : field;
  };

  const formatNodeScheduleHistoryValue = (field: string, value?: string | null) => {
    if (value == null || value === '') return t('common.dash');
    if (field === 'owner_name') return value;
    if (field.endsWith('_date')) return formatBusinessDateOnly(value);
    return value;
  };
  const [nodeDocuments, setNodeDocuments] = useState<DeliveryProjectNodeDocument[]>([]);
  const [relatedAttachments, setRelatedAttachments] = useState<DeliveryWorkbenchRelatedAttachment[]>([]);
  const [attachmentsDrawerOpen, setAttachmentsDrawerOpen] = useState(false);
  const [docLinkModalOpen, setDocLinkModalOpen] = useState(false);
  const [docLinkNodeId, setDocLinkNodeId] = useState<number | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<DeliveryProcessTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalLayer, setTaskModalLayer] = useState<'substage' | 'task'>('task');
  const [taskOperateOpen, setTaskOperateOpen] = useState(false);
  const [taskOperating, setTaskOperating] = useState<DeliveryProjectNodeTask | null>(null);
  const [taskEditingNode, setTaskEditingNode] = useState<DeliveryProjectNode | null>(null);
  const [editingTask, setEditingTask] = useState<DeliveryProjectNodeTask | null>(null);
  const [taskForm] = ProForm.useForm();
  const taskOwnerRef = useRef<number | undefined>();
  const taskOwnerNameRef = useRef<string | undefined>();
  const taskMembersRef = useRef<DeliveryMember[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DeliveryNodeReport | null>(null);
  const [reportDetailOpen, setReportDetailOpen] = useState(false);
  const [reportDetailId, setReportDetailId] = useState<number>();
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<DeliveryIssue | null>(null);
  const [issueDetailOpen, setIssueDetailOpen] = useState(false);
  const [issueDetailId, setIssueDetailId] = useState<number>();
  const [reportForm] = Form.useForm();
  const [issueForm] = Form.useForm();
  const [editOpen, setEditOpen] = useState(false);
  const [activeNodeKey, setActiveNodeKey] = useState<string>();
  const [templates, setTemplates] = useState<DeliveryProcessTemplate[]>([]);
  const [sidelines, setSidelines] = useState<DeliveryProject[]>([]);
  const [sidelineModalOpen, setSidelineModalOpen] = useState(false);
  const [sidelineForm] = Form.useForm();
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(readRightPanelCollapsed);
  const [ganttViewMode, setGanttViewMode] = useState<DeliveryGanttViewMode>('week');
  const editFormRef = useRef<ProFormInstance>();
  const selectedOwnerRef = useRef<number | undefined>();
  const selectedMembersRef = useRef<DeliveryMember[]>([]);

  const ganttViewOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.deliveryProject.gantt.viewDay'), value: 'day' as const },
      { label: t('app.kuaizhizao.deliveryProject.gantt.viewWeek'), value: 'week' as const },
      { label: t('app.kuaizhizao.deliveryProject.gantt.viewMonth'), value: 'month' as const },
    ],
    [t],
  );

  const toggleRightPanelCollapsed = useCallback(() => {
    setRightPanelCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RIGHT_PANEL_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }, []);

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
      setRelatedAttachments(data.related_attachments ?? []);
      if ((data.line_role || 'main') === 'main') {
        const side = await deliveryProjectApi.listSidelines(projectId);
        setSidelines(side.items || []);
      } else {
        setSidelines([]);
      }
    } catch (e: unknown) {
      setError((e as Error)?.message ?? t('common.loadFailed'));
      setProject(null);
      setReports([]);
      setIssues([]);
      setLinkedRdProject(null);
      setSidelines([]);
      setRelatedAttachments([]);
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
    const deliveryDate = values.delivery_date;
    const toApiDate = (v: unknown): string | undefined => {
      if (v == null || v === '') return undefined;
      if (dayjs.isDayjs(v)) return v.isValid() ? v.format('YYYY-MM-DD') : undefined;
      const d = dayjs(v as string | Date | number);
      return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
    };
    await deliveryProjectApi.update(projectId, {
      project_name: values.project_name as string,
      delivery_date: toApiDate(deliveryDate),
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
    setEditingReport(null);
    reportForm.resetFields();
    reportForm.setFieldsValue({
      node_id: node?.id,
      progress_percent: Number(node?.progress_percent ?? 0),
      status: 'draft',
      report_date: dayjs(),
    });
    setReportModalOpen(true);
  };

  const openReportDetail = (report: DeliveryNodeReport) => {
    setReportDetailId(report.id);
    setReportDetailOpen(true);
  };

  const openEditReport = (report: DeliveryNodeReport) => {
    setReportDetailOpen(false);
    setEditingReport(report);
    reportForm.resetFields();
    reportForm.setFieldsValue({
      node_id: report.node_id,
      report_date: dayjs(report.report_date),
      progress_percent: Number(report.progress_percent ?? 0),
      content: report.content,
    });
    setReportModalOpen(true);
  };

  const submitReportRow = async (report: DeliveryNodeReport) => {
    try {
      await deliveryNodeReportApi.submit(report.id);
      message.success(t('common.submitted'));
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const confirmDeleteReport = async (report: DeliveryNodeReport) => {
    try {
      await deliveryNodeReportApi.delete(report.id);
      message.success(t('common.deleted'));
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const openCreateIssue = (node?: DeliveryProjectNode) => {
    setEditingIssue(null);
    issueForm.resetFields();
    issueForm.setFieldsValue({
      node_id: node?.id,
      issue_type: 'quality',
      priority: 'normal',
      status: 'open',
    });
    setIssueModalOpen(true);
  };

  const openIssueDetail = (issue: DeliveryIssue) => {
    setIssueDetailId(issue.id);
    setIssueDetailOpen(true);
  };

  const openEditIssue = async (issue: DeliveryIssue) => {
    setIssueDetailOpen(false);
    const detail = await deliveryIssueApi.get(issue.id);
    setEditingIssue(detail);
    issueForm.resetFields();
    issueForm.setFieldsValue({
      node_id: detail.node_id,
      title: detail.title,
      issue_type: detail.issue_type,
      priority: detail.priority,
      description: detail.description,
      due_date: detail.due_date ? dayjs(detail.due_date) : undefined,
    });
    setIssueModalOpen(true);
  };

  const updateIssueStatus = async (issue: DeliveryIssue, status: string, successKey: string) => {
    try {
      await deliveryIssueApi.update(issue.id, { status });
      message.success(t(successKey));
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
  };

  const confirmDeleteIssue = async (issue: DeliveryIssue) => {
    try {
      await deliveryIssueApi.delete(issue.id);
      message.success(t('common.deleted'));
      await load();
    } catch (e: unknown) {
      message.error((e as Error)?.message ?? t('common.operationFailed'));
    }
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
    if (!projectId) return;
    nodeScheduleOwnerRef.current = node.owner_id ?? undefined;
    setNodeScheduleEditing(node);
    setNodeScheduleRevisions([]);
    setNodeScheduleTab('edit');
    nodeScheduleForm.resetFields();
    setNodeScheduleModalOpen(true);
    setNodeScheduleRevisionsLoading(true);
    let ownerUuid: string | undefined;
    try {
      const [resolved, revisions] = await Promise.all([
        node.owner_id
          ? resolveUserDisplay({ user_ids: [node.owner_id] }).catch(() => [])
          : Promise.resolve([] as User[]),
        deliveryProjectApi.listNodeScheduleRevisions(projectId, node.id),
      ]);
      ownerUuid = resolved[0]?.uuid;
      setNodeScheduleRevisions(revisions);
    } catch {
      ownerUuid = undefined;
      setNodeScheduleRevisions([]);
    } finally {
      setNodeScheduleRevisionsLoading(false);
    }
    nodeScheduleForm.setFieldsValue({
      owner_uuid: ownerUuid,
      planned_start_date: node.planned_start_date ? dayjs(node.planned_start_date) : undefined,
      planned_end_date: node.planned_end_date ? dayjs(node.planned_end_date) : undefined,
      actual_start_date: node.actual_start_date ? dayjs(node.actual_start_date) : undefined,
      actual_end_date: node.actual_end_date ? dayjs(node.actual_end_date) : undefined,
      edit_reason: undefined,
    });
  };

  const saveNodeSchedule = async () => {
    if (!projectId || !nodeScheduleEditing) return;
    try {
      const values = await nodeScheduleForm.validateFields();
      const fmt = formatNodeScheduleDate;
      const changed = hasNodeScheduleChanges(
        nodeScheduleEditing,
        values,
        nodeScheduleOwnerRef.current,
      );
      const editReason = String(values.edit_reason ?? '').trim();
      if (changed && !editReason) {
        nodeScheduleForm.setFields([
          {
            name: 'edit_reason',
            errors: [t('app.kuaizhizao.deliveryProject.nodeScheduleEditReasonRequired')],
          },
        ]);
        return;
      }
      const payload: Record<string, unknown> = {
        owner_id: nodeScheduleOwnerRef.current ?? null,
        planned_start_date: fmt(values.planned_start_date as dayjs.Dayjs | undefined),
        planned_end_date: fmt(values.planned_end_date as dayjs.Dayjs | undefined),
        actual_start_date: fmt(values.actual_start_date as dayjs.Dayjs | undefined),
        actual_end_date: fmt(values.actual_end_date as dayjs.Dayjs | undefined),
      };
      if (changed) {
        payload.edit_reason = editReason;
      }
      await deliveryProjectApi.updateNode(projectId, nodeScheduleEditing.id, payload);
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
    setDocLinkNodeId(node.id);
    setDocLinkModalOpen(true);
  };

  const saveDocLink = async (payload: {
    node_id: number;
    task_id?: number;
    doc_type: string;
    doc_id: number;
    doc_code: string;
    title?: string;
  }) => {
    if (!projectId) return;
    await deliveryProjectApi.linkNodeDocument(projectId, payload);
    message.success(t('common.updated'));
    setDocLinkModalOpen(false);
    setDocLinkNodeId(null);
    await load();
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

  const openTaskModal = async (
    node: DeliveryProjectNode,
    task?: DeliveryProjectNodeTask,
    layer: 'substage' | 'task' = 'task',
  ) => {
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
    const formLayer = task?.task_layer === 'substage' ? 'substage' : task ? 'task' : layer;
    setTaskModalLayer(formLayer);
    taskForm.setFieldsValue({
      task_layer: formLayer,
      parent_task_id: task?.parent_task_id ?? undefined,
      task_name: task?.task_name,
      core_task: task?.core_task ?? undefined,
      participant_mode: task?.participant_mode ?? 'solo',
      owner_uuid: ownerUuid,
      member_uuids: memberUuids,
      planned_start_date: task?.planned_start_date ? dayjs(task.planned_start_date) : undefined,
      planned_end_date: task?.planned_end_date ? dayjs(task.planned_end_date) : undefined,
      attachments: mapAttachmentsToUploadList(task?.attachments),
    });
    setTaskModalOpen(true);
  };

  const openTaskOperateModal = (task: DeliveryProjectNodeTask) => {
    setTaskOperating(task);
    setTaskOperateOpen(true);
  };

  const saveNodeTask = async () => {
    if (!projectId || !taskEditingNode) return;
    try {
      const values = await taskForm.validateFields();
      const fmt = (v: dayjs.Dayjs | undefined) => v?.format('YYYY-MM-DD');
      const participantMode = (values.participant_mode as string) || 'solo';
      const taskLayer = (values.task_layer as string) || 'task';
      if (taskLayer === 'substage') {
        if (editingTask?.id) {
          await deliveryProjectApi.updateNodeTask(projectId, editingTask.id, {
            task_name: values.task_name as string,
          });
        } else {
          await deliveryProjectApi.createNodeTask(projectId, {
            node_id: taskEditingNode.id,
            task_layer: 'substage',
            task_name: values.task_name as string,
          });
        }
        message.success(t('common.updated'));
        setTaskModalOpen(false);
        setEditingTask(null);
        setTaskEditingNode(null);
        await load();
        return;
      }
      const payload = {
        node_id: taskEditingNode.id,
        task_layer: taskLayer,
        parent_task_id: taskLayer === 'task' ? (values.parent_task_id as number) : undefined,
        task_name: values.task_name as string,
        core_task: (values.core_task as string | undefined)?.trim() || null,
        participant_mode: participantMode,
        owner_id: taskOwnerRef.current ?? null,
        owner_name: taskOwnerNameRef.current ?? null,
        members: taskMembersRef.current,
        planned_start_date: fmt(values.planned_start_date as dayjs.Dayjs | undefined),
        planned_end_date: fmt(values.planned_end_date as dayjs.Dayjs | undefined),
        attachments: normalizeDocumentAttachments(values.attachments),
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
      const payload = {
        report_date: reportDate.format('YYYY-MM-DD'),
        progress_percent: values.progress_percent as number,
        content: values.content as string | undefined,
      };
      if (editingReport?.id) {
        await deliveryNodeReportApi.update(editingReport.id, payload);
        message.success(t('common.updated'));
      } else {
        await deliveryNodeReportApi.create({
          project_id: projectId,
          node_id: values.node_id as number,
          ...payload,
        });
        message.success(t('common.created'));
      }
      setReportModalOpen(false);
      setEditingReport(null);
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
      const payload = {
        node_id: values.node_id as number | undefined,
        title: values.title as string,
        issue_type: values.issue_type as string,
        priority: values.priority as string,
        description: values.description as string | undefined,
        due_date: dueDate?.format('YYYY-MM-DD'),
      };
      if (editingIssue?.id) {
        await deliveryIssueApi.update(editingIssue.id, payload);
        message.success(t('common.updated'));
      } else {
        await deliveryIssueApi.create({
          project_id: projectId,
          ...payload,
        });
        message.success(t('common.created'));
      }
      setIssueModalOpen(false);
      setEditingIssue(null);
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

  const projectGanttItems = useMemo((): DeliveryProjectGanttItem[] => {
    if (!effective.id || nodes.length === 0) return [];
    return nodes.map((node) => ({
      id: node.id,
      project_id: effective.id,
      node_id: node.id,
      project_code: effective.project_code,
      project_name: effective.project_name,
      node_name: node.node_name,
      customer_name: effective.customer_name,
      node_status: node.status,
      planned_start_date: node.planned_start_date,
      planned_end_date: node.planned_end_date,
      progress: node.progress_percent,
    }));
  }, [
    effective.customer_name,
    effective.id,
    effective.project_code,
    effective.project_name,
    nodes,
  ]);

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

  const openLinkedDocTypeList = useCallback(
    (docType: string) => {
      const path = DELIVERY_NODE_DOCUMENT_LIST_PATHS[docType as keyof typeof DELIVERY_NODE_DOCUMENT_LIST_PATHS];
      if (path) {
        navigate(path);
      }
    },
    [navigate],
  );

  const linkedDocumentColumns = useMemo(
    () =>
      buildLinkedDocumentColumns({
        t,
        canUpdate,
        onOpen: openLinkedDoc,
        onOpenDocTypeList: openLinkedDocTypeList,
        onUnlink: (link) => void confirmUnlinkDoc(link),
      }),
    [t, canUpdate, openLinkedDoc, openLinkedDocTypeList, confirmUnlinkDoc],
  );

  const recentReportColumns = useMemo(
    () =>
      buildWorkbenchRecentReportColumns({
        t,
        canRead,
        canUpdate: reportPerms.canUpdate,
        canDelete: reportPerms.canDelete,
        onView: openReportDetail,
        onEdit: openEditReport,
        onSubmit: (report) => void submitReportRow(report),
        onDelete: (report) => void confirmDeleteReport(report),
      }),
    [t, canRead, reportPerms.canUpdate, reportPerms.canDelete, openReportDetail, openEditReport, submitReportRow, confirmDeleteReport],
  );

  const recentIssueColumns = useMemo(
    () =>
      buildWorkbenchRecentIssueColumns({
        t,
        canRead,
        canUpdate: issuePerms.canUpdate,
        canDelete: issuePerms.canDelete,
        onView: openIssueDetail,
        onEdit: (issue) => void openEditIssue(issue),
        onStart: (issue) => void updateIssueStatus(issue, 'in_progress', 'common.updated'),
        onResolve: (issue) =>
          void updateIssueStatus(issue, 'resolved', 'app.kuaizhizao.deliveryProject.issueResolved'),
        onClose: (issue) =>
          void updateIssueStatus(issue, 'closed', 'app.kuaizhizao.deliveryProject.issueClosed'),
        onDelete: (issue) => void confirmDeleteIssue(issue),
      }),
    [
      t,
      canRead,
      issuePerms.canUpdate,
      issuePerms.canDelete,
      openIssueDetail,
      openEditIssue,
      updateIssueStatus,
      confirmDeleteIssue,
    ],
  );

  const resolveRelatedAttachmentSourceLabel = useCallback(
    (row: DeliveryWorkbenchRelatedAttachment) => {
      if (row.source_type === 'node_report') {
        return t('app.kuaizhizao.deliveryProject.workbench.relatedAttachmentSourceReport', {
          code: row.source_label,
        });
      }
      if (row.source_type === 'node_task') {
        return t('app.kuaizhizao.deliveryProject.workbench.relatedAttachmentSourceTask', {
          name: row.source_label,
        });
      }
      return row.source_label;
    },
    [t],
  );

  const relatedAttachmentColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.deliveryProject.workbench.relatedAttachmentFileName'),
        dataIndex: 'name',
        key: 'name',
        ...workbenchRemainderFlex(160),
        render: (name: string | null | undefined, row: DeliveryWorkbenchRelatedAttachment) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => {
              void openDocumentAttachment({ uid: row.uid, name: name ?? undefined }).catch(() => {
                message.error(t('components.documentAttachments.openFailed'));
              });
            }}
          >
            {name?.trim() || row.uid}
          </Button>
        ),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
        dataIndex: 'node_name',
        key: 'node_name',
        ...workbenchKeepWidth(88),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.workbench.relatedAttachmentSource'),
        dataIndex: 'source_label',
        key: 'source_label',
        ...workbenchKeepWidth(120),
        render: (_: unknown, row: DeliveryWorkbenchRelatedAttachment) => (
          <Typography.Text ellipsis={{ tooltip: resolveRelatedAttachmentSourceLabel(row) }}>
            {resolveRelatedAttachmentSourceLabel(row)}
          </Typography.Text>
        ),
      },
    ],
    [message, resolveRelatedAttachmentSourceLabel, t],
  );

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
    const substages = nodeTasks.filter((task) => task.task_layer === 'substage');
    const concreteTasks = nodeTasks.filter((task) => task.task_layer !== 'substage');
    const nodeDocs = nodeDocuments.filter((d) => d.node_id === node.id);
    const canNodeAction = (canUpdate || canExecute) && !['completed', 'cancelled'].includes(effective.status);
    const showActualDates = node.status !== 'not_started';
    return (
      <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
        <Card
          size="small"
          className="delivery-project-node-section-card"
          title={
            <Space size={8} align="center">
              <span>{t('app.kuaizhizao.deliveryProject.workbench.section.nodeInfo')}</span>
              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                {t('app.kuaizhizao.deliveryProject.fields.taskCount')} {nodeTasks.length}
              </Typography.Text>
            </Space>
          }
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
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
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
          </Descriptions>
        </Card>

        <Card
          size="small"
          className="delivery-project-node-section-card"
          title={`${t('app.kuaizhizao.deliveryProject.nodeTasks')} (${concreteTasks.length})`}
          extra={
            canUpdate ? (
              <Space>
                <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => void openTaskModal(node, undefined, 'substage')}>
                  {t('app.kuaizhizao.deliveryProject.addSubstage')}
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    if (!substages.length) {
                      message.warning(t('app.kuaizhizao.deliveryProject.substageRequired'));
                      return;
                    }
                    void openTaskModal(node, undefined, 'task');
                  }}
                >
                  {t('app.kuaizhizao.deliveryProject.addNodeTask')}
                </Button>
              </Space>
            ) : null
          }
        >
          <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
            {node.ahead_days
              ? t('app.kuaizhizao.deliveryProject.nodeAhead', { name: node.node_name, days: node.ahead_days })
              : node.overdue_days
                ? t('app.kuaizhizao.deliveryProject.nodeOverdue', { name: node.node_name, days: node.overdue_days })
                : t('app.kuaizhizao.deliveryProject.nodeOnTrack', { name: node.node_name })}
          </Typography.Text>
          {substages.length === 0 ? (
            <Empty description={t('app.kuaizhizao.deliveryProject.noSubstages')} />
          ) : (
            <Space orientation="vertical" size="medium" style={{ width: '100%' }}>
              {substages.map((substage) => {
                const children = concreteTasks.filter((task) => task.parent_task_id === substage.id);
                return (
                  <div key={substage.id}>
                    <Space style={{ marginBottom: 8 }}>
                      <Typography.Text strong>{substage.task_name}</Typography.Text>
                      <Typography.Text type="secondary">
                        {substage.progress_percent ?? 0}%
                      </Typography.Text>
                      {canUpdate ? (
                        <Button type="link" size="small" onClick={() => void openTaskModal(node, substage)}>
                          {t('common.edit')}
                        </Button>
                      ) : null}
                    </Space>
                    <DeliveryWorkbenchTable
                      rowKey="id"
                      size="small"
                      className="delivery-project-workbench-node-table"
                      pagination={false}
                      locale={{ emptyText: t('app.kuaizhizao.deliveryProject.noNodeTasks') }}
                      dataSource={children}
                      columns={buildWorkbenchNodeTaskColumns({
                        t,
                        canUpdate,
                        canParticipantAct,
                        onEdit: (task) => void openTaskModal(node, task),
                        onOperate: openTaskOperateModal,
                        onDelete: (task) => void confirmDeleteNodeTask(task),
                      })}
                    />
                  </div>
                );
              })}
            </Space>
          )}
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
          <DeliveryWorkbenchTable
            rowKey="id"
            size="small"
            className="delivery-project-workbench-node-table"
            pagination={false}
            locale={{ emptyText: t('app.kuaizhizao.deliveryProject.noLinkedDocuments') }}
            dataSource={nodeDocs}
            columns={linkedDocumentColumns}
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
      onClick: () => navigate(`/apps/kuaizhizao/delivery-project/node-reports?project_id=${projectId}`),
    },
    {
      key: 'issues',
      title: t('app.kuaizhizao.deliveryProject.workbench.openIssuesList'),
      count: issues.length,
      icon: BugOutlined,
      onClick: () => navigate(`/apps/kuaizhizao/delivery-project/issues?project_id=${projectId}`),
    },
    {
      key: 'attachments',
      title: t('app.kuaizhizao.deliveryProject.workbench.openRelatedAttachments'),
      count: relatedAttachments.length,
      icon: PaperClipOutlined,
      onClick: () => setAttachmentsDrawerOpen(true),
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
                {(effective.config_attrs as Record<string, unknown> | null | undefined)?.product_model ? (
                  <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.configAttrs.productModel')}>
                    {String((effective.config_attrs as Record<string, unknown>).product_model)}
                  </Descriptions.Item>
                ) : null}
                {effective.line_role === 'sideline' && effective.parent_project_id ? (
                  <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.parentProject')}>
                    <a
                      onClick={() =>
                        navigate(`/apps/kuaizhizao/delivery-project/projects/${effective.parent_project_id}`)
                      }
                    >
                      {effective.parent_project_code || `#${effective.parent_project_id}`}
                    </a>
                    {effective.parent_sync_task_key
                      ? ` → ${effective.parent_sync_task_key}`
                      : null}
                  </Descriptions.Item>
                ) : null}
                {(effective.line_role || 'main') === 'main' ? (
                  <Descriptions.Item label={t('app.kuaizhizao.deliveryProject.fields.sidelines')}>
                    {sidelines.length === 0 ? (
                      <Space size={8} wrap align="center">
                        <Typography.Text type="secondary">
                          {t('app.kuaizhizao.deliveryProject.noSidelines')}
                        </Typography.Text>
                        {canUpdate ? (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => {
                              sidelineForm.resetFields();
                              setSidelineModalOpen(true);
                            }}
                          >
                            {t('app.kuaizhizao.deliveryProject.createSideline')}
                          </Button>
                        ) : null}
                      </Space>
                    ) : (
                      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                        {sidelines.map((s) => (
                          <a
                            key={s.id}
                            onClick={() => navigate(`/apps/kuaizhizao/delivery-project/projects/${s.id}`)}
                          >
                            {s.project_code} {s.project_name}
                          </a>
                        ))}
                        {canUpdate ? (
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => {
                              sidelineForm.resetFields();
                              setSidelineModalOpen(true);
                            }}
                          >
                            {t('app.kuaizhizao.deliveryProject.createSideline')}
                          </Button>
                        ) : null}
                      </Space>
                    )}
                  </Descriptions.Item>
                ) : null}
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

        <div className="delivery-project-workbench-split">
          <div className="delivery-project-workbench-main">
            {nodes.length > 0 ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Card size="small" styles={{ body: { paddingTop: 12 } }}>
                  <DeliveryProjectNodeStepper
                    nodes={nodes}
                    activeNodeKey={activeNodeKey}
                    onChange={setActiveNodeKey}
                  />
                </Card>
                <Card
                  size="small"
                  title={t('app.kuaizhizao.deliveryProject.workbench.projectGanttTitle')}
                  extra={
                    <Segmented
                      size="small"
                      value={ganttViewMode}
                      options={ganttViewOptions}
                      onChange={(value) => setGanttViewMode(value as DeliveryGanttViewMode)}
                    />
                  }
                >
                  <DeliveryProjectGanttChart
                    items={projectGanttItems}
                    viewMode={ganttViewMode}
                    defaultExpanded
                  />
                </Card>
                <div className="delivery-project-node-panel">
                  {activeNode ? renderNodePanel(activeNode) : null}
                </div>
              </Space>
            ) : (
              <Card>
                <Empty description={t('app.kuaizhizao.deliveryProject.workbench.empty.nodes')} />
              </Card>
            )}
          </div>

          {rightPanelCollapsed ? (
            <div className="delivery-project-workbench-side-rail">
              <Tooltip
                title={t('app.kuaizhizao.deliveryProject.workbench.expandRightPanel')}
                placement="left"
              >
                <Button
                  type="text"
                  className="delivery-project-workbench-side-rail-btn"
                  icon={<MenuUnfoldOutlined />}
                  onClick={toggleRightPanelCollapsed}
                  aria-label={t('app.kuaizhizao.deliveryProject.workbench.expandRightPanel')}
                />
              </Tooltip>
            </div>
          ) : (
            <div className="delivery-project-workbench-side">
              <Card
                size="small"
                className="delivery-project-workbench-side-pack"
                title={t('app.kuaizhizao.deliveryProject.workbench.sidePanelTitle')}
                extra={
                  <Tooltip title={t('app.kuaizhizao.deliveryProject.workbench.collapseRightPanel')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<MenuFoldOutlined />}
                      onClick={toggleRightPanelCollapsed}
                      aria-label={t('app.kuaizhizao.deliveryProject.workbench.collapseRightPanel')}
                    />
                  </Tooltip>
                }
              >
                <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text className="delivery-project-workbench-side-section-title">
                      {t('app.kuaizhizao.deliveryProject.workbench.tabs.related')}
                    </Typography.Text>
                    {relatedPanel}
                  </div>

                  <div>
                    <Typography.Text className="delivery-project-workbench-side-section-title">
                      {t('app.kuaizhizao.deliveryProject.workbench.section.collaboration')}
                    </Typography.Text>
                    <Row gutter={[8, 8]}>
                      {collabShortcuts.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Col span={8} key={item.key}>
                            <Card
                              hoverable
                              size="small"
                              onClick={item.onClick}
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
                              <Typography.Text
                                style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.3 }}
                              >
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
                  </div>

                  <div>
                    <div className="delivery-project-workbench-side-section-head">
                      <Typography.Text className="delivery-project-workbench-side-section-title">
                        {t('app.kuaizhizao.deliveryProject.recentReports')}
                      </Typography.Text>
                      {canUpdate ? (
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateReport(activeNode)}
                        >
                          {t('app.kuaizhizao.deliveryProject.createReport')}
                        </Button>
                      ) : null}
                    </div>
                    <DeliveryWorkbenchTable
                      rowKey="id"
                      size="small"
                      className="delivery-project-workbench-side-table"
                      pagination={false}
                      dataSource={reports}
                      locale={{ emptyText: t('app.kuaizhizao.deliveryProject.workbench.collabEmpty') }}
                      columns={recentReportColumns}
                    />
                  </div>

                  <div>
                    <div className="delivery-project-workbench-side-section-head">
                      <Typography.Text className="delivery-project-workbench-side-section-title">
                        {t('app.kuaizhizao.deliveryProject.recentIssues')}
                      </Typography.Text>
                      {canUpdate ? (
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => openCreateIssue(activeNode)}
                        >
                          {t('app.kuaizhizao.deliveryProject.createIssue')}
                        </Button>
                      ) : null}
                    </div>
                    <DeliveryWorkbenchTable
                      rowKey="id"
                      size="small"
                      className="delivery-project-workbench-side-table"
                      pagination={false}
                      dataSource={issues}
                      locale={{ emptyText: t('app.kuaizhizao.deliveryProject.workbench.collabEmpty') }}
                      columns={recentIssueColumns}
                    />
                  </div>
                </Space>
              </Card>
            </div>
          )}
        </div>
      </Space>
    </ListPageTemplate>
    <Modal
      title={`${t('app.kuaizhizao.deliveryProject.editNodeSchedule')}${nodeScheduleEditing?.node_name ? ` - ${nodeScheduleEditing.node_name}` : ''}`}
      open={nodeScheduleModalOpen}
      onCancel={() => setNodeScheduleModalOpen(false)}
      onOk={() => void saveNodeSchedule()}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      destroyOnHidden
    >
      <Tabs
        activeKey={nodeScheduleTab}
        onChange={(key) => setNodeScheduleTab(key as 'edit' | 'history')}
        items={[
          {
            key: 'edit',
            label: t('app.kuaizhizao.deliveryProject.nodeScheduleEditTab'),
            children: (
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
                <Form.Item
                  name="edit_reason"
                  label={t('app.kuaizhizao.deliveryProject.fields.editReason')}
                  extra={t('app.kuaizhizao.deliveryProject.nodeScheduleEditReasonHint')}
                >
                  <Input.TextArea rows={2} maxLength={500} showCount />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'history',
            label: t('app.kuaizhizao.deliveryProject.nodeScheduleHistory'),
            children: (
              <Spin spinning={nodeScheduleRevisionsLoading}>
                {nodeScheduleRevisions.length ? (
                  <div style={{ maxHeight: 360, overflowY: 'auto', paddingTop: 4 }}>
                    <Timeline
                      items={nodeScheduleRevisions.map((revision) => ({
                        label: formatDateTimeBySiteSetting(revision.edited_at),
                        children: (
                          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                            <Typography.Text strong>
                              {revision.edited_by_name || t('common.dash')}
                            </Typography.Text>
                            <Typography.Text>{revision.edit_reason}</Typography.Text>
                            {revision.changes?.length ? (
                              <Space orientation="vertical" size={2}>
                                {revision.changes.map((item) => (
                                  <Typography.Text
                                    key={`${revision.id}-${item.field}-${item.before}-${item.after}`}
                                    type="secondary"
                                  >
                                    {renderNodeScheduleFieldLabel(item.field)}:{' '}
                                    {formatNodeScheduleHistoryValue(item.field, item.before)} →{' '}
                                    {formatNodeScheduleHistoryValue(item.field, item.after)}
                                  </Typography.Text>
                                ))}
                              </Space>
                            ) : null}
                          </Space>
                        ),
                      }))}
                    />
                  </div>
                ) : (
                  <Empty description={t('app.kuaizhizao.deliveryProject.nodeScheduleHistoryEmpty')} />
                )}
              </Spin>
            ),
          },
        ]}
      />
    </Modal>
    {docLinkNodeId ? (
      <DeliveryNodeDocumentLinkModal
        open={docLinkModalOpen}
        projectId={projectId}
        nodeId={docLinkNodeId}
        returnPath={location.pathname}
        customerId={project?.customer_id}
        salesOrderId={project?.sales_order_id}
        tasks={nodes.find((node) => node.id === docLinkNodeId)?.tasks ?? []}
        onClose={() => {
          setDocLinkModalOpen(false);
          setDocLinkNodeId(null);
        }}
        onLinked={load}
        onLinkExisting={saveDocLink}
      />
    ) : null}
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
        taskModalLayer === 'substage'
          ? editingTask
            ? t('app.kuaizhizao.deliveryProject.editSubstage')
            : t('app.kuaizhizao.deliveryProject.addSubstage')
          : editingTask
            ? t('app.kuaizhizao.deliveryProject.editNodeTask')
            : t('app.kuaizhizao.deliveryProject.addNodeTask')
      }
      open={taskModalOpen}
      width={MODAL_CONFIG.LARGE_WIDTH}
      onCancel={() => {
        setTaskModalOpen(false);
        setEditingTask(null);
        setTaskEditingNode(null);
      }}
      onOk={() => void saveNodeTask()}
      destroyOnHidden
    >
      <ProForm form={taskForm} layout="vertical" submitter={false} grid>
        <ProFormText name="task_layer" hidden />
        <ProFormText
          name="task_name"
          label={
            taskModalLayer === 'substage'
              ? t('app.kuaizhizao.deliveryProject.fields.substageName')
              : t('app.kuaizhizao.deliveryProject.fields.taskName')
          }
          colProps={{ span: 12 }}
          rules={[{ required: true }]}
        />
        <ProFormDependency name={['task_layer']}>
          {({ task_layer }) =>
            task_layer === 'substage' ? null : (
              <>
        <ProFormSelect
          name="parent_task_id"
          label={t('app.kuaizhizao.deliveryProject.fields.substageName')}
          colProps={{ span: 12 }}
          rules={[{ required: true, message: t('app.kuaizhizao.deliveryProject.selectSubstage') }]}
          options={(taskEditingNode?.tasks ?? [])
            .filter((task) => task.task_layer === 'substage')
            .map((task) => ({ value: task.id, label: task.task_name }))}
        />
        <ProFormSelect
          name="participant_mode"
          label={t('app.kuaizhizao.deliveryProject.fields.participantMode')}
          initialValue="solo"
          colProps={{ span: 12 }}
          options={Object.entries(DELIVERY_TASK_PARTICIPANT_MODE).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ProFormTextArea
          name="core_task"
          label={t('app.kuaizhizao.deliveryProject.fields.coreTask')}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 3, showCount: true, maxLength: 500 }}
        />
        <UniUserSelect
          name="owner_uuid"
          label={t('app.kuaizhizao.deliveryProject.fields.ownerName')}
          colProps={{ span: 12 }}
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
          colProps={{ span: 12 }}
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
        <ProFormDatePicker
          name="planned_start_date"
          label={t('app.kuaizhizao.deliveryProject.fields.plannedStartDate')}
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label={t('app.kuaizhizao.deliveryProject.fields.plannedEndDate')}
          colProps={{ span: 12 }}
          fieldProps={{ style: { width: '100%' } }}
        />
        <DocumentAttachmentsField category="delivery_node_task_attachments" label={false} />
              </>
            )
          }
        </ProFormDependency>
      </ProForm>
    </Modal>
    <UniDetail
      title={t('app.kuaizhizao.deliveryProject.workbench.openRelatedAttachments')}
      open={attachmentsDrawerOpen}
      onClose={() => setAttachmentsDrawerOpen(false)}
      size={DRAWER_CONFIG.STANDARD_WIDTH}
      linesTitle={t('app.kuaizhizao.deliveryProject.fields.taskAttachments')}
      lines={
        relatedAttachments.length > 0 ? (
          <DeliveryWorkbenchTable
            className="uni-detail-table"
            rowKey={(row) => `${row.source_type}-${row.source_id}-${row.uid}`}
            size="small"
            pagination={false}
            dataSource={relatedAttachments}
            columns={relatedAttachmentColumns}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.kuaizhizao.deliveryProject.workbench.relatedAttachmentsEmpty')}
          />
        )
      }
    />
    <DeliveryIssueDetailDrawer
      open={issueDetailOpen}
      issueId={issueDetailId}
      onClose={() => {
        setIssueDetailOpen(false);
        setIssueDetailId(undefined);
      }}
      onChanged={load}
      canUpdate={issuePerms.canUpdate}
      canDelete={issuePerms.canDelete}
      onEdit={(issue) => void openEditIssue(issue)}
    />
    <DeliveryNodeReportDetailDrawer
      open={reportDetailOpen}
      reportId={reportDetailId}
      onClose={() => {
        setReportDetailOpen(false);
        setReportDetailId(undefined);
      }}
      onChanged={load}
      canUpdate={reportPerms.canUpdate}
      canDelete={reportPerms.canDelete}
      canApprove={reportPerms.canAction?.('approve') ?? false}
      onEdit={(report) => openEditReport(report)}
    />
    <DeliveryNodeTaskOperateModal
      open={taskOperateOpen}
      projectId={projectId}
      task={taskOperating}
      currentUserId={currentUser?.id}
      canAct={canParticipantAct}
      onClose={() => {
        setTaskOperateOpen(false);
        setTaskOperating(null);
      }}
      onUpdated={load}
    />
    <Modal
      title={
        editingReport
          ? t('app.kuaizhizao.deliveryProject.editReport')
          : t('app.kuaizhizao.deliveryProject.createReport')
      }
      open={reportModalOpen}
      onCancel={() => {
        setReportModalOpen(false);
        setEditingReport(null);
      }}
      onOk={() => void saveReport()}
      destroyOnHidden
    >
      <Form form={reportForm} layout="vertical">
        <Form.Item name="node_id" label={t('app.kuaizhizao.deliveryProject.fields.nodeName')} rules={[{ required: true }]}>
          <Select disabled={Boolean(editingReport)} options={nodeOptions} placeholder={t('common.pleaseSelect')} />
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
      title={
        editingIssue
          ? t('app.kuaizhizao.deliveryProject.editIssue')
          : t('app.kuaizhizao.deliveryProject.createIssue')
      }
      open={issueModalOpen}
      onCancel={() => {
        setIssueModalOpen(false);
        setEditingIssue(null);
      }}
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
          <Select options={Object.entries(DELIVERY_ISSUE_PRIORITY).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="due_date" label={t('app.kuaizhizao.deliveryProject.fields.dueDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="description" label={t('app.kuaizhizao.deliveryProject.fields.description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
    <Modal
      title={t('app.kuaizhizao.deliveryProject.createSideline')}
      open={sidelineModalOpen}
      destroyOnHidden
      onCancel={() => setSidelineModalOpen(false)}
      onOk={() => {
        void sidelineForm.validateFields().then(async (values) => {
          try {
            const created = await deliveryProjectApi.createSideline(projectId, {
              project_name: values.project_name as string,
              parent_sync_task_key: values.parent_sync_task_key as string,
              notes: values.notes as string | undefined,
            });
            message.success(t('common.created'));
            setSidelineModalOpen(false);
            navigate(`/apps/kuaizhizao/delivery-project/projects/${created.id}`);
          } catch (e: unknown) {
            message.error((e as Error)?.message ?? t('common.createFailed'));
          }
        });
      }}
    >
      <Form form={sidelineForm} layout="vertical">
        <Form.Item
          name="project_name"
          label={t('app.kuaizhizao.deliveryProject.fields.projectName')}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="parent_sync_task_key"
          label={t('app.kuaizhizao.deliveryProject.fields.parentSyncTaskKey')}
          rules={[{ required: true }]}
          extra={t('app.kuaizhizao.deliveryProject.parentSyncTaskKeyHint')}
        >
          <Input placeholder="heat_exchanger" />
        </Form.Item>
        <Form.Item name="notes" label={t('app.kuaizhizao.deliveryProject.fields.notes')}>
          <Input.TextArea rows={2} />
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
