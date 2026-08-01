/**
 * 公司名含英文括号时，用智能建议小机器人悬浮窗提示，并提供一键改为中文括号。
 * 交互对齐物料防重助手 MaterialDedupCreateGuard。
 */

import React, { useMemo } from 'react';
import { Form, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import SmartSuggestionFloatPanel, {
  type MessageItem,
} from '../../../components/smart-suggestion-float-panel';
import {
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
} from '../../../components/layout-templates/constants';
import { hasAsciiParentheses, toChineseParentheses } from '../utils/companyNameParentheses';

export const CUSTOMER_FORM_SMART_ANCHOR = "[data-smart-suggestion-anchor='customer-form']";
export const SUPPLIER_FORM_SMART_ANCHOR = "[data-smart-suggestion-anchor='supplier-form']";

type Props = {
  /** 弹窗是否打开 */
  open: boolean;
  /** 定位锚点（与 FormModalTemplate modalRender 上的 data-smart-suggestion-anchor 一致） */
  anchorSelector: string;
  /** 表单字段名，默认 name */
  fieldName?: string;
};

export const CompanyNameAsciiParenHint: React.FC<Props> = ({
  open,
  anchorSelector,
  fieldName = 'name',
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const form = Form.useFormInstance();
  const nameValue = Form.useWatch(fieldName, form);
  const showHint = open && hasAsciiParentheses(nameValue);

  const overlayZIndex =
    token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET + MODAL_NESTED_ABOVE_PARENT_OFFSET;

  const messages = useMemo<MessageItem[]>(() => {
    if (!showHint) return [];
    return [
      {
        title: t('field.partner.companyNameAsciiParenTitle'),
        text: t('field.partner.companyNameAsciiParenHint'),
        tone: 'default',
        actionLabel: t('field.partner.companyNameAsciiParenFix'),
        onAction: () => {
          const current = form.getFieldValue(fieldName);
          form.setFieldValue(fieldName, toChineseParentheses(String(current ?? '')));
        },
      },
    ];
  }, [fieldName, form, showHint, t]);

  if (!open) return null;

  return (
    <SmartSuggestionFloatPanel
      visible={showHint}
      suggestion={null}
      messages={messages}
      anchorSelector={anchorSelector}
      zIndex={overlayZIndex}
    />
  );
};
