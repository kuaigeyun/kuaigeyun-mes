/**
 * 全局业务状态徽章约定（与 `src/global.less` 中 `--re-badge-draft-*`、`.re-status-badge-draft` 一致）
 *
 * 约定（唯一路径，禁止逐页补丁）：
 * - `app.tsx` ConfigProvider：`tag={{ variant: 'solid' }}` —— 状态类默认实心
 * - 分类 / 模式 / 编组 / 版本 / 计数等**非状态**标识：显式 `variant="filled"`
 * - 草稿类不要写死色值，使用 `RE_STATUS_BADGE_DRAFT` + `resolveStatusTagDisplayProps` / `StatusTag`
 */

import React from 'react';
import { Tag } from 'antd';
import type { TagProps } from 'antd';

/** 占位 color：表示使用全局草稿徽章样式类 */
export const RE_STATUS_BADGE_DRAFT = '__re_status_badge_draft__';

/** 与 global.less 中 `.re-status-badge-draft` 对应 */
export const RE_STATUS_BADGE_DRAFT_CLASS = 're-status-badge-draft';

/** 状态类 Tag（与 ConfigProvider 默认一致；可省略） */
export const STATUS_TAG_VARIANT = 'solid' as const;

/** 非状态标识 Tag（模式/编组/版本等）须显式使用，避免抢焦点 */
export const MARKER_TAG_VARIANT = 'filled' as const;

/**
 * 将 { text, color } 转为 Ant Design Tag 的 className / color / variant。
 * 草稿占位符走全局 CSS 变量，其余走原有 color 预设或自定义色。
 */
export function resolveStatusTagDisplayProps(display: {
  text: string;
  color: string;
}): Pick<TagProps, 'className' | 'color' | 'variant'> {
  if (display.color === RE_STATUS_BADGE_DRAFT) {
    return { className: RE_STATUS_BADGE_DRAFT_CLASS, variant: STATUS_TAG_VARIANT };
  }
  return { color: display.color, variant: STATUS_TAG_VARIANT };
}

/**
 * 状态类徽章（默认 solid，与全局 ConfigProvider 一致）。
 */
export function StatusTag({ variant = STATUS_TAG_VARIANT, ...rest }: TagProps) {
  return React.createElement(Tag, { variant, ...rest });
}

/**
 * 非状态标识徽章（模式/编组/版本/计数等）：强制 filled，不抢状态列焦点。
 */
export function MarkerTag({ variant = MARKER_TAG_VARIANT, ...rest }: TagProps) {
  return React.createElement(Tag, { variant, ...rest });
}
