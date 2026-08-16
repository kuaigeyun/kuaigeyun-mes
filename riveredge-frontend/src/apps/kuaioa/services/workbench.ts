import { kuaioaGet } from './kuaioaApi';

export interface WorkbenchSummary {
  pending_approvals: Array<Record<string, unknown>>;
  pending_approval_total: number;
  kuaioa_pending_approval_total?: number;
  pinned_announcements: Array<Record<string, unknown>>;
  recent_announcements: Array<Record<string, unknown>>;
  my_submitted_pending: Array<Record<string, unknown>>;
  expiring_licenses?: Array<Record<string, unknown>>;
  expiring_work_licenses?: Array<Record<string, unknown>>;
  expiring_license_total?: number;
  expiring_work_license_total?: number;
}

export const getWorkbenchSummary = () =>
  kuaioaGet<WorkbenchSummary>('/apps/kuaioa/workbench/summary');
