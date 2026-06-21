import { FORM_LAYOUT } from '../../../components/layout-templates/constants';

export const PERFORMANCE_FORM_MODAL_CLASS = FORM_LAYOUT.PERFORMANCE_FORM_MODAL_CLASS;
export const MODAL_FIELD_HALF_CLASS = FORM_LAYOUT.MODAL_FIELD_HALF_CLASS;
export const MODAL_FIELD_FULL_CLASS = FORM_LAYOUT.MODAL_FIELD_FULL_CLASS;

export function modalHalfWidthFormItemProps() {
  return { className: MODAL_FIELD_HALF_CLASS };
}

export function modalFullWidthFormItemProps() {
  return { className: MODAL_FIELD_FULL_CLASS };
}

/** 日期/时间类控件：半宽表单项 + 控件撑满表单项 */
export function modalDateFieldProps() {
  return {
    formItemProps: modalHalfWidthFormItemProps(),
    fieldProps: { style: { width: '100%' } },
  };
}

/** SchemaFormRenderer：按 colSpan 映射半宽/全宽 class */
export function modalFieldLayoutFromColSpan(colSpan = 12) {
  return colSpan >= 24 ? modalFullWidthFormItemProps() : modalHalfWidthFormItemProps();
}
