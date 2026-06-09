import type { ResourcePermissionGates } from '../../hooks/useResourcePermissions';

/**
 * UniAction：表格操作列渲染选项
 */
export type UniActionRenderOptions = {
  /** 行内操作按功能权限隐藏（由 UniTable 注入） */
  permissionGates?: ResourcePermissionGates;
  /**
   * 与 `ROW_ACTIONS_DIRECT_MAX` 配合：溢出时主行保留 `max(directMax - 1, ROW_ACTIONS_MIN_PRIMARY_VISIBLE)` 个可点击项。
   */
  directMax?: number
  /** 为 true 时，在无站点级审核配置下隐藏「确认 / 审核 / 审批 / 驳回」等审核语义按钮 */
  suppressAuditSemanticActions?: boolean
}

export type RenderRowActionsOverflowOptions = {
  directMax?: number
  suppressAuditSemanticActions?: boolean
}

export type NormalizeActionContext = {
  suppressAuditSemanticActions: boolean
  /** Popconfirm / Tooltip 外层显式 action，供内层 Button 继承语义色与权限标记 */
  inheritedExplicitKind?: import('./actionText').RowActionPermissionKind | null
}
