/**
 * 全局业务状态徽章约定（与 `src/global.less` 中 `--re-badge-draft-*`、`.re-status-badge-draft` 一致）
 *
 * 草稿类 Tag 不要写死色值，使用 `RE_STATUS_BADGE_DRAFT` + `resolveStatusTagDisplayProps`。
 */

import type { TagProps } from 'antd';

/** 占位 color：表示使用全局草稿徽章样式类 */
export const RE_STATUS_BADGE_DRAFT = '__re_status_badge_draft__';

/** 与 global.less 中 `.re-status-badge-draft` 对应 */
export const RE_STATUS_BADGE_DRAFT_CLASS = 're-status-badge-draft';

/**
 * 将 { text, color } 转为 Ant Design Tag 的 className / color。
 * 草稿占位符走全局 CSS 变量，其余走原有 color 预设或自定义色。
 */
export function resolveStatusTagDisplayProps(display: {
  text: string;
  color: string;
}): Pick<TagProps, 'className' | 'color'> {
  if (display.color === RE_STATUS_BADGE_DRAFT) {
    return { className: RE_STATUS_BADGE_DRAFT_CLASS };
  }
  return { color: display.color };
}
