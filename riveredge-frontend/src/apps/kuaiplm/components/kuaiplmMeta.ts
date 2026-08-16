import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';

export const KUAIPLM_PROJECT_STATUS_I18N: Record<string, string> = {
  DRAFT: 'app.kuaiplm.common.projectStatus.draft',
  IN_PROGRESS: 'app.kuaiplm.common.projectStatus.inProgress',
  ON_HOLD: 'app.kuaiplm.common.projectStatus.onHold',
  COMPLETED: 'app.kuaiplm.common.projectStatus.completed',
  CANCELLED: 'app.kuaiplm.common.projectStatus.cancelled',
};

export const KUAIPLM_PROJECT_TYPE_I18N: Record<string, string> = {
  RD: 'app.kuaiplm.common.projectType.rd',
  DELIVERY: 'app.kuaiplm.common.projectType.delivery',
};

export const KUAIPLM_TASK_STATUS_I18N: Record<string, string> = {
  TODO: 'app.kuaiplm.common.taskStatus.todo',
  IN_PROGRESS: 'app.kuaiplm.common.taskStatus.inProgress',
  DONE: 'app.kuaiplm.common.taskStatus.done',
  CANCELLED: 'app.kuaiplm.common.taskStatus.cancelled',
};

export const KUAIPLM_DELIVERABLE_STATUS_I18N: Record<string, string> = {
  PENDING: 'app.kuaiplm.common.deliverableStatus.pending',
  SUBMITTED: 'app.kuaiplm.common.deliverableStatus.submitted',
  APPROVED: 'app.kuaiplm.common.deliverableStatus.approved',
  REJECTED: 'app.kuaiplm.common.deliverableStatus.rejected',
};

export const KUAIPLM_GATE_STATUS_I18N: Record<string, string> = {
  PENDING: 'app.kuaiplm.common.gateStatus.pending',
  IN_PROGRESS: 'app.kuaiplm.common.gateStatus.inProgress',
  PASSED: 'app.kuaiplm.common.gateStatus.passed',
  FAILED: 'app.kuaiplm.common.gateStatus.failed',
  SKIPPED: 'app.kuaiplm.common.gateStatus.skipped',
};

export const KUAIPLM_CHANGE_CATEGORY_I18N: Record<string, string> = {
  bom: 'app.kuaiplm.common.changeCategory.bom',
  route: 'app.kuaiplm.common.changeCategory.route',
  process_route: 'app.kuaiplm.common.changeCategory.route',
  drawing: 'app.kuaiplm.common.changeCategory.drawing',
};

export const KUAIPLM_CHANGE_STATUS_I18N: Record<string, string> = {
  pending: 'app.kuaiplm.common.changeStatus.pending',
  draft: 'app.kuaiplm.common.changeStatus.draft',
  approved: 'app.kuaiplm.common.changeStatus.approved',
  rejected: 'app.kuaiplm.common.changeStatus.rejected',
  executed: 'app.kuaiplm.common.changeStatus.executed',
  cancelled: 'app.kuaiplm.common.changeStatus.cancelled',
};

export const KUAIPLM_BOM_CHANGE_TYPE_I18N: Record<string, string> = {
  item_add: 'app.kuaiplm.common.bomChangeType.itemAdd',
  item_remove: 'app.kuaiplm.common.bomChangeType.itemRemove',
  item_modify: 'app.kuaiplm.common.bomChangeType.itemModify',
  version_change: 'app.kuaiplm.common.bomChangeType.versionChange',
  effective_change: 'app.kuaiplm.common.bomChangeType.effectiveChange',
  other: 'app.kuaiplm.common.bomChangeType.other',
};

export const KUAIPLM_ROUTE_CHANGE_TYPE_I18N: Record<string, string> = {
  operation_change: 'app.kuaiplm.common.routeChangeType.operationChange',
  time_change: 'app.kuaiplm.common.routeChangeType.timeChange',
  sop_change: 'app.kuaiplm.common.routeChangeType.sopChange',
  other: 'app.kuaiplm.common.routeChangeType.other',
};

export const KUAIPLM_DRAWING_CHANGE_TYPE_I18N: Record<string, string> = {
  revision: 'app.kuaiplm.common.drawingChangeType.revision',
  file_replace: 'app.kuaiplm.common.drawingChangeType.file_replace',
  obsolete: 'app.kuaiplm.common.drawingChangeType.obsolete',
  metadata: 'app.kuaiplm.common.drawingChangeType.metadata',
  other: 'app.kuaiplm.common.drawingChangeType.other',
};

/** BOM + 工艺路线变更类型码 → i18n（我的任务/审批内容展示共用） */
export const KUAIPLM_CHANGE_TYPE_I18N: Record<string, string> = {
  ...KUAIPLM_BOM_CHANGE_TYPE_I18N,
  ...KUAIPLM_ROUTE_CHANGE_TYPE_I18N,
  ...KUAIPLM_DRAWING_CHANGE_TYPE_I18N,
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

export const KUAIPLM_ENGINEERING_LINK_I18N: Record<string, string> = {
  bom: 'app.kuaiplm.common.engineeringLink.bom',
  drawing: 'app.kuaiplm.common.engineeringLink.drawing',
  route: 'app.kuaiplm.common.engineeringLink.route',
  process_route: 'app.kuaiplm.common.engineeringLink.route',
  sop: 'app.kuaiplm.common.engineeringLink.sop',
  material: 'app.kuaiplm.common.engineeringLink.material',
  work_order: 'app.kuaiplm.common.engineeringLink.workOrder',
  requirement: 'app.kuaiplm.common.engineeringLink.requirement',
};

export const KUAIPLM_KNOWLEDGE_STATUS_I18N: Record<string, string> = {
  DRAFT: 'app.kuaiplm.knowledgeBase.status.draft',
  PUBLISHED: 'app.kuaiplm.knowledgeBase.status.published',
  ARCHIVED: 'app.kuaiplm.knowledgeBase.status.archived',
};

const PROJECT_STATUS_ANT: Record<string, string> = {
  DRAFT: 'Default',
  IN_PROGRESS: 'Processing',
  ON_HOLD: 'Warning',
  COMPLETED: 'Success',
  CANCELLED: 'Default',
};

export function getKuaiplmProjectStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_PROJECT_STATUS_I18N[String(status).toUpperCase()];
  return key ? t(key) : status;
}

export function getKuaiplmProjectTypeText(t: TFunction, type?: string | null): string {
  if (!type) return '-';
  const key = KUAIPLM_PROJECT_TYPE_I18N[String(type).toUpperCase()];
  return key ? t(key) : type;
}

const PROJECT_TYPE_MARKER_COLOR: Record<string, string> = {
  RD: 'purple',
  DELIVERY: 'blue',
};

/** 项目类型（非状态）：filled MarkerTag */
export function renderKuaiplmProjectTypeMarker(t: TFunction, type?: string | null): React.ReactNode {
  const normalized = String(type ?? 'RD').toUpperCase();
  const text = getKuaiplmProjectTypeText(t, normalized);
  if (text === '-') return '-';
  return React.createElement(
    MarkerTag,
    { color: PROJECT_TYPE_MARKER_COLOR[normalized] ?? 'default' },
    text,
  );
}

/** 默认 NPI 阶段门 key → i18n（与后端 DEFAULT_NPI_GATES 对齐） */
export const KUAIPLM_GATE_KEY_I18N: Record<string, string> = {
  concept: 'app.kuaiplm.common.gate.concept',
  design: 'app.kuaiplm.common.gate.design',
  prototype: 'app.kuaiplm.common.gate.prototype',
  pilot: 'app.kuaiplm.common.gate.pilot',
  release: 'app.kuaiplm.common.gate.release',
  ramp: 'app.kuaiplm.common.gate.ramp',
  first_delivery: 'app.kuaiplm.common.gate.firstDelivery',
  stable_production: 'app.kuaiplm.common.gate.stableProduction',
  service_handover: 'app.kuaiplm.common.gate.serviceHandover',
};

const GATE_KEY_MARKER_COLOR: Record<string, string> = {
  concept: 'purple',
  design: 'geekblue',
  prototype: 'blue',
  pilot: 'cyan',
  release: 'green',
  ramp: 'lime',
  first_delivery: 'orange',
  stable_production: 'gold',
  service_handover: 'magenta',
};

export function getKuaiplmGateText(
  t: TFunction,
  gateKey?: string | null,
  gateName?: string | null,
): string {
  const name = String(gateName ?? '').trim();
  const key = String(gateKey ?? '').trim().toLowerCase();
  if (name && (!key || name.toLowerCase() !== key)) {
    return name;
  }
  if (key) {
    const i18nKey = KUAIPLM_GATE_KEY_I18N[key];
    if (i18nKey) return t(i18nKey);
    return name || gateKey || '-';
  }
  return name || '-';
}

/** 当前阶段门（非状态）：中文阶段名 + filled MarkerTag */
export function renderKuaiplmCurrentGateMarker(
  t: TFunction,
  gateKey?: string | null,
  gateName?: string | null,
): React.ReactNode {
  const text = getKuaiplmGateText(t, gateKey, gateName);
  if (text === '-') return '-';
  const key = String(gateKey ?? '').trim().toLowerCase();
  return React.createElement(
    MarkerTag,
    { color: GATE_KEY_MARKER_COLOR[key] ?? 'processing' },
    text,
  );
}

export function getKuaiplmTaskStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_TASK_STATUS_I18N[String(status).toUpperCase()];
  return key ? t(key) : status;
}

export function getKuaiplmDeliverableStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_DELIVERABLE_STATUS_I18N[String(status).toUpperCase()];
  return key ? t(key) : status;
}

export function getKuaiplmGateStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_GATE_STATUS_I18N[String(status).toUpperCase()];
  return key ? t(key) : status;
}

export function getKuaiplmChangeCategoryText(t: TFunction, category?: string | null): string {
  if (!category) return '-';
  const key = KUAIPLM_CHANGE_CATEGORY_I18N[String(category).toLowerCase()];
  return key ? t(key) : category;
}

export function getKuaiplmChangeStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_CHANGE_STATUS_I18N[String(status).toLowerCase()];
  return key ? t(key) : status;
}

export function getKuaiplmChangeTypeText(
  t: TFunction,
  changeType?: string | null,
  category?: string | null,
): string {
  if (!changeType) return '-';
  const normalized = String(changeType).toLowerCase();
  const bomKey = KUAIPLM_BOM_CHANGE_TYPE_I18N[normalized];
  if (bomKey) return t(bomKey);
  const routeKey = KUAIPLM_ROUTE_CHANGE_TYPE_I18N[normalized];
  if (routeKey) return t(routeKey);
  const drawingKey = KUAIPLM_DRAWING_CHANGE_TYPE_I18N[normalized];
  if (drawingKey) return t(drawingKey);
  if (normalized === 'bom' || normalized === 'process_route' || normalized === 'drawing') {
    return getKuaiplmChangeCategoryText(t, normalized);
  }
  return changeType;
}

export function getKuaiplmEngineeringLinkText(t: TFunction, linkType?: string | null): string {
  if (!linkType) return '-';
  const key = KUAIPLM_ENGINEERING_LINK_I18N[String(linkType).toLowerCase()];
  return key ? t(key) : linkType;
}

export function getKuaiplmEngineeringLinkOptions(t: TFunction) {
  return Object.keys(KUAIPLM_ENGINEERING_LINK_I18N).map((value) => ({
    value,
    label: getKuaiplmEngineeringLinkText(t, value),
  }));
}

export function getKuaiplmKnowledgeStatusText(t: TFunction, status?: string | null): string {
  if (!status) return '-';
  const key = KUAIPLM_KNOWLEDGE_STATUS_I18N[String(status).toUpperCase()];
  return key ? t(key) : status;
}

export function buildKuaiplmProjectStatusValueEnum(t: TFunction): Record<string, { text: string; status?: string }> {
  return Object.fromEntries(
    Object.entries(KUAIPLM_PROJECT_STATUS_I18N).map(([key, i18nKey]) => [
      key,
      { text: t(i18nKey), status: PROJECT_STATUS_ANT[key] ?? 'Default' },
    ]),
  );
}

export function getKuaiplmKnowledgeStatusOptions(t: TFunction) {
  return (['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((value) => ({
    value,
    label: t(KUAIPLM_KNOWLEDGE_STATUS_I18N[value]),
  }));
}

export function getKuaiplmTaskStatusOptions(t: TFunction) {
  return (['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((value) => ({
    value,
    label: t(KUAIPLM_TASK_STATUS_I18N[value]),
  }));
}

export function getKuaiplmDeliverableStatusOptions(t: TFunction) {
  return (['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((value) => ({
    value,
    label: t(KUAIPLM_DELIVERABLE_STATUS_I18N[value]),
  }));
}

export function getKuaiplmGateStatusOptions(t: TFunction) {
  return (['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SKIPPED'] as const).map((value) => ({
    value,
    label: t(KUAIPLM_GATE_STATUS_I18N[value]),
  }));
}

export const KUAIPLM_PROJECT_LIFECYCLE_STAGE_KEYS = ['draft', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

export function getKuaiplmProjectLifecycleStageLabels(t: TFunction): string[] {
  return [
    t('app.kuaiplm.common.projectStatus.draft'),
    t('app.kuaiplm.common.projectStatus.inProgress'),
    t('app.kuaiplm.common.projectStatus.onHold'),
    t('app.kuaiplm.common.projectStatus.completed'),
    t('app.kuaiplm.common.projectStatus.cancelled'),
  ];
}
