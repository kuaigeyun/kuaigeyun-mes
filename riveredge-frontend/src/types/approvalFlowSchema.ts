/** 审批流程 Schema（与后端 approval_flow_schema.py 对齐） */

export type ApprovalNodeType = 'start' | 'approval' | 'cc' | 'condition' | 'end';

export type ConditionRouteMode = 'previous_approver' | 'initiator' | 'formula';

export interface ConditionItem {
  field?: string;
  operator?: string;
  value?: unknown;
  label?: string;
  /** 公式模式：其余分支 */
  else?: boolean;
}

const CONDITION_ROUTE_MODES = new Set<ConditionRouteMode>([
  'previous_approver',
  'initiator',
  'formula',
]);

function conditionValueFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  return true;
}

function inferConditionRouteMode(conditions: ConditionItem[], outEdgeCount: number): ConditionRouteMode | undefined {
  if (outEdgeCount <= 1) return 'formula';
  if (conditions.some((c) => c.else)) return 'formula';
  if (conditions.some((c) => String(c.field || '').trim() && conditionValueFilled(c.value))) {
    return 'formula';
  }
  if (conditions.length && conditions.every((c) => !conditionValueFilled(c.value))) {
    return 'previous_approver';
  }
  return undefined;
}

export function normalizeConditionNodeData(
  data: ApprovalNodeData = {},
  outEdgeCount = 0,
): ApprovalNodeData {
  const out: ApprovalNodeData = { ...data };
  const conditions = asList(out.conditions || (out.condition_list as ConditionItem[]));
  const normalized: ConditionItem[] = conditions.map((c) => ({
    field: c.field,
    operator: c.operator || '==',
    value: c.value,
    label: c.label || '',
    else: Boolean(c.else),
  }));
  out.conditions = normalized;
  delete out.condition_list;

  const rawMode = String(out.routeMode || out.route_mode || '').trim() as ConditionRouteMode;
  if (CONDITION_ROUTE_MODES.has(rawMode)) {
    out.routeMode = rawMode;
  } else {
    const inferred = inferConditionRouteMode(normalized, outEdgeCount);
    if (inferred) out.routeMode = inferred;
    else delete out.routeMode;
  }

  const mode = out.routeMode;
  if (mode === 'previous_approver' || mode === 'initiator') {
    out.conditions = normalized.map((item, i) => ({
      label: String(item.label || '').trim() || `分支${i + 1}`,
    }));
  }
  return out;
}

export interface ApprovalNodeData {
  label?: string;
  approvalType?: 'AND' | 'OR';
  approverType?: 'user' | 'role' | 'department' | 'manager' | 'multi_level_manager' | 'initiator_select';
  /** department 节点：submitter=发起人部门负责人，specified=指定部门负责人 */
  departmentScope?: 'submitter' | 'specified';
  approverIds?: string[];
  allowEditDuringApproval?: boolean;
  refreshContextOnEdit?: boolean;
  allowTransfer?: boolean;
  allowAddSign?: boolean;
  emptyApproverPolicy?: 'block' | 'auto_pass' | 'fallback_user' | 'escalate_admin';
  /** multi_level_manager：沿部门树向上第 N 个负责人（≥2） */
  managerLevel?: number;
  /** 本节点审批通过时写入 instance.data，供后续条件分支 */
  decisionOnApprove?: { field: string; label: string; defaultValue?: boolean };
  decisionOnApproveEnabled?: boolean;
  decisionOnApproveField?: string;
  decisionOnApproveLabel?: string;
  decisionOnApproveDefault?: boolean;
  editableFields?: string[] | '*';
  conditions?: ConditionItem[];
  routeMode?: ConditionRouteMode;
  route_mode?: ConditionRouteMode;
  [key: string]: unknown;
}

export interface FlowGraph {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: ApprovalNodeData }>;
  edges: Array<{ id?: string; source: string; target: string; type?: string; data?: Record<string, unknown> }>;
}

const MANAGER_TYPES = new Set(['manager', 'department', 'multi_level_manager', 'initiator_select']);
/** 设计期可不预配人员（启用前须在设计器绑角色；发起人自选在提交时勾选） */
const DESIGN_TIME_EMPTY_OK = new Set([...MANAGER_TYPES, 'role']);

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
      if (out.approverType === 'department') {
        const scope = String(out.departmentScope || out.department_scope || 'submitter').toLowerCase();
        out.departmentScope = scope === 'specified' ? 'specified' : 'submitter';
        delete out.department_scope;
      }
      if (out.approverType === 'multi_level_manager') {
        const raw = out.managerLevel ?? out.manager_level;
        const level = raw == null ? 2 : Number(raw);
        out.managerLevel = Number.isFinite(level) && level >= 2 ? level : 2;
        delete out.manager_level;
      }
      if (out.decisionOnApproveEnabled && (out.decisionOnApproveField || out.decisionOnApprove?.field)) {
        const field = String(out.decisionOnApproveField || out.decisionOnApprove?.field || '').trim();
        if (field) {
          out.decisionOnApprove = {
            field,
            label: String(out.decisionOnApproveLabel || out.decisionOnApprove?.label || field).trim(),
            defaultValue: Boolean(out.decisionOnApproveDefault ?? out.decisionOnApprove?.defaultValue),
          };
        }
      } else {
        delete out.decisionOnApprove;
      }
      delete out.decisionOnApproveEnabled;
      delete out.decisionOnApproveField;
      delete out.decisionOnApproveLabel;
      delete out.decisionOnApproveDefault;
      out.allowEditDuringApproval = Boolean(out.allowEditDuringApproval);
      out.refreshContextOnEdit = out.refreshContextOnEdit !== false;
      out.allowTransfer = Boolean(out.allowTransfer);
      out.allowAddSign = Boolean(out.allowAddSign);
      if (!out.emptyApproverPolicy) out.emptyApproverPolicy = 'block';
    }
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

  const outEdgeCountBySource = new Map<string, number>();
  edges.forEach((e) => {
    outEdgeCountBySource.set(e.source, (outEdgeCountBySource.get(e.source) || 0) + 1);
  });
  nodes.forEach((node) => {
    if (node.type !== 'condition') return;
    node.data = normalizeConditionNodeData(node.data, outEdgeCountBySource.get(node.id) || 0);
  });

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
      if (t === 'department') {
        if (node.data.departmentScope === 'specified' && idsLen === 0) {
          errors.push(`审批节点「${node.data.label || node.id}」未选择部门`);
        }
      } else if (!DESIGN_TIME_EMPTY_OK.has(t) && idsLen === 0) {
        errors.push(`审批节点「${node.data.label || node.id}」未配置审批人`);
      }
    }
    if (node.type === 'condition') {
      const outEdges = graph.edges.filter((e) => e.source === node.id);
      const conds = node.data.conditions || [];
      const mode = node.data.routeMode;
      if (outEdges.length > 1 && !mode) {
        errors.push(`条件节点「${node.data.label || node.id}」须选择分支触发方式`);
      }
      if (outEdges.length > 1 && conds.length !== outEdges.length) {
        errors.push(`条件节点「${node.data.label || node.id}」出边数与分支数不一致`);
      }
      if (mode === 'formula') {
        const elseCount = conds.filter((c) => c.else).length;
        if (elseCount > 1) {
          errors.push(`条件节点「${node.data.label || node.id}」仅允许一条其余分支`);
        }
        conds.forEach((c, i) => {
          if (c.else) return;
          if (!String(c.field || '').trim()) {
            errors.push(`条件节点「${node.data.label || node.id}」分支 ${i + 1} 须选择字段`);
          }
          if (!conditionValueFilled(c.value)) {
            errors.push(`条件节点「${node.data.label || node.id}」分支 ${i + 1} 须填写比较数值`);
          }
        });
      }
      if (mode === 'previous_approver' || mode === 'initiator') {
        conds.forEach((c, i) => {
          if (!String(c.label || '').trim()) {
            errors.push(`条件节点「${node.data.label || node.id}」分支 ${i + 1} 须填写名称`);
          }
        });
      }
    }
  });
  return errors;
}

/** 表单 approverIds ↔ UI 分字段 */
export function nodeDataToFormValues(data: ApprovalNodeData): ApprovalNodeData {
  const v = { ...data };
  if (v.decisionOnApprove?.field) {
    v.decisionOnApproveEnabled = true;
    v.decisionOnApproveField = v.decisionOnApprove.field;
    v.decisionOnApproveLabel = v.decisionOnApprove.label;
    v.decisionOnApproveDefault = Boolean(v.decisionOnApprove.defaultValue);
  }
  if (v.approverType === 'user') v.approvers = v.approverIds ?? [];
  if (v.approverType === 'role') v.roles = v.approverIds ?? [];
  if (v.approverType === 'department') {
    v.departmentScope = v.departmentScope || 'submitter';
    if (v.departmentScope === 'specified') v.departments = v.approverIds ?? [];
  }
  return v;
}

export function formValuesToNodeData(values: ApprovalNodeData): ApprovalNodeData {
  const v = { ...values };
  if (v.approverType === 'user') {
    if ('approvers' in v) {
      v.approverIds = asList(v.approvers as string[] | string | undefined).map(String).filter(Boolean);
    }
  } else if (v.approverType === 'role') {
    if ('roles' in v) {
      v.approverIds = asList(v.roles as string[] | string | undefined).map(String).filter(Boolean);
    }
  } else if (v.approverType === 'department') {
    if (v.departmentScope === 'specified' && 'departments' in v) {
      v.approverIds = asList(v.departments as string[] | string | undefined).map(String).filter(Boolean);
    } else {
      v.departmentScope = 'submitter';
      delete v.approverIds;
    }
    delete v.departments;
  }
  delete v.approvers;
  delete v.roles;
  return normalizeNodeData('approval', v);
}
