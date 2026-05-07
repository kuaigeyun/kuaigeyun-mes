/**
 * uni-batch：列表批量操作统一入口（不限于删除）。
 * 任意「依赖选中行」的批量能力可共用同一按钮形态：可选二次确认、无选中时默认禁用等。
 * 删除场景请使用预设 `UniBatchDeleteButton`（基于 `UniBatchButton`）。
 */

import React from 'react';
import { Button, Popconfirm } from 'antd';
import type { ButtonProps, PopconfirmProps } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniBatchButtonProps = Omit<ButtonProps, 'onClick' | 'disabled'> & {
  selectedRowKeys: React.Key[];
  /** 对当前选中行执行操作（确认后或点击后直接调用） */
  onAction: (keys: React.Key[]) => void | Promise<void>;
  /** 覆盖禁用态；未传时由 disableWhenEmpty 与选中行数决定 */
  disabled?: boolean;
  /** 未显式设置 disabled 时，是否在无选中行时禁用按钮，默认 true */
  disableWhenEmpty?: boolean;
  /** 是否在操作前弹出确认框 */
  requireConfirm?: boolean;
  confirmTitle?: React.ReactNode | ((count: number) => React.ReactNode);
  confirmDescription?: React.ReactNode | ((count: number) => React.ReactNode);
  okText?: string;
  cancelText?: string;
  okButtonProps?: PopconfirmProps['okButtonProps'];
  cancelButtonProps?: PopconfirmProps['cancelButtonProps'];
};

export const UniBatchButton: React.FC<UniBatchButtonProps> = ({
  selectedRowKeys,
  onAction,
  disabled: disabledProp,
  disableWhenEmpty = true,
  requireConfirm = false,
  confirmTitle,
  confirmDescription,
  okText,
  cancelText,
  okButtonProps,
  cancelButtonProps,
  children,
  ...buttonProps
}) => {
  const { t } = useTranslation();
  const count = selectedRowKeys.length;
  const emptyDisabled = disableWhenEmpty && count === 0;
  const disabled = disabledProp ?? emptyDisabled;

  const run = () => void onAction(selectedRowKeys);

  const title =
    typeof confirmTitle === 'function' ? confirmTitle(count) : confirmTitle;
  const description =
    typeof confirmDescription === 'function'
      ? confirmDescription(count)
      : confirmDescription;

  const button = (
    <Button
      {...buttonProps}
      disabled={disabled}
      onClick={requireConfirm ? undefined : run}
    >
      {children}
    </Button>
  );

  if (!requireConfirm) {
    return button;
  }

  return (
    <Popconfirm
      title={title}
      description={description}
      onConfirm={run}
      okText={okText ?? t('common.confirm')}
      cancelText={cancelText ?? t('common.cancel')}
      okButtonProps={okButtonProps}
      cancelButtonProps={cancelButtonProps}
      disabled={disabled}
    >
      {button}
    </Popconfirm>
  );
};

export interface UniBatchDeleteButtonProps {
  selectedRowKeys: React.Key[];
  onConfirm: (keys: React.Key[]) => void | Promise<void>;
  toolBarButtonSize?: ButtonProps['size'];
  buttonText?: string;
  confirmTitle?: string | ((count: number) => string);
  confirmDescription?: string | ((count: number) => string);
}

export const UniBatchDeleteButton: React.FC<UniBatchDeleteButtonProps> = ({
  selectedRowKeys,
  onConfirm,
  toolBarButtonSize = 'middle',
  buttonText,
  confirmTitle,
  confirmDescription,
}) => {
  const { t } = useTranslation();
  const count = selectedRowKeys.length;
  return (
    <UniBatchButton
      selectedRowKeys={selectedRowKeys}
      onAction={onConfirm}
      type="default"
      danger
      icon={<DeleteOutlined />}
      size={toolBarButtonSize}
      requireConfirm
      confirmTitle={
        typeof confirmTitle === 'function'
          ? confirmTitle
          : (confirmTitle ?? t('common.confirmBatchDelete'))
      }
      confirmDescription={
        typeof confirmDescription === 'function'
          ? confirmDescription
          : (confirmDescription ??
            t('common.confirmBatchDeleteContent', { count }))
      }
      okButtonProps={{ danger: true }}
    >
      {buttonText ?? t('components.uniTable.delete')}
    </UniBatchButton>
  );
};
