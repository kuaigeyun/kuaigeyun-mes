/**
 * 表单 Modal 布局模板
 *
 * 与 Ant Design Modal 标准一致：footer 使用 Modal 自带底栏，内容区随全局 .ant-modal-body 限高滚动，
 * 行为与厂区管理等使用本模板的弹窗一致，无内层嵌套滚动条。
 */

import React, { ReactNode, useRef } from 'react';
import { Modal, Button, App, Space } from 'antd';
import { ProForm, ProFormInstance } from '@ant-design/pro-components';
import { MODAL_CONFIG, FORM_LAYOUT } from './constants';
import { useSubmitShortcut } from '../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../utils/globalSubmitShortcut';

export interface FormModalTemplateProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onFinish: (values: any) => Promise<void>;
  isEdit?: boolean;
  initialValues?: Record<string, any>;
  children: ReactNode;
  width?: number;
  layout?: 'vertical' | 'horizontal';
  grid?: boolean;
  loading?: boolean;
  formRef?: React.RefObject<ProFormInstance>;
  form?: any;
  onValuesChange?: (changedValues: any, allValues: any) => void;
  className?: string;
  modalRender?: (modal: React.ReactNode) => React.ReactNode;
  extraFooter?: ReactNode;
  /** Modal 打开/关闭动画结束后的回调（open 为当前是否打开） */
  afterOpenChange?: (open: boolean) => void;
}

export const FormModalTemplate: React.FC<FormModalTemplateProps> = ({
  title,
  open,
  onClose,
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
  afterOpenChange,
}) => {
  const { message: messageApi } = App.useApp();
  const internalFormRef = useRef<ProFormInstance>();
  const formRef = externalFormRef || internalFormRef;

  useSubmitShortcut(() => formRef.current?.submit(), open);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      afterOpenChange={afterOpenChange}
      width={width}
      destroyOnHidden
      className={[className, 'form-modal-template'].filter(Boolean).join(' ')}
      modalRender={modalRender}
      footer={
        <Space wrap>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={() => formRef.current?.submit()}>
            {(isEdit ? '更新' : '创建') + SUBMIT_SHORTCUT_HINT}
          </Button>
          {extraFooter}
        </Space>
      }
    >
      <div className="form-modal-content-inner">
        <ProForm
          formRef={formRef}
          form={form}
          loading={loading}
          onFinish={onFinish}
          onFinishFailed={({ errorFields }) => {
            const first = errorFields?.[0];
            const text = first?.errors?.filter(Boolean)[0];
            messageApi.error(text || '请检查表单填写是否完整');
          }}
          scrollToFirstError
          onValuesChange={onValuesChange}
          initialValues={initialValues}
          layout={layout}
          grid={grid}
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
