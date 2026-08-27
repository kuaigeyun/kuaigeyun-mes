/**
 * 单据列表「明细」列：前 2 条物料名 MarkerTag（filled）+ 等 N 项；配合 uniTableRemainderFlex。
 * key 必须用 DOCUMENT_LINE_MATERIALS_KEY（进 GLOBAL_DOC_LIST_FIELD_RANK）。
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../../../constants/statusBadges';

/** 列表明细物料预览列身份（rank 30.5，总数量/合计前） */
export const DOCUMENT_LINE_MATERIALS_KEY = 'line_materials';

export type DocumentLineMaterialPreviewItem = {
  material_name?: string | null;
};

export function renderDocumentLineMaterialsPreview(
  items: DocumentLineMaterialPreviewItem[] | undefined | null,
  t: TFunction,
): React.ReactNode {
  const names = (items || [])
    .map((it) => String(it.material_name ?? '').trim())
    .filter((text) => text.length > 0);
  if (names.length === 0) return '-';
  const preview = names.slice(0, 2);
  const restCount = names.length - preview.length;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {preview.map((text, index) => (
        <MarkerTag key={`${index}-${text}`}>{text}</MarkerTag>
      ))}
      {restCount > 0 ? (
        <MarkerTag color="default">
          {t('app.kuaizhizao.common.linesAndMore', { count: restCount })}
        </MarkerTag>
      ) : null}
    </div>
  );
}

/** UniTable 列声明片段：RemainderFlex 明细预览（页面补 title + render 数据源） */
export const DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS = {
  key: DOCUMENT_LINE_MATERIALS_KEY,
  dataIndex: DOCUMENT_LINE_MATERIALS_KEY,
  minWidth: 160,
  uniTablePrimaryFlex: true,
  uniTableRemainderFlex: true,
  resizable: false,
  ellipsis: false,
  hideInSearch: true,
  onCell: () => ({ style: { whiteSpace: 'normal' as const } }),
} as const;
