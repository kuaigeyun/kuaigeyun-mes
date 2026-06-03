/**
 * 好力 GO 模具单据审核（应用内简易审核）
 *
 * - 不走平台审批流 / 业务蓝图 audit-required / UniWorkflowActions
 * - 状态：待审核 → 已通过 | 已驳回；API：POST /{id}/approve|reject|revoke-approval
 * - 权限：manifest 的 audit / approve / reject（角色 UI 合并为「审核」；不含 update）
 */

/** 行内审核按钮标记，避免 UniTable 按「站点业务审核」语义隐藏 */
export const MOLD_SHEET_AUDIT_ACTION_ATTR = 'data-mold-sheet-audit';

/** 模具单据列表操作列：不参与全局业务审核开关压制 */
export const MOLD_SHEET_TABLE_ACTION_OPTIONS = {
  suppressAuditSemanticActions: false,
  directMax: 6,
} as const;
