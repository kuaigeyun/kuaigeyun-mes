/**
 * 业务单据统一操作列
 *
 * 标准操作顺序：详情、编辑、下推、审核/撤回、删除、更多
 * 常用功能平铺展示，不常用功能折叠到「更多」下拉菜单。
 *
 * @see .cursor/skills/kuaizhizao-page-design-standard
 */

import React from 'react';
import { Space, Button, Dropdown, Modal } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  ArrowDownOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

/** 操作列标准配置 */
export const DOCUMENT_ACTION_COLUMN = {
  title: '操作',
  fixed: 'right' as const,
  width: 200,
  valueType: 'option' as const,
} as const;

/** 操作列较窄配置（3-4 个按钮时） */
export const DOCUMENT_ACTION_COLUMN_NARROW = {
  ...DOCUMENT_ACTION_COLUMN,
  width: 180,
} as const;

export interface DocumentActionButtonProps {
  /** 显示文本 */
  label: string;
  /** 点击回调 */
  onClick: () => void;
  /** 图标 */
  icon?: React.ReactNode;
  /** 是否危险操作（红色） */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 详情按钮 */
export function DetailButton({
  onClick,
  label = '详情',
  icon = <EyeOutlined />,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Button type="link" size="small" icon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}

/** 编辑按钮 */
export function EditButton({
  onClick,
  label = '编辑',
  icon = <EditOutlined />,
  disabled,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="link" size="small" icon={icon} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

/** 删除按钮 */
export function DeleteButton({
  onClick,
  label = '删除',
  icon = <DeleteOutlined />,
  disabled,
  needConfirm = true,
  confirmTitle,
  confirmContent,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  needConfirm?: boolean;
  confirmTitle?: string;
  confirmContent?: string;
}) {
  const handleClick = () => {
    if (needConfirm) {
      Modal.confirm({
        title: confirmTitle || `确定要删除吗？`,
        content: confirmContent,
        okText: '确定',
        cancelText: '取消',
        okType: 'danger',
        onOk: () => onClick(),
      });
    } else {
      onClick();
    }
  };
  return (
    <Button type="link" size="small" danger icon={icon} onClick={handleClick} disabled={disabled}>
      {label}
    </Button>
  );
}

/** 更多下拉菜单项 */
export interface MoreMenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** 更多下拉菜单 */
export function MoreDropdown({
  items,
  children,
}: {
  items: MoreMenuItem[];
  children?: React.ReactNode;
}) {
  if (!items || items.length === 0) return null;
  const menuItems: MenuProps['items'] = items.map((it) => ({
    key: it.key,
    label: it.label,
    icon: it.icon,
    danger: it.danger,
    disabled: it.disabled,
    onClick: it.onClick,
  }));
  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      {children ?? (
        <Button type="link" size="small" icon={<MoreOutlined />}>
          更多
        </Button>
      )}
    </Dropdown>
  );
}

/** 打印菜单项 */
export function printMenuItem(onClick: () => void): MoreMenuItem {
  return {
    key: 'print',
    label: '打印',
    icon: <PrinterOutlined />,
    onClick,
  };
}

/** 下推菜单项 */
export function pushMenuItem(
  key: string,
  label: string,
  onClick: () => void,
  disabled?: boolean
): MoreMenuItem {
  return {
    key,
    label,
    icon: <ArrowDownOutlined />,
    onClick,
    disabled,
  };
}
