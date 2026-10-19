import { apiRequest } from './api';

export interface SubmitInitiatorNodeHint {
  node_id: string;
  label: string;
  required: boolean;
  empty_approver_policy: string;
}

export interface SubmitInitiatorBranchHint {
  condition_node_id: string;
  label: string;
  required: boolean;
  branches: Array<{ index: number; label: string }>;
}

export interface SubmitInitiatorRequirements {
  nodes: SubmitInitiatorNodeHint[];
  branch_conditions: SubmitInitiatorBranchHint[];
}

export async function fetchSubmitInitiatorRequirements(
  entityType: string,
): Promise<SubmitInitiatorRequirements> {
  const res = await apiRequest<{
    nodes?: SubmitInitiatorNodeHint[];
    branch_conditions?: SubmitInitiatorBranchHint[];
  }>(`/core/uni-audit/${encodeURIComponent(entityType)}/submit-initiator-nodes`, { method: 'GET' });
  return {
    nodes: Array.isArray(res?.nodes) ? res.nodes : [],
    branch_conditions: Array.isArray(res?.branch_conditions) ? res.branch_conditions : [],
  };
}

export async function fetchSubmitInitiatorNodes(
  entityType: string,
): Promise<SubmitInitiatorNodeHint[]> {
  const res = await fetchSubmitInitiatorRequirements(entityType);
  return res.nodes;
}
