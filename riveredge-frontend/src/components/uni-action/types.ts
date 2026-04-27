/**
 * UniAction：表格操作列渲染选项
 */
export type UniActionRenderOptions = {
  /** 直显操作项上限，超出部分收入「更多」下拉，默认 3 */
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
}
