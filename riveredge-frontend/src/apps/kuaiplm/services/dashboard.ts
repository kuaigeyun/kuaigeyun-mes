/**
 * 快研发 — 研发看板 API
 */

import { apiRequest } from '../../../services/api';
import type { RdProjectGanttItem } from '../components/RdProjectGanttChart';

export interface KuaiplmDashboardSummary {
  project_total?: number;
  project_rd_total?: number;
  project_delivery_total?: number;
  project_in_progress?: number;
  project_on_hold?: number;
  project_completed?: number;
  open_tasks?: number;
  pending_gate_reviews?: number;
  pending_bom_changes?: number;
  pending_route_changes?: number;
  kb_article_total?: number;
  requirement_total?: number;
  design_review_pending?: number;
  fmea_total?: number;
  recent_projects?: Array<{
    id: number;
    project_code?: string;
    project_name?: string;
    status?: string;
    status_label?: string;
    current_gate_name?: string;
    updated_at?: string;
  }>;
  project_gantt?: RdProjectGanttItem[];
  my_tasks?: MyTaskItem[];
}

export interface MyTaskItem {
  id: number;
  project_id: number;
  project_code?: string;
  project_name?: string;
  task_name?: string;
  status?: string;
  due_date?: string | null;
  gate_name?: string | null;
  assignee_name?: string | null;
}

export async function getDashboardSummary(): Promise<KuaiplmDashboardSummary> {
  return apiRequest<KuaiplmDashboardSummary>('/apps/kuaiplm/dashboard/summary', { method: 'GET' });
}
