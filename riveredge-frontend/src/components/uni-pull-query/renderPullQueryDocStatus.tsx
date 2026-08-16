import React from 'react';
import type { TFunction } from 'i18next';
import { renderDocumentStatusTag } from '../../utils/documentLifecycleStatusTag';
import {
  normalizeLifecycleStageKey,
  translateLifecycleStageByKey,
  translateReviewStatusByKey,
} from '../../utils/globalLifecycleI18n';

/** 取单弹窗单据流程状态：translateLifecycleStageByKey + StatusTag（唯一路径） */
export function renderPullQueryDocStatus(t: TFunction, value: unknown): React.ReactNode {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const stageKey = normalizeLifecycleStageKey(raw);
  const label = translateLifecycleStageByKey(t, stageKey, raw);
  if (!label || label === '-' || label === '—') return '—';
  const isUntranslatedCode = label === raw && !/[\u4e00-\u9fff]/.test(raw);
  if (isUntranslatedCode) return '—';
  return renderDocumentStatusTag(label, raw);
}

/** 取单弹窗审核状态：reviewStatus.* + StatusTag（唯一路径） */
export function renderPullQueryReviewStatus(t: TFunction, value: unknown): React.ReactNode {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const label = translateReviewStatusByKey(t, raw);
  if (!label || label === '—') return '—';
  return renderDocumentStatusTag(label, raw);
}
