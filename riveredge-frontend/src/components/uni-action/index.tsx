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
  ROW_ACTIONS_STRIP_CLASS,
  renderRowActionsOverflow,
} from './overflow'
export { renderUniTableOperationCell } from './renderCell'
export { collectOperationActions } from './collect'
export { normalizeActionTree } from './normalize'
export { prepareRowActionButton } from './prepareRowActionButton'
export { RowActionButton } from './RowActionButton'
export {
  rowActionLabel,
  rowActionVisualProfileLabel,
  rowActionSortRank,
  rowActionLabelKeep,
  ROW_ACTION_LABEL_KEEP_ATTR,
  shouldInjectRowActionCatalogLabel,
} from './actionCatalog'
export {
  rowActionKind,
  rowActionResetPassword,
  rowActionAddFollowUpFromDocument,
  rowActionTestConnection,
  rowActionBalloonAnnotate,
  rowActionCopyCreate,
  rowActionCollectReceipt,
  rowActionIssueInvoice,
  rowActionSettleVoucher,
  rowActionCreateRefund,
  rowActionFillInvoiceNumber,
  rowActionMakePayment,
  rowActionPickSettlement,
  rowActionMatchSettlement,
  rowActionTransferSettle,
  rowActionViewDocChain,
  rowActionViewBankFlow,
  rowActionNoteEndorse,
  rowActionNoteDiscount,
  rowActionNoteCollect,
  rowActionNoteHonor,
  rowActionTaxCertify,
  rowActionTaxTransferOut,
  rowActionTaxRedFlush,
  rowActionToneDestructive,
  ROW_ACTION_KIND_ATTR,
  ROW_ACTION_TONE_ATTR,
  ROW_ACTION_VISUAL_PROFILE_ATTR,
  readExplicitActionKind,
  readActionVisualProfile,
  type RowActionPermissionKind,
  type RowActionVisualProfile,
} from './actionText'
export { filterActionsByResourcePermission } from './filterByPermission'
export { UniActionGroup, type UniActionGroupProps }

export const UniAction = {
  Group: UniActionGroup,
}
