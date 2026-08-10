/**
 * 单据跟踪中心面板
 *
 * 注意：本 barrel 仅做 re-export。全链路 FlowGraph（@ant-design/graphs）在
 * DocumentTrackingRelationsTabsBody 内懒加载；列表页只引 Timeline / useDocumentTracking
 * 时不得把 G6 / xlsx 假依赖打进首屏。
 */

export { RelationLayout as DocumentTrackingRelationsBody } from './RelationLayout';
export { DocumentTrackingRelationsTabsBody } from './DocumentTrackingRelationsTabsBody';
export { DocumentTrackingTimelineBody } from './DocumentTrackingTimelineBody';
export { useDocumentTracking } from './useDocumentTracking';
/** TraceLinkedDocumentBrief 勿从此 barrel 再导出：含副作用依赖时会破坏列表页对 Timeline 的 tree-shake */
export { DocumentTrackingPanel } from './DocumentTrackingPanel';
export { default } from './DocumentTrackingPanel';
