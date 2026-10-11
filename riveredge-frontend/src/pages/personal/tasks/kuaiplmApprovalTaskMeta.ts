/**
 * 快研发审批任务展示用 i18n 映射（我的任务页）。
 * 与 apps/kuaiplm/components/kuaiplmMeta 中对应常量一致，不依赖 compose kuaiplm 前端包。
 */

const KUAIPLM_BOM_CHANGE_TYPE_I18N: Record<string, string> = {
  item_add: 'app.kuaiplm.common.bomChangeType.itemAdd',
  item_remove: 'app.kuaiplm.common.bomChangeType.itemRemove',
  item_modify: 'app.kuaiplm.common.bomChangeType.itemModify',
  version_change: 'app.kuaiplm.common.bomChangeType.versionChange',
  effective_change: 'app.kuaiplm.common.bomChangeType.effectiveChange',
  other: 'app.kuaiplm.common.bomChangeType.other',
};

const KUAIPLM_ROUTE_CHANGE_TYPE_I18N: Record<string, string> = {
  operation_change: 'app.kuaiplm.common.routeChangeType.operationChange',
  time_change: 'app.kuaiplm.common.routeChangeType.timeChange',
  sop_change: 'app.kuaiplm.common.routeChangeType.sopChange',
  other: 'app.kuaiplm.common.routeChangeType.other',
};

const KUAIPLM_DRAWING_CHANGE_TYPE_I18N: Record<string, string> = {
  revision: 'app.kuaiplm.common.drawingChangeType.revision',
  file_replace: 'app.kuaiplm.common.drawingChangeType.file_replace',
  obsolete: 'app.kuaiplm.common.drawingChangeType.obsolete',
  metadata: 'app.kuaiplm.common.drawingChangeType.metadata',
  other: 'app.kuaiplm.common.drawingChangeType.other',
};

const KUAIPLM_ECN_CHANGE_KIND_I18N: Record<string, string> = {
  material: 'app.kuaiplm.ecn.changeKind.material',
  process: 'app.kuaiplm.ecn.changeKind.process',
  drawing: 'app.kuaiplm.ecn.changeKind.drawing',
  doc_template: 'app.kuaiplm.ecn.changeKind.doc_template',
  other: 'app.kuaiplm.ecn.changeKind.other',
};

/** BOM + 工艺路线 + 图纸 + ECN 变更类型码 → i18n */
export const KUAIPLM_CHANGE_TYPE_I18N: Record<string, string> = {
  ...KUAIPLM_BOM_CHANGE_TYPE_I18N,
  ...KUAIPLM_ROUTE_CHANGE_TYPE_I18N,
  ...KUAIPLM_DRAWING_CHANGE_TYPE_I18N,
  ...KUAIPLM_ECN_CHANGE_KIND_I18N,
};

/** 审批任务标题前缀（历史存量中文前缀 → i18n） */
export const KUAIPLM_APPROVAL_TITLE_PREFIX_I18N: Array<{
  prefix: string;
  i18nKey: string;
}> = [
  {
    prefix: 'BOM 工程变更',
    i18nKey: 'app.kuaiplm.common.approvalTitle.bomChange',
  },
  {
    prefix: '工艺路线变更',
    i18nKey: 'app.kuaiplm.common.approvalTitle.routeChange',
  },
  {
    prefix: '图纸工程变更',
    i18nKey: 'app.kuaiplm.common.approvalTitle.drawingChange',
  },
];
