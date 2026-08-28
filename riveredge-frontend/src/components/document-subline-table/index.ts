import './index.less';

/** 子表明细样式类名（费用明细、收款计划等，无竖线） */
export const DOCUMENT_SUBLINE_TABLE_CLASS = 'document-subline-table';

/** 虚线添加按钮：默认主题色描边（费用明细 / 收款计划 / 合同条款） */
export const DOCUMENT_SUBLINE_ADD_BUTTON_CLASS = 'document-subline-add-btn';

export const DOCUMENT_SUBLINE_TABLE_PROPS = {
  className: DOCUMENT_SUBLINE_TABLE_CLASS,
  size: 'small' as const,
  bordered: false as const,
  pagination: false as const,
};
