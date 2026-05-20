/**
 * uni-batch：列表批量操作统一入口（不限于删除）。
 * 任意「依赖选中行」的批量能力可共用同一按钮形态：可选二次确认、无选中时默认禁用等。
 * 删除场景请使用预设 `UniBatchDeleteButton`（基于 `UniBatchButton`）。
 */

import React from 'react';
import { Button, Dropdown, Popconfirm, Space } from 'antd';
import type { ButtonProps, MenuProps, PopconfirmProps } from 'antd';
import { DeleteOutlined, DownOutlined } from '@ant-design/icons';
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

export type UniBatchSplitMenuItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** 点击菜单项；默认传入当前 selectedRowKeys */
  onClick: (keys: React.Key[]) => void | Promise<void>;
  disabled?: boolean;
};

export interface UniBatchSplitToolbarProps {
  selectedRowKeys: React.Key[];
  onDelete: (keys: React.Key[]) => void | Promise<void>;
  /** 下拉中的其它批量操作（不含删除） */
  menuItems?: UniBatchSplitMenuItem[];
  toolBarButtonSize?: ButtonProps['size'];
  deleteButtonText?: string;
  confirmTitle?: string | ((count: number) => string);
  confirmDescription?: string | ((count: number) => string);
}

/**
 * 批量操作分裂按钮：主按钮为批量删除（带确认），右侧下拉为更多批量能力。
 */
export const UniBatchSplitToolbar: React.FC<UniBatchSplitToolbarProps> = ({
  selectedRowKeys,
  onDelete,
  menuItems = [],
  toolBarButtonSize = 'middle',
  deleteButtonText,
  confirmTitle,
  confirmDescription,
}) => {
  const { t } = useTranslation();
  const count = selectedRowKeys.length;
  const disabled = count === 0;

  const runDelete = () => void onDelete(selectedRowKeys);

  const title =
    typeof confirmTitle === 'function' ? confirmTitle(count) : (confirmTitle ?? t('common.confirmBatchDelete'));
  const description =
    typeof confirmDescription === 'function'
      ? confirmDescription(count)
      : (confirmDescription ?? t('common.confirmBatchDeleteContent', { count }));

  const dropdownMenu: MenuProps = {
    items: menuItems.map((it) => ({
      key: it.key,
      label: it.label,
      icon: it.icon,
      disabled: it.disabled ?? disabled,
      onClick: () => void it.onClick(selectedRowKeys),
    })),
  };

  return (
    <Space.Compact className="uni-batch-split-toolbar">
      <Popconfirm
        title={title}
        description={description}
        onConfirm={runDelete}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        disabled={disabled}
      >
        <Button
          type="default"
          danger
          disabled={disabled}
          icon={<DeleteOutlined />}
          size={toolBarButtonSize}
        >
          {deleteButtonText ?? t('components.uniTable.delete')}
        </Button>
      </Popconfirm>
      <Dropdown menu={dropdownMenu} trigger={['click']} disabled={disabled && menuItems.length === 0}>
        <Button
          type="default"
          danger
          disabled={disabled}
          icon={<DownOutlined style={{ fontSize: 10, opacity: 0.75 }} />}
          size={toolBarButtonSize}
        />
      </Dropdown>
    </Space.Compact>
  );
};
