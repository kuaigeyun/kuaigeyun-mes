import './index.less';

/** 子表明细样式类名（费用明细、收款计划等，无竖线） */
export const DOCUMENT_SUBLINE_TABLE_CLASS = 'document-subline-table';

export const DOCUMENT_SUBLINE_TABLE_PROPS = {
  className: DOCUMENT_SUBLINE_TABLE_CLASS,
  size: 'small' as const,
  bordered: false as const,
  pagination: false as const,
};
