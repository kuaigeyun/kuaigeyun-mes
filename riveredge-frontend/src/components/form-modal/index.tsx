/**
 * 全局统一的表单Modal组件
 *
 * 提供统一的Modal样式和布局，确保所有表单Modal的一致性
 * 支持两列布局和响应式设计
 */

import React from 'react';
import { Modal } from 'antd';

interface FormModalProps {
  /** Modal标题 */
  title: string;
  /** 是否显示Modal */
  open: boolean;
  /** 关闭Modal的回调 */
  onCancel: () => void;
  /** 确认按钮的回调 */
  onOk?: () => void;
  /** 确认按钮loading状态 */
  confirmLoading?: boolean;
  /** Modal宽度，默认1000px */
  width?: number;
  /** Modal内容 */
  children: React.ReactNode;
  /** 其他Modal属性 */
  [key: string]: any;
}

/**
 * 全局统一的表单Modal组件
 */
const FormModal: React.FC<FormModalProps> = ({
  title,
  open,
  onCancel,
  onOk,
  confirmLoading = false,
  width = 1000,
  children,
  ...modalProps
}) => {
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      width={width}
      style={{ top: 20 }}
      destroyOnClose
      {...modalProps}
    >
      {children}
    </Modal>
  );
};

export default FormModal;
