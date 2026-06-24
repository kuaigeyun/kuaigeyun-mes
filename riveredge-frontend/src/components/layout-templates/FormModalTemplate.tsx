/**
 * 表单 Modal 布局模板
 *
 * 与 Ant Design Modal 标准一致：footer 使用 Modal 自带底栏，内容区随全局 .ant-modal-body 限高滚动，
 * 行为与厂区管理等使用本模板的弹窗一致，无内层嵌套滚动条。
 */

import React, { ReactNode, useCallback, useRef } from 'react';
import { Modal, Button, App, Space, Grid } from 'antd';
import { ProForm, ProFormInstance } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { MODAL_CONFIG, FORM_LAYOUT } from './constants';
import { useSubmitShortcut } from '../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../utils/globalSubmitShortcut';

export interface FormModalTemplateProps {
  title: string;
  open: boolean;
  /** 关闭弹窗（与 Modal onCancel 一致） */
  onClose?: () => void;
  /** @deprecated 请使用 onClose */
  onCancel?: () => void;
  onFinish: (values: any) => Promise<void>;
  isEdit?: boolean;
  initialValues?: Record<string, any>;
  /** 表单项；仅使用 formItems 动态表单时可省略 */
  children?: ReactNode;
  width?: number;
  layout?: 'vertical' | 'horizontal';
  grid?: boolean;
  loading?: boolean;
  formRef?:
    | React.RefObject<ProFormInstance | null>
    | React.MutableRefObject<ProFormInstance | undefined>;
  form?: any;
  onValuesChange?: (changedValues: any, allValues: any) => void;
  className?: string;
  modalRender?: (modal: React.ReactNode) => React.ReactNode;
  extraFooter?: ReactNode;
  /** 新建模式主按钮文案，默认使用 i18n submitCreate */
  submitText?: string;
  /** 隐藏默认提交按钮（仅保留取消与 extraFooter） */
  submitHidden?: boolean;
  readOnly?: boolean;
  /** Modal 打开/关闭动画结束后的回调（open 为当前是否打开） */
  afterOpenChange?: (open: boolean) => void;
  /** 与详情抽屉、左侧全链路等同屏时需高于 theme.zIndexPopupBase + 嵌套偏移时使用 */
  zIndex?: number;
  /**
   * 兼容历史上误用的 `<FormModalTemplate {...MODAL_CONFIG} />`；模板不使用这些字段。
   * 弹窗宽度请传 `width={MODAL_CONFIG.STANDARD_WIDTH}` 等。
   */
  STANDARD_WIDTH?: number;
  LARGE_WIDTH?: number;
  EXTRA_LARGE_WIDTH?: number;
  SMALL_WIDTH?: number;
  TINY_WIDTH?: number;
  BODY_MAX_HEIGHT?: string;
  /** @deprecated 未实现；仅从 props 剥离 */
  formItems?: unknown;
}

export const FormModalTemplate: React.FC<FormModalTemplateProps> = ({
  title,
  open,
  onClose,
  onCancel,
  onFinish,
  isEdit = false,
  initialValues,
  children,
  width = MODAL_CONFIG.STANDARD_WIDTH,
  layout = FORM_LAYOUT.VERTICAL,
  grid = false,
  loading = false,
  formRef: externalFormRef,
  form,
  onValuesChange,
  className,
  modalRender,
  extraFooter,
  submitText,
  submitHidden = false,
  afterOpenChange,
  zIndex,
  readOnly = false,
  STANDARD_WIDTH: _sw,
  LARGE_WIDTH: _lw,
  EXTRA_LARGE_WIDTH: _xlw,
  SMALL_WIDTH: _smw,
  TINY_WIDTH: _tw,
  BODY_MAX_HEIGHT: _bmh,
  formItems: _unusedFormItems,
}) => {
  const handleClose = onClose ?? onCancel ?? (() => {});
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md && screens.xs;
  const internalFormRef = useRef<ProFormInstance>();
  const formRef = externalFormRef || internalFormRef;

  /**
   * Modal 底栏与 body 同帧渲染时，ProForm 可能尚未把实例挂到 formRef；直接 submit 会静默无效。
   * 延后到下一帧再调 submit，并在仍无实例时给出提示。
   */
  const triggerFormSubmit = useCallback(() => {
    requestAnimationFrame(() => {
      const inst = formRef.current as ProFormInstance | undefined
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning(t('components.layoutTemplates.formModal.formNotReady'))
        return
      }
      inst.submit()
    })
  }, [formRef, messageApi, t])

  useSubmitShortcut(() => triggerFormSubmit(), open);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={handleClose}
      afterOpenChange={afterOpenChange}
      zIndex={zIndex}
      width={width}
      destroyOnHidden
      className={[className, 'form-modal-template'].filter(Boolean).join(' ')}
      modalRender={modalRender}
      footer={
        readOnly ? (
          <Space wrap>
            {extraFooter}
            <Button onClick={handleClose}>关闭</Button>
          </Space>
        ) : (
          <Space wrap>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            {extraFooter}
            {!submitHidden ? (
              <Button type="primary" loading={loading} onClick={triggerFormSubmit}>
                {(isEdit
                  ? t('components.layoutTemplates.formModal.submitUpdate')
                  : submitText ?? t('components.layoutTemplates.formModal.submitCreate')) + SUBMIT_SHORTCUT_HINT}
              </Button>
            ) : null}
          </Space>
        )
      }
    >
      <div className="form-modal-content-inner">
        <ProForm
          formRef={formRef}
          form={form}
          loading={loading}
          readonly={readOnly}
          onFinish={onFinish}
          onFinishFailed={({ errorFields }) => {
            const first = errorFields?.[0];
            const text = first?.errors?.filter(Boolean)[0];
            messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
          }}
          scrollToFirstError
          onValuesChange={onValuesChange}
          initialValues={initialValues}
          layout={layout}
          grid={isMobile ? true : grid}
          colProps={isMobile ? { span: 24 } : undefined}
          rowProps={{ gutter: FORM_LAYOUT.GRID_GUTTER }}
          submitter={false}
        >
          {children}
        </ProForm>
      </div>
    </Modal>
  );
};

export default FormModalTemplate;
