/**
 * 业务单据统一操作列（薄封装，委托 uni-action 目录文案/图标/排序）
 *
 * @see components/uni-action/actionCatalog.ts
 */

import React from 'react';
import { rowActionKind, RowActionButton, rowActionLabelKeep } from '../uni-action';
import { Button, Dropdown, Modal, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import type { RowActionPermissionKind } from '../uni-action';
import { useTranslation } from 'react-i18next';

/** 操作列标准配置（宽度由 UniTable / uniTableLayoutColumns 注入） */
export const DOCUMENT_ACTION_COLUMN = {
  title: '操作',
  fixed: 'right' as const,
  valueType: 'option' as const,
} as const;

export const DOCUMENT_ACTION_COLUMN_NARROW = {
  ...DOCUMENT_ACTION_COLUMN,
} as const;

export interface DocumentActionButtonProps {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ActionDescriptor {
  key: string;
  permissionKind: RowActionPermissionKind;
  label?: React.ReactNode;
  labelKeep?: boolean;
  onClick?: () => void;
  visible?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
}

export function DetailButton({ onClick }: { onClick: () => void }) {
  return <RowActionButton kind="read" onClick={onClick} />;
}

export function EditButton({
  onClick,
  disabled,
  disabledReason,
}: {
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  if (disabled) return null;
  const btn = <RowActionButton kind="update" onClick={onClick} />;
  if (disabledReason) {
    return <Tooltip title={disabledReason}>{btn}</Tooltip>;
  }
  return btn;
}

export function DeleteButton({
  onClick,
  disabled,
  disabledReason,
  needConfirm = true,
  confirmTitle,
  confirmContent,
}: {
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  needConfirm?: boolean;
  confirmTitle?: string;
  confirmContent?: string;
}) {
  if (disabled) return null;
  const handleClick = () => {
    if (needConfirm) {
      Modal.confirm({
        title: confirmTitle || '确定要删除吗？',
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
  return <RowActionButton kind="delete" onClick={handleClick} />;
}

export interface MoreMenuItem {
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MoreDropdown({
  items,
  children,
}: {
  items: MoreMenuItem[];
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
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
        <Button {...rowActionKind('skip')} {...rowActionLabelKeep()}>
          {t('common.more', { defaultValue: '更多' })}
        </Button>
      )}
    </Dropdown>
  );
}

export function printMenuItem(onClick: () => void): MoreMenuItem {
  return { key: 'print', label: '打印', onClick };
}

export function pushMenuItem(key: string, label: string, onClick: () => void, disabled?: boolean): MoreMenuItem {
  return { key, label, onClick, disabled };
}

/** 返回 Button[]，由 UniTable → uni-action 统一排序与溢出 */
export function UnifiedRowActions({
  actions,
}: {
  actions: ActionDescriptor[];
  maxInline?: number;
  moreLabel?: string;
}) {
  return actions
    .filter((it) => it.visible !== false && !it.disabled)
    .map((action) => {
      const btn = (
        <RowActionButton
          key={action.key}
          kind={action.permissionKind}
          labelKeep={action.labelKeep}
          onClick={action.onClick}
        >
          {action.labelKeep ? action.label : undefined}
        </RowActionButton>
      );
      if (action.disabledReason) {
        return (
          <Tooltip key={action.key} {...rowActionKind('skip')} title={action.disabledReason}>
            {btn}
          </Tooltip>
        );
      }
      return btn;
    });
}
