import { FORM_LAYOUT } from '../../../components/layout-templates';

/** 往来账款新建 / 取单表单：双栏栅格 */
export const financeFormGridProps = {
  grid: true as const,
  rowProps: { gutter: FORM_LAYOUT.GRID_GUTTER },
};

export const financeColHalf = { span: 12 };
export const financeColFull = { span: 24 };

/**
 * 金额录入：用 ProFormDigit，勿用 ProFormMoney。
 * ProFormMoney 的 formatter 在输入末尾小数点时会剥掉「.」，导致无法输入小数。
 */
export const financeAmountDigitFieldProps = {
  precision: 2,
  prefix: '¥',
  style: { width: '100%' as const },
};
