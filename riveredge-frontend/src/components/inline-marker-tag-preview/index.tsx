/**
 * UniTable / 列表单元格多枚 MarkerTag 唯一路径。
 *
 * - 单枚启用/类型等：页面直接 MarkerTag + UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS
 * - 多枚并排：本模块 renderInlineMarkerTagGroup / renderInlineMarkerTagPreview
 *
 * 禁止：Space 包徽章、外层 inline span、marginTop 微调、antd 裸 Tag 冒充 MarkerTag。
 * 布局用 inline-flex + gap，与单枚 MarkerTag 同属行内盒，表体 middle 时中线一致。
 */

import React from 'react';
import { Tooltip } from 'antd';
import type { TagProps } from 'antd';
import { MarkerTag } from '../../constants/statusBadges';

export const INLINE_MARKER_TAG_PREVIEW_MAX = 2;

/** UniTable primaryFlex 列实测徽章组宽度（与 data-uni-flex-col 配合） */
export const INLINE_MARKER_TAG_GROUP_CLASS = 'uni-table-inline-marker-tag-group';

const TAG_STYLE: React.CSSProperties = {
  fontSize: 'inherit',
  /* 勿 inherit 行高：会把 Tag 撑得比邻列单枚 MarkerTag 更高，middle 后顶边看起来上浮 */
};

const GROUP_STYLE: React.CSSProperties = {
  /* inline-flex：与单枚 MarkerTag 同属行内盒，表体 middle 时与邻列徽章同一水平线；
   * 块级 flex / Space 会被当成整块盒垂直居中，行高/撑杆差异下会和裸 Tag 错位。 */
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  maxWidth: '100%',
  verticalAlign: 'middle',
};

export type InlineMarkerTagItem = {
  key?: React.Key;
  label: React.ReactNode;
  color?: TagProps['color'];
  title?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

export type InlineMarkerTagGroupOptions = {
  /** 无条目时展示；默认 '-' */
  empty?: React.ReactNode;
  /** 默认 true；监控条等单行场景可 false */
  wrap?: boolean;
};

/**
 * 多枚 MarkerTag 并排（角色、协作人、变更类型、品牌型号等）。
 */
export function renderInlineMarkerTagGroup(
  items: InlineMarkerTagItem[],
  options?: InlineMarkerTagGroupOptions,
): React.ReactNode {
  if (!items.length) return options?.empty ?? '-';
  return (
    <div
      className={INLINE_MARKER_TAG_GROUP_CLASS}
      style={{
        ...GROUP_STYLE,
        flexWrap: options?.wrap === false ? 'nowrap' : 'wrap',
      }}
    >
      {items.map((item, index) => {
        const key = item.key ?? index;
        const clickable = typeof item.onClick === 'function';
        const tag = (
          <MarkerTag
            color={item.color}
            style={{
              ...TAG_STYLE,
              ...(clickable ? { cursor: 'pointer' } : null),
            }}
            onClick={
              clickable
                ? (e) => {
                    e.stopPropagation();
                    item.onClick?.(e);
                  }
                : undefined
            }
          >
            {item.label}
          </MarkerTag>
        );
        if (item.title == null || item.title === '') {
          return <React.Fragment key={key}>{tag}</React.Fragment>;
        }
        return (
          <Tooltip key={key} title={item.title}>
            {tag}
          </Tooltip>
        );
      })}
    </div>
  );
}

export type InlineMarkerTagPreviewOptions = {
  /** 直接展示的条数，默认 2 */
  previewMax?: number;
  /** 溢出文案，入参为标签总数；未传则不显示「等共…」 */
  formatMore?: (totalCount: number) => React.ReactNode;
  color?: TagProps['color'];
};

/**
 * @param labels 已排好序、已去空的文案列表
 */
export function renderInlineMarkerTagPreview(
  labels: string[],
  options?: InlineMarkerTagPreviewOptions,
): React.ReactNode {
  if (!labels.length) return '-';
  const previewMax = options?.previewMax ?? INLINE_MARKER_TAG_PREVIEW_MAX;
  const preview = labels.slice(0, previewMax);
  const totalCount = labels.length;
  const hasMore = totalCount > preview.length;
  const items: InlineMarkerTagItem[] = preview.map((text, index) => ({
    key: `${index}-${text}`,
    label: text,
    color: options?.color,
  }));
  if (hasMore && options?.formatMore) {
    items.push({
      key: 'more',
      label: options.formatMore(totalCount),
      color: 'default',
    });
  }
  return renderInlineMarkerTagGroup(items);
}

export type InlineMarkerTagGroupPreviewOptions = InlineMarkerTagPreviewOptions &
  InlineMarkerTagGroupOptions & {
    /** 溢出摘要徽章 Tooltip；默认用未展示项 label 顿号拼接 */
    overflowTitle?: (hiddenItems: InlineMarkerTagItem[], totalCount: number) => React.ReactNode;
  };

/** 多枚 MarkerTag 预览：前 N 条可点击/带色，超出一条「等共…」摘要（单行 nowrap 默认） */
export function renderInlineMarkerTagGroupPreview(
  items: InlineMarkerTagItem[],
  options?: InlineMarkerTagGroupPreviewOptions,
): React.ReactNode {
  if (!items.length) return options?.empty ?? '-';
  const previewMax = options?.previewMax ?? INLINE_MARKER_TAG_PREVIEW_MAX;
  const preview = items.slice(0, previewMax);
  const totalCount = items.length;
  const hasMore = totalCount > preview.length;
  const rendered: InlineMarkerTagItem[] = [...preview];
  if (hasMore && options?.formatMore) {
    const hidden = items.slice(previewMax);
    rendered.push({
      key: 'more',
      label: options.formatMore(totalCount),
      color: options?.color ?? 'default',
      title:
        options?.overflowTitle?.(hidden, totalCount) ??
        hidden
          .map((item) => item.label)
          .filter((label) => label != null && label !== '')
          .join('、'),
    });
  }
  return renderInlineMarkerTagGroup(rendered, {
    empty: options?.empty,
    wrap: options?.wrap ?? false,
  });
}
