/**
 * Phase2 研发协同：需求 / 设计评审 / FMEA 状态与分类徽章（唯一真源）
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag, StatusTag } from '../../../constants/statusBadges';

export const PHASE2_REQUIREMENT_STATUS_I18N: Record<string, string> = {
  DRAFT: 'app.kuaiplm.phase2.common.status.draft',
  IN_PROGRESS: 'app.kuaiplm.phase2.common.status.inProgress',
  DONE: 'app.kuaiplm.phase2.common.status.done',
  ARCHIVED: 'app.kuaiplm.phase2.common.status.archived',
};

/** 与后端模型默认 PLANNED 及 dashboard 筛选一致 */
export const PHASE2_DESIGN_REVIEW_STATUS_I18N: Record<string, string> = {
  PLANNED: 'app.kuaiplm.phase2.common.status.planned',
  IN_REVIEW: 'app.kuaiplm.phase2.common.status.inReview',
  COMPLETED: 'app.kuaiplm.phase2.common.status.completed',
  ARCHIVED: 'app.kuaiplm.phase2.common.status.archived',
  DRAFT: 'app.kuaiplm.phase2.common.status.draft',
  IN_PROGRESS: 'app.kuaiplm.phase2.common.status.inProgress',
};

export const PHASE2_FMEA_STATUS_I18N: Record<string, string> = {
  DRAFT: 'app.kuaiplm.phase2.common.status.draft',
  IN_REVIEW: 'app.kuaiplm.phase2.common.status.inReview',
  CLOSED: 'app.kuaiplm.phase2.common.status.closed',
  ARCHIVED: 'app.kuaiplm.phase2.common.status.archived',
};

export const PHASE2_PRIORITY_I18N: Record<string, string> = {
  high: 'app.kuaiplm.phase2.common.priority.high',
  normal: 'app.kuaiplm.phase2.common.priority.normal',
  low: 'app.kuaiplm.phase2.common.priority.low',
};

export const PHASE2_REVIEW_TYPE_I18N: Record<string, string> = {
  初步设计: 'app.kuaiplm.phase2.designReviews.type.preliminary',
  详细设计: 'app.kuaiplm.phase2.designReviews.type.detailed',
  试制评审: 'app.kuaiplm.phase2.designReviews.type.trial',
};

const PHASE2_STATUS_TAG_COLOR: Record<string, string> = {
  DRAFT: 'default',
  PLANNED: 'default',
  IN_PROGRESS: 'processing',
  IN_REVIEW: 'processing',
  DONE: 'success',
  COMPLETED: 'success',
  CLOSED: 'success',
  ARCHIVED: 'default',
};

const PHASE2_STATUS_PRO_ENUM: Record<string, string> = {
  default: 'Default',
  processing: 'Processing',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

const PHASE2_PRIORITY_MARKER_COLOR: Record<string, string> = {
  high: 'error',
  normal: 'processing',
  low: 'default',
};

const PHASE2_REVIEW_TYPE_MARKER_COLOR: Record<string, string> = {
  初步设计: 'geekblue',
  详细设计: 'purple',
  试制评审: 'cyan',
};

const PHASE2_FMEA_TYPE_MARKER_COLOR: Record<string, string> = {
  DFMEA: 'geekblue',
  PFMEA: 'purple',
};

function normalizePhase2StatusCode(status?: string | null): string {
  return String(status ?? '').trim().toUpperCase();
}

function resolvePhase2StatusText(
  t: TFunction,
  status: string | null | undefined,
  i18nMap: Record<string, string>,
): string {
  const raw = String(status ?? '').trim();
  if (!raw) return '-';
  const normalized = normalizePhase2StatusCode(raw);
  const key = i18nMap[normalized];
  return key ? t(key) : raw;
}

function resolvePhase2StatusTagColor(status?: string | null): string {
  const normalized = normalizePhase2StatusCode(status);
  return PHASE2_STATUS_TAG_COLOR[normalized] ?? 'default';
}

function toProTableStatus(color: string): string {
  return PHASE2_STATUS_PRO_ENUM[color] ?? 'Default';
}

function buildPhase2StatusValueEnum(
  t: TFunction,
  i18nMap: Record<string, string>,
): Record<string, { text: string; status: string }> {
  return Object.fromEntries(
    Object.entries(i18nMap).map(([value, i18nKey]) => {
      const color = resolvePhase2StatusTagColor(value);
      return [value, { text: t(i18nKey), status: toProTableStatus(color) }];
    }),
  );
}

export function getPhase2RequirementStatusText(t: TFunction, status?: string | null): string {
  return resolvePhase2StatusText(t, status, PHASE2_REQUIREMENT_STATUS_I18N);
}

export function getPhase2DesignReviewStatusText(t: TFunction, status?: string | null): string {
  return resolvePhase2StatusText(t, status, PHASE2_DESIGN_REVIEW_STATUS_I18N);
}

export function getPhase2FmeaStatusText(t: TFunction, status?: string | null): string {
  return resolvePhase2StatusText(t, status, PHASE2_FMEA_STATUS_I18N);
}

export function renderPhase2RequirementStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getPhase2RequirementStatusText(t, status);
  if (text === '-') return '-';
  return React.createElement(StatusTag, { color: resolvePhase2StatusTagColor(status) }, text);
}

export function renderPhase2DesignReviewStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getPhase2DesignReviewStatusText(t, status);
  if (text === '-') return '-';
  return React.createElement(StatusTag, { color: resolvePhase2StatusTagColor(status) }, text);
}

export function renderPhase2FmeaStatusTag(t: TFunction, status?: string | null): React.ReactNode {
  const text = getPhase2FmeaStatusText(t, status);
  if (text === '-') return '-';
  return React.createElement(StatusTag, { color: resolvePhase2StatusTagColor(status) }, text);
}

export function buildPhase2RequirementStatusValueEnum(t: TFunction) {
  return buildPhase2StatusValueEnum(t, PHASE2_REQUIREMENT_STATUS_I18N);
}

export function buildPhase2DesignReviewStatusValueEnum(t: TFunction) {
  return buildPhase2StatusValueEnum(t, PHASE2_DESIGN_REVIEW_STATUS_I18N);
}

export function buildPhase2FmeaStatusValueEnum(t: TFunction) {
  return buildPhase2StatusValueEnum(t, PHASE2_FMEA_STATUS_I18N);
}

export function getPhase2PriorityText(t: TFunction, priority?: string | null): string {
  const raw = String(priority ?? '').trim().toLowerCase();
  if (!raw) return '-';
  const key = PHASE2_PRIORITY_I18N[raw];
  return key ? t(key) : priority || '-';
}

export function renderPhase2PriorityMarker(t: TFunction, priority?: string | null): React.ReactNode {
  const text = getPhase2PriorityText(t, priority);
  if (text === '-') return '-';
  const key = String(priority ?? '').trim().toLowerCase();
  return React.createElement(
    MarkerTag,
    { color: PHASE2_PRIORITY_MARKER_COLOR[key] ?? 'default' },
    text,
  );
}

export function buildPhase2PriorityValueEnum(t: TFunction): Record<string, { text: string }> {
  return Object.fromEntries(
    Object.entries(PHASE2_PRIORITY_I18N).map(([value, i18nKey]) => [value, { text: t(i18nKey) }]),
  );
}

export function getPhase2ReviewTypeText(t: TFunction, reviewType?: string | null): string {
  const raw = String(reviewType ?? '').trim();
  if (!raw) return '-';
  const key = PHASE2_REVIEW_TYPE_I18N[raw];
  return key ? t(key) : raw;
}

export function renderPhase2ReviewTypeMarker(t: TFunction, reviewType?: string | null): React.ReactNode {
  const text = getPhase2ReviewTypeText(t, reviewType);
  if (text === '-') return '-';
  const raw = String(reviewType ?? '').trim();
  return React.createElement(
    MarkerTag,
    { color: PHASE2_REVIEW_TYPE_MARKER_COLOR[raw] ?? 'default' },
    text,
  );
}

export function renderPhase2FmeaTypeMarker(fmeaType?: string | null): React.ReactNode {
  const raw = String(fmeaType ?? '').trim().toUpperCase();
  if (!raw) return '-';
  return React.createElement(
    MarkerTag,
    { color: PHASE2_FMEA_TYPE_MARKER_COLOR[raw] ?? 'default' },
    raw,
  );
}

export function getPhase2RequirementStatusOptions(t: TFunction) {
  return (['DRAFT', 'IN_PROGRESS', 'DONE', 'ARCHIVED'] as const).map((value) => ({
    value,
    label: t(PHASE2_REQUIREMENT_STATUS_I18N[value]),
  }));
}

export function getPhase2DesignReviewStatusOptions(t: TFunction) {
  return (['PLANNED', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'] as const).map((value) => ({
    value,
    label: t(PHASE2_DESIGN_REVIEW_STATUS_I18N[value]),
  }));
}

export function getPhase2FmeaStatusOptions(t: TFunction) {
  return (['DRAFT', 'IN_REVIEW', 'CLOSED', 'ARCHIVED'] as const).map((value) => ({
    value,
    label: t(PHASE2_FMEA_STATUS_I18N[value]),
  }));
}
