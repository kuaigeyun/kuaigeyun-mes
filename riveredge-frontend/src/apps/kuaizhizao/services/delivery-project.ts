/**
 * 交付项目（订单交机）API
 */

import { apiRequest } from '../../../services/api';

export interface DeliveryMember {
  user_id: number;
  user_name: string;
}

export interface DeliveryProjectNodeTask {
  id: number;
  project_id: number;
  node_id: number;
  template_task_id?: number | null;
  task_key?: string | null;
  task_name: string;
  sort_order: number;
  status: string;
  owner_id?: number | null;
  owner_name?: string | null;
  members?: DeliveryMember[];
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  progress_percent?: number | string;
}

export interface DeliveryProjectNode {
  id: number;
  project_id: number;
  node_key: string;
  node_name: string;
  sort_order: number;
  status: string;
  progress_percent: number | string;
  owner_id?: number | null;
  owner_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  is_critical: boolean;
  is_milestone: boolean;
  tasks?: DeliveryProjectNodeTask[];
}

export interface DeliveryProject {
  id: number;
  project_code: string;
  project_name: string;
  process_template_id?: number | null;
  process_template_name?: string | null;
  sales_order_id?: number | null;
  sales_order_code?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  delivery_date?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  members?: DeliveryMember[];
  material_code?: string | null;
  material_name?: string | null;
  material_spec?: string | null;
  status: string;
  progress_percent: number | string;
  current_node_key?: string | null;
  current_node_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  notes?: string | null;
  rd_project_id?: number | null;
  nodes?: DeliveryProjectNode[];
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface DeliveryLinkedRdProject {
  id: number;
  project_code: string;
  project_name: string;
}

export interface DeliveryProjectWorkbench extends DeliveryProject {
  recent_reports?: DeliveryNodeReport[];
  open_issues?: DeliveryIssue[];
  linked_rd_project?: DeliveryLinkedRdProject | null;
}

export interface DeliveryProcessTemplateNodeTask {
  id?: number;
  template_node_id?: number;
  task_key: string;
  task_name: string;
  sort_order: number;
  default_owner_role?: string | null;
  planned_duration_days?: number;
}

export interface DeliveryProcessTemplateNode {
  id?: number;
  template_id?: number;
  node_key: string;
  node_name: string;
  sort_order: number;
  default_owner_role?: string | null;
  planned_duration_days: number;
  is_critical: boolean;
  is_milestone: boolean;
  tasks?: DeliveryProcessTemplateNodeTask[];
}

export interface DeliveryProcessTemplate {
  id: number;
  template_code: string;
  template_name: string;
  project_type?: string | null;
  is_active: boolean;
  is_default: boolean;
  notes?: string | null;
  nodes: DeliveryProcessTemplateNode[];
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryNodeReport {
  id: number;
  report_code: string;
  project_id: number;
  project_code: string;
  node_id: number;
  node_key: string;
  node_name: string;
  reporter_name?: string | null;
  report_date: string;
  progress_percent: number | string;
  content?: string | null;
  status: string;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface DeliveryIssue {
  id: number;
  issue_code: string;
  project_id: number;
  project_code: string;
  node_id?: number | null;
  node_name?: string | null;
  issue_type: string;
  priority: string;
  status: string;
  title: string;
  description?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  resolution?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface DeliveryProgressSummaryRow {
  id: number;
  project_code: string;
  project_name: string;
  customer_name?: string | null;
  sales_order_code?: string | null;
  delivery_date?: string | null;
  owner_name?: string | null;
  material_code?: string | null;
  material_name?: string | null;
  status: string;
  progress_percent: number | string;
  current_node_name?: string | null;
  planned_end_date?: string | null;
  overdue_node_count: number;
  open_issue_count: number;
  days_to_delivery?: number | null;
  node_summary?: string | null;
}

export interface DeliveryGanttItem {
  id: number;
  project_id: number;
  node_id: number;
  project_code: string;
  project_name: string;
  node_name: string;
  customer_name?: string | null;
  node_status?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  progress?: number;
}

export interface DeliveryDashboard {
  kpis: {
    active_projects: number;
    overdue_nodes: number;
    at_risk_projects: number;
    open_issues: number;
  };
  recent_projects: DeliveryProject[];
  overdue_nodes: Array<{
    project_id: number;
    project_code?: string;
    project_name?: string;
    node_id: number;
    node_name: string;
    planned_end_date?: string;
  }>;
  project_gantt?: DeliveryGanttItem[];
}

export interface DeliveryFollowUpRow extends DeliveryProject {
  nodes: DeliveryProjectNode[];
}

export interface DeliveryScheduleRow {
  project_id: number;
  project_code: string;
  project_name: string;
  customer_name?: string | null;
  delivery_date?: string | null;
  owner_name?: string | null;
  status: string;
  progress_percent: number | string;
  current_node_name?: string | null;
  schedule_node_name?: string | null;
  schedule_node_owner_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  node_status?: string | null;
  report_overdue: boolean;
  created_at?: string;
  updated_at?: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface DeliveryProcessProgressRow {
  id: string;
  project_id: number;
  project_code: string;
  project_name: string;
  sales_order_code?: string | null;
  customer_name?: string | null;
  project_owner_name?: string | null;
  material_name?: string | null;
  delivery_date?: string | null;
  node_id: number;
  node_key: string;
  node_name: string;
  sort_order: number;
  node_status: string;
  progress_percent: number | string;
  node_owner_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  reporter_name?: string | null;
  issue_count: number;
  is_critical: boolean;
  is_milestone: boolean;
}

export interface DeliveryIssueProgressRow {
  id: number;
  issue_code: string;
  project_code: string;
  project_name: string;
  customer_name?: string | null;
  node_name?: string | null;
  issue_type: string;
  priority: string;
  status: string;
  title: string;
  assignee_name?: string | null;
  due_date?: string | null;
  created_at?: string | null;
}

const BASE = '/apps/kuaizhizao';

export const deliveryProjectApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryProject[]; total: number }>(`${BASE}/delivery-projects`, { method: 'GET', params }),
  get: (id: number) => apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}`, { method: 'GET' }),
  getWorkbench: (id: number) =>
    apiRequest<DeliveryProjectWorkbench>(`${BASE}/delivery-projects/${id}/workbench`, { method: 'GET' }),
  create: (data: Record<string, unknown>) =>
    apiRequest<DeliveryProject>(`${BASE}/delivery-projects`, { method: 'POST', data }),
  update: (id: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`${BASE}/delivery-projects/${id}`, { method: 'DELETE' }),
  start: (id: number) => apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/start`, { method: 'POST' }),
  pause: (id: number) => apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/pause`, { method: 'POST' }),
  resume: (id: number) => apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/resume`, { method: 'POST' }),
  cancel: (id: number) => apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/cancel`, { method: 'POST' }),
  complete: (id: number, data?: { force?: boolean; reason?: string }) =>
    apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/complete`, { method: 'POST', data: data ?? {} }),
  changeTemplate: (id: number, processTemplateId: number) =>
    apiRequest<DeliveryProject>(`${BASE}/delivery-projects/${id}/change-template`, {
      method: 'POST',
      data: { process_template_id: processTemplateId },
    }),
  updateNode: (projectId: number, nodeId: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryProjectNode>(`${BASE}/delivery-projects/${projectId}/nodes/${nodeId}`, { method: 'PUT', data }),
  createNodeTask: (projectId: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryProjectNodeTask>(`${BASE}/delivery-projects/${projectId}/node-tasks`, {
      method: 'POST',
      data,
    }),
  updateNodeTask: (projectId: number, taskId: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryProjectNodeTask>(`${BASE}/delivery-projects/${projectId}/node-tasks/${taskId}`, {
      method: 'PUT',
      data,
    }),
  deleteNodeTask: (projectId: number, taskId: number) =>
    apiRequest(`${BASE}/delivery-projects/${projectId}/node-tasks/${taskId}`, { method: 'DELETE' }),
  progressSummary: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryProgressSummaryRow[]; total: number }>(
      `${BASE}/delivery-reports/progress-summary`,
      { method: 'GET', params },
    ),
  dashboard: () => apiRequest<DeliveryDashboard>(`${BASE}/delivery-dashboard`, { method: 'GET' }),
  followUp: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryFollowUpRow[]; total: number }>(`${BASE}/delivery-follow-up`, { method: 'GET', params }),
  schedules: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryScheduleRow[]; total: number }>(`${BASE}/delivery-schedules`, { method: 'GET', params }),
  processProgress: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryProcessProgressRow[]; total: number }>(
      `${BASE}/delivery-reports/process-progress`,
      { method: 'GET', params },
    ),
  issueProgress: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryIssueProgressRow[]; total: number }>(
      `${BASE}/delivery-reports/issue-progress`,
      { method: 'GET', params },
    ),
  previewPushFromSalesOrder: (salesOrderId: number) =>
    apiRequest(`${BASE}/sales-orders/${salesOrderId}/push-to-delivery-project/preview`, { method: 'GET' }),
  pushFromSalesOrder: (salesOrderId: number, data?: Record<string, unknown>) =>
    apiRequest<DeliveryProject>(`${BASE}/sales-orders/${salesOrderId}/push-to-delivery-project`, { method: 'POST', data }),
};

export const deliveryProcessTemplateApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryProcessTemplate[]; total: number }>(`${BASE}/delivery-process-templates`, { method: 'GET', params }),
  get: (id: number) => apiRequest<DeliveryProcessTemplate>(`${BASE}/delivery-process-templates/${id}`, { method: 'GET' }),
  create: (data: Record<string, unknown>) =>
    apiRequest<DeliveryProcessTemplate>(`${BASE}/delivery-process-templates`, { method: 'POST', data }),
  update: (id: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryProcessTemplate>(`${BASE}/delivery-process-templates/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`${BASE}/delivery-process-templates/${id}`, { method: 'DELETE' }),
  setDefault: (id: number) =>
    apiRequest<DeliveryProcessTemplate>(`${BASE}/delivery-process-templates/${id}/set-default`, { method: 'POST' }),
};

export const deliveryNodeReportApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryNodeReport[]; total: number }>(`${BASE}/delivery-node-reports`, { method: 'GET', params }),
  get: (id: number) => apiRequest<DeliveryNodeReport>(`${BASE}/delivery-node-reports/${id}`, { method: 'GET' }),
  create: (data: Record<string, unknown>) =>
    apiRequest<DeliveryNodeReport>(`${BASE}/delivery-node-reports`, { method: 'POST', data }),
  update: (id: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryNodeReport>(`${BASE}/delivery-node-reports/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`${BASE}/delivery-node-reports/${id}`, { method: 'DELETE' }),
  submit: (id: number) => apiRequest<DeliveryNodeReport>(`${BASE}/delivery-node-reports/${id}/submit`, { method: 'POST' }),
  review: (id: number, data: { approved: boolean; review_notes?: string }) =>
    apiRequest<DeliveryNodeReport>(`${BASE}/delivery-node-reports/${id}/review`, { method: 'POST', data }),
};

export const deliveryIssueApi = {
  list: (params?: Record<string, unknown>) =>
    apiRequest<{ items: DeliveryIssue[]; total: number }>(`${BASE}/delivery-issues`, { method: 'GET', params }),
  get: (id: number) => apiRequest<DeliveryIssue>(`${BASE}/delivery-issues/${id}`, { method: 'GET' }),
  create: (data: Record<string, unknown>) =>
    apiRequest<DeliveryIssue>(`${BASE}/delivery-issues`, { method: 'POST', data }),
  update: (id: number, data: Record<string, unknown>) =>
    apiRequest<DeliveryIssue>(`${BASE}/delivery-issues/${id}`, { method: 'PUT', data }),
  delete: (id: number) => apiRequest(`${BASE}/delivery-issues/${id}`, { method: 'DELETE' }),
};

export const DELIVERY_PROJECT_STATUS: Record<string, string> = {
  draft: '草稿',
  in_progress: '进行中',
  paused: '暂停',
  completed: '已完成',
  cancelled: '已取消',
};

export const DELIVERY_NODE_STATUS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  overdue: '逾期',
};

export const DELIVERY_NODE_TASK_STATUS: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
};

export const DELIVERY_NODE_REPORT_STATUS: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已通过',
  rejected: '已驳回',
};

export const DELIVERY_ISSUE_STATUS: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

export const DELIVERY_ISSUE_PRIORITY: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export const DELIVERY_ISSUE_TYPE: Record<string, string> = {
  blocker: '阻塞',
  quality: '质量',
  delivery: '交期',
  other: '其他',
};
