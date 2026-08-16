/**
 * 单据生命周期 / 执行状态 → StatusTag（全局统一）
 *
 * 配色真源：`constants/documentStatusColors.ts`
 * 组件：`StatusTag` solid（见 statusBadges）
 */

import React from 'react';
import type { TagProps } from 'antd';
import { resolveDocumentStatusTagColor } from '../constants/documentStatusColors';
import {
  RE_STATUS_BADGE_DRAFT,
  RE_STATUS_BADGE_DRAFT_CLASS,
  STATUS_TAG_VARIANT,
  StatusTag,
} from '../constants/statusBadges';

/**
 * 根据生命周期当前阶段名（或状态码）返回 Ant Design Tag 的 color / className / variant。
 * 未知阶段 → muted（default 中灰实心）。
 */
export function getDocumentLifecycleStageTagProps(
  stageNameOrCode: string | null | undefined,
): Pick<TagProps, 'color' | 'className' | 'variant'> {
  const raw = (stageNameOrCode ?? '').trim();
  if (!raw || raw === '-' || raw === '—') {
    return { color: 'default', variant: STATUS_TAG_VARIANT };
  }

  const color = resolveDocumentStatusTagColor(raw);
  if (color === RE_STATUS_BADGE_DRAFT) {
    return { className: RE_STATUS_BADGE_DRAFT_CLASS, variant: STATUS_TAG_VARIANT };
  }
  return { color, variant: STATUS_TAG_VARIANT };
}

/**
 * 单据/流程状态徽章（solid）。优先按原始码查色，展示文案用 displayLabel。
 */
export function renderDocumentStatusTag(
  displayLabel: string | null | undefined,
  rawCode?: string | null,
): React.ReactNode {
  const text = (displayLabel ?? '').trim();
  if (!text || text === '-') return '-';
  const lookupKey = (rawCode ?? text).trim();
  return React.createElement(StatusTag, { color: resolveDocumentStatusTagColor(lookupKey) }, text);
}
