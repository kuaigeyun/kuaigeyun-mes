/**
 * 业务单据统一操作列
 *
 * 标准操作顺序：详情、编辑、下推、审核/撤回、删除、更多
 * 常用功能平铺展示，不常用功能折叠到「更多」下拉菜单。
 *
 * @see .cursor/skills/kuaizhizao-page-design-standard
 */

import React from 'react';
import { rowActionKind, type RowActionPermissionKind } from '../uni-action';
import { Space, Button, Dropdown, Modal, Tooltip } from 'antd';
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
  /** 禁用提示 */
  disabledReason?: string;
}

export interface ActionDescriptor {
  key: string;
  /** manifest 标准 action，行内 RBAC 唯一依据 */
  permissionKind: RowActionPermissionKind;
  label: React.ReactNode;
  onClick?: () => void;
  visible?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  group?: 'primary' | 'more' | 'push';
}

/** 详情按钮 */
export function DetailButton({
  onClick,
  label = '详情',
  icon,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Button {...rowActionKind('read')} type="link" size="small" icon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}

/** 编辑按钮 */
export function EditButton({
  onClick,
  label = '编辑',
  icon,
  disabled,
  disabledReason,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const btn = (
    <Button {...rowActionKind('update')} type="link" size="small" icon={icon} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
  if (disabled && disabledReason) {
    return <Tooltip title={disabledReason}>{btn}</Tooltip>;
  }
  return btn;
}

/** 删除按钮 */
export function DeleteButton({
  onClick,
  label = '删除',
  icon,
  disabled,
  disabledReason,
  needConfirm = true,
  confirmTitle,
  confirmContent,
}: {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
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
  const btn = (
    <Button {...rowActionKind('delete')} type="link" size="small" danger icon={icon} onClick={handleClick} disabled={disabled}>
      {label}
    </Button>
  );
  if (disabled && disabledReason) {
    return <Tooltip title={disabledReason}>{btn}</Tooltip>;
  }
  return btn;
}

/** 更多下拉菜单项 */
export interface MoreMenuItem {
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
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
    danger: it.danger,
    disabled: it.disabled,
    onClick: it.onClick,
  }));
  return (
    <Dropdown {...rowActionKind('skip')} menu={{ items: menuItems }} trigger={['click']}>
      {children ?? (
        <Button type="link" size="small">
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
    onClick,
    disabled,
  };
}

const ACTION_ORDER = ['detail', 'edit', 'delete', 'push'] as const;

export function UnifiedRowActions({
  actions,
  maxInline = 4,
  moreLabel = '更多',
}: {
  actions: ActionDescriptor[];
  maxInline?: number;
  moreLabel?: string;
}) {
  const visibleActions = actions
    .filter((it) => it.visible !== false)
    .sort((a, b) => {
      const ai = ACTION_ORDER.indexOf(a.key as (typeof ACTION_ORDER)[number]);
      const bi = ACTION_ORDER.indexOf(b.key as (typeof ACTION_ORDER)[number]);
      const ap = ai === -1 ? 99 : ai;
      const bp = bi === -1 ? 99 : bi;
      return ap - bp;
    });

  const inlineActions = visibleActions.slice(0, maxInline);
  const moreActions = visibleActions.slice(maxInline);

  const renderActionButton = (action: ActionDescriptor) => {
    const btn = (
      <Button
        key={action.key}
        {...rowActionKind(action.permissionKind)}
        type="link"
        size="small"
        danger={action.danger}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    );
    if (action.disabled && action.disabledReason) {
      return (
        <Tooltip key={action.key} {...rowActionKind('skip')} title={action.disabledReason}>
          {btn}
        </Tooltip>
      );
    }
    return btn;
  };

  return (
    <Space size="small" wrap>
      {inlineActions.map(renderActionButton)}
      {moreActions.length > 0 ? (
        <MoreDropdown
          items={moreActions.map((action) => ({
            key: action.key,
            label: action.label,
            disabled: action.disabled,
            danger: action.danger,
            onClick: action.onClick,
          }))}
        >
          <Button type="link" size="small">
            {moreLabel}
          </Button>
        </MoreDropdown>
      ) : null}
    </Space>
  );
}
