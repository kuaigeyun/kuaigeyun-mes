/**
 * 字典项「快速新增」：标准嵌套 Modal，由 Ant Design 管理焦点栈（禁止 Popover/Portal 锚点方案）。
 */

import React from 'react';
import { Modal } from 'antd';
import { MODAL_CONFIG } from '../layout-templates/constants';

export interface QuickCreateModalProps {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLoading?: boolean;
  /** 须高于宿主 FormModalTemplate 的 zIndex */
  zIndex?: number;
  children: React.ReactNode;
  width?: number;
  okText?: string;
  cancelText?: string;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  open,
  title,
  onClose,
  onConfirm,
  confirmLoading,
  zIndex,
  children,
  width = MODAL_CONFIG.TINY_WIDTH,
  okText = '确定',
  cancelText = '取消',
}) => (
  <Modal
    title={title}
    open={open}
    onCancel={onClose}
    onOk={() => void onConfirm()}
    confirmLoading={confirmLoading}
    zIndex={zIndex}
    destroyOnHidden
    width={width}
    okText={okText}
    cancelText={cancelText}
  >
    {children}
  </Modal>
);
