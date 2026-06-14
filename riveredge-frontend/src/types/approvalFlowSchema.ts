/** 审批流程 Schema（与后端 approval_flow_schema.py 对齐） */

export type ApprovalNodeType = 'start' | 'approval' | 'cc' | 'condition' | 'end';

export interface ConditionItem {
  field?: string;
  operator?: string;
  value?: unknown;
  label?: string;
}

export interface ApprovalNodeData {
  label?: string;
  approvalType?: 'AND' | 'OR';
  approverType?: 'user' | 'role' | 'department' | 'manager' | 'multi_level_manager' | 'initiator_select';
  approverIds?: string[];
  allowEditDuringApproval?: boolean;
  refreshContextOnEdit?: boolean;
  allowTransfer?: boolean;
  allowAddSign?: boolean;
  emptyApproverPolicy?: 'auto_pass' | 'fallback_user' | 'escalate_admin';
  editableFields?: string[] | '*';
  conditions?: ConditionItem[];
  [key: string]: unknown;
}

export interface FlowGraph {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: ApprovalNodeData }>;
  edges: Array<{ id?: string; source: string; target: string; type?: string; data?: Record<string, unknown> }>;
}

const MANAGER_TYPES = new Set(['manager', 'department', 'multi_level_manager', 'initiator_select']);

function asList<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function normalizeNodeData(nodeType: string, data: ApprovalNodeData = {}): ApprovalNodeData {
  const out: ApprovalNodeData = { ...data };
  if (nodeType === 'approval' || nodeType === 'cc') {
    const rawIds =
      out.approverIds ??
      (out.approver_ids as string[] | undefined) ??
      (out.approvers as string[] | undefined) ??
      (out.roles as string[] | undefined) ??
      [];
    out.approverIds = asList(rawIds).map(String).filter(Boolean);
    delete out.approvers;
    delete out.roles;
    delete out.approver_ids;
    if (nodeType === 'approval') {
      out.approvalType = (out.approvalType || out.approval_type || 'OR') as 'AND' | 'OR';
      out.approverType = (out.approverType || out.approver_type || 'user') as ApprovalNodeData['approverType'];
      out.allowEditDuringApproval = Boolean(out.allowEditDuringApproval);
      out.refreshContextOnEdit = out.refreshContextOnEdit !== false;
      out.allowTransfer = Boolean(out.allowTransfer);
      out.allowAddSign = Boolean(out.allowAddSign);
      if (!out.emptyApproverPolicy) out.emptyApproverPolicy = 'auto_pass';
    }
  }
  if (nodeType === 'condition') {
    const conditions = asList(out.conditions || (out.condition_list as ConditionItem[]));
    out.conditions = conditions.map((c) => ({
      field: c.field,
      operator: c.operator || '==',
      value: c.value,
      label: c.label || '',
    }));
    delete out.condition_list;
  }
  return out;
}

export function normalizeFlowGraph(raw: { nodes?: unknown[]; edges?: unknown[] }): FlowGraph {
  const nodeList = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edgeList = Array.isArray(raw?.edges) ? raw.edges : [];
  const nodes = nodeList
    .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === 'object')
    .map((node) => {
      const type = String(node.type || '');
      const data = normalizeNodeData(type, (node.data as ApprovalNodeData) || {});
      return {
        id: String(node.id),
        type,
        position: (node.position as { x: number; y: number }) || { x: 0, y: 0 },
        data,
      };
    });
  const edges = edgeList
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
    .map((edge, i) => ({
      id: String(edge.id || `e-${edge.source}-${edge.target}-${i}`),
      source: String(edge.source),
      target: String(edge.target),
      type: String(edge.type || 'default'),
      data: (edge.data as Record<string, unknown>) || {},
    }));
  return { nodes, edges };
}

export function validateFlowGraph(graph: FlowGraph): string[] {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has('start') || !ids.has('end')) errors.push('流程必须包含开始与结束节点');
  graph.nodes.forEach((node) => {
    if (node.type === 'approval') {
      const t = node.data.approverType || 'user';
      const idsLen = node.data.approverIds?.length || 0;
      if (!MANAGER_TYPES.has(t) && idsLen === 0) {
        errors.push(`审批节点「${node.data.label || node.id}」未配置审批人`);
      }
    }
    if (node.type === 'condition') {
      const outEdges = graph.edges.filter((e) => e.source === node.id);
      const conds = node.data.conditions || [];
      if (outEdges.length > 1 && conds.length !== outEdges.length) {
        errors.push(`条件节点「${node.data.label || node.id}」出边数与条件数不一致`);
      }
    }
  });
  return errors;
}

/** 表单 approverIds ↔ UI 分字段 */
export function nodeDataToFormValues(data: ApprovalNodeData): ApprovalNodeData {
  const v = { ...data };
  if (v.approverType === 'user') v.approvers = v.approverIds;
  if (v.approverType === 'role') v.roles = v.approverIds;
  return v;
}

export function formValuesToNodeData(values: ApprovalNodeData): ApprovalNodeData {
  const v = { ...values };
  if (v.approverType === 'user' && v.approvers) v.approverIds = v.approvers as string[];
  if (v.approverType === 'role' && v.roles) v.approverIds = v.roles as string[];
  delete v.approvers;
  delete v.roles;
  return normalizeNodeData('approval', v);
}
