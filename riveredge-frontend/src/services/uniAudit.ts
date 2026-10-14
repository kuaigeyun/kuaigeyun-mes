import { apiRequest } from './api';

export interface SubmitInitiatorNodeHint {
  node_id: string;
  label: string;
  required: boolean;
  empty_approver_policy: string;
}

export async function fetchSubmitInitiatorNodes(
  entityType: string,
): Promise<SubmitInitiatorNodeHint[]> {
  const res = await apiRequest<{ nodes?: SubmitInitiatorNodeHint[] }>(
    `/core/uni-audit/${encodeURIComponent(entityType)}/submit-initiator-nodes`,
    { method: 'GET' },
  );
  return Array.isArray(res?.nodes) ? res.nodes : [];
}
