import { UniActionGroup, type UniActionGroupProps } from './Group'

export { isUniTableOperationColumn } from './operationColumn'
export type {
  UniActionRenderOptions,
  RenderRowActionsOverflowOptions,
  NormalizeActionContext,
} from './types'
export { ROW_ACTIONS_DIRECT_MAX, renderRowActionsOverflow } from './overflow'
export { renderUniTableOperationCell } from './renderCell'
export { collectOperationActions } from './collect'
export { normalizeActionTree } from './normalize'
export { UniActionGroup, type UniActionGroupProps }

export const UniAction = {
  Group: UniActionGroup,
}
