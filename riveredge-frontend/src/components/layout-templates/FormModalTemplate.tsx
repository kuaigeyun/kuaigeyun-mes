/**
 * 表单 Modal 布局模板
 *
 * 提供统一的表单 Modal 布局，遵循 Ant Design 设计规范
 * 使用 ProForm 实现标准化的表单布局
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode, useRef } from 'react';
import { Modal, theme } from 'antd';
import { ProForm, ProFormInstance } from '@ant-design/pro-components';
import { MODAL_CONFIG, FORM_LAYOUT } from './constants';

const { useToken } = theme;

/**
 * 表单 Modal 模板属性
 */
export interface FormModalTemplateProps {
  /** Modal 标题 */
  title: string;
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交回调 */
  onFinish: (values: any) => Promise<void>;
  /** 是否为编辑模式 */
  isEdit?: boolean;
  /** 表单初始值 */
  initialValues?: Record<string, any>;
  /** 表单子元素 */
  children: ReactNode;
  /** Modal 宽度（默认：标准宽度） */
  width?: number;
  /** 表单布局类型（默认：垂直布局） */
  layout?: 'vertical' | 'horizontal';
  /** 是否启用网格布局（默认：true） */
  grid?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 表单引用（可选，用于外部访问表单实例） */
  formRef?: React.RefObject<ProFormInstance>;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 表单 Modal 布局模板
 *
 * @example
 * ```tsx
 * <FormModalTemplate
 *   title={isEdit ? '编辑客户' : '新建客户'}
 *   open={modalVisible}
 *   onClose={() => setModalVisible(false)}
 *   onFinish={handleSubmit}
 *   isEdit={isEdit}
 *   initialValues={formValues}
 * >
 *   <ProFormText name="code" label="编码" />
 *   <ProFormText name="name" label="名称" />
 * </FormModalTemplate>
 * ```
 */
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
  grid = true,
  loading = false,
  formRef: externalFormRef,
  className,
}) => {
  const { token } = useToken();
  const internalFormRef = useRef<ProFormInstance>();
  const formRef = externalFormRef || internalFormRef;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      destroyOnHidden
      className={className}
      styles={{
        body: { maxHeight: '70vh', overflow: 'hidden' },
      }}
    >
      <ProForm
        formRef={formRef}
        loading={loading}
        onFinish={onFinish}
        initialValues={initialValues}
        layout={layout}
        grid={grid}
        rowProps={{ gutter: FORM_LAYOUT.GRID_GUTTER }}
        submitter={{
          searchConfig: {
            submitText: isEdit ? '更新' : '创建',
            resetText: '取消',
          },
          resetButtonProps: {
            onClick: onClose,
          },
        }}
      >
        {children}
      </ProForm>
    </Modal>
  );
};

export default FormModalTemplate;

