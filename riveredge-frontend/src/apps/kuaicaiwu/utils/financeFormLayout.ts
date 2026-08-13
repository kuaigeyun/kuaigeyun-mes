import { FORM_LAYOUT } from '../../../components/layout-templates';

/** 往来账款新建 / 取单表单：双栏栅格 */
export const financeFormGridProps = {
  grid: true as const,
  rowProps: { gutter: FORM_LAYOUT.GRID_GUTTER },
};

export const financeColHalf = { span: 12 };
export const financeColFull = { span: 24 };
