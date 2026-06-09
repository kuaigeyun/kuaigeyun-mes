import { UniActionGroup, type UniActionGroupProps } from './Group'

export { isUniTableOperationColumn } from './operationColumn'
export type {
  UniActionRenderOptions,
  RenderRowActionsOverflowOptions,
  NormalizeActionContext,
} from './types'
export {
  ROW_ACTIONS_DIRECT_MAX,
  ROW_ACTIONS_INLINE_GAP,
  ROW_ACTIONS_MIN_PRIMARY_VISIBLE,
  renderRowActionsOverflow,
} from './overflow'
export { renderUniTableOperationCell } from './renderCell'
export { collectOperationActions } from './collect'
export { normalizeActionTree } from './normalize'
export {
  rowActionKind,
  ROW_ACTION_KIND_ATTR,
  readExplicitActionKind,
  type RowActionPermissionKind,
} from './actionText'
export { filterActionsByResourcePermission } from './filterByPermission'
export { UniActionGroup, type UniActionGroupProps }

export const UniAction = {
  Group: UniActionGroup,
}
