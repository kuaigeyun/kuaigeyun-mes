/**
 * uni-batch：列表批量操作统一入口（不限于删除）。
 *
 * 推荐组合：
 * - `UniBatchDeleteButton` — 独立批量删除（带确认）
 * - `UniBatchMenuButton` — 其它批量能力收拢到一个下拉按钮
 * - `UniAuditBatchMenuButton` — 审核流批量（提交/撤回/审核/反审），与行级 UniWorkflowActions 对称
 * - `UniBatchSplitToolbar` — 上述两者并排（兼容旧页，内部已按新形态拆分）
 *
 * 任意「依赖选中行」的批量能力可共用 `UniBatchButton` 基座。
 */

import React from 'react';
import { App, Button, Dropdown, Popconfirm, Space } from 'antd';
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
  /** 业务态不可批量删除时置灰（无选中行时仍由 disableWhenEmpty 处理） */
  disabled?: boolean;
}

export const UniBatchDeleteButton: React.FC<UniBatchDeleteButtonProps> = ({
  selectedRowKeys,
  onConfirm,
  toolBarButtonSize = 'middle',
  buttonText,
  confirmTitle,
  confirmDescription,
  disabled: disabledProp,
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
      disabled={disabledProp}
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

export type UniBatchMenuItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** 点击菜单项；默认传入当前 selectedRowKeys */
  onClick: (keys: React.Key[]) => void | Promise<void>;
  disabled?: boolean;
  requireConfirm?: boolean;
  confirmTitle?: React.ReactNode | ((count: number) => React.ReactNode);
  confirmDescription?: React.ReactNode | ((count: number) => React.ReactNode);
};

export interface UniBatchMenuButtonProps {
  selectedRowKeys: React.Key[];
  menuItems: UniBatchMenuItem[];
  toolBarButtonSize?: ButtonProps['size'];
  buttonText?: string;
  disabled?: boolean;
}

/** 批量操作下拉：与 `UniBatchDeleteButton` 并列，承载除删除外的批量能力 */
export const UniBatchMenuButton: React.FC<UniBatchMenuButtonProps> = ({
  selectedRowKeys,
  menuItems,
  toolBarButtonSize = 'middle',
  buttonText,
  disabled: disabledProp,
}) => {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const count = selectedRowKeys.length;
  const emptyDisabled = count === 0 || menuItems.length === 0;
  const disabled = disabledProp ?? emptyDisabled;

  const runMenuItem = (item: UniBatchMenuItem) => {
    const run = () => void item.onClick(selectedRowKeys);
    if (item.requireConfirm) {
      modal.confirm({
        title:
          typeof item.confirmTitle === 'function'
            ? item.confirmTitle(count)
            : item.confirmTitle,
        content:
          typeof item.confirmDescription === 'function'
            ? item.confirmDescription(count)
            : item.confirmDescription,
        onOk: run,
      });
      return;
    }
    run();
  };

  const dropdownMenu: MenuProps = {
    items: menuItems.map((it) => ({
      key: it.key,
      label: it.label,
      icon: it.icon,
      disabled: it.disabled ?? disabled,
      onClick: () => runMenuItem(it),
    })),
  };

  return (
    <Dropdown menu={dropdownMenu} trigger={['click']} disabled={disabled}>
      <Button type="default" disabled={disabled} size={toolBarButtonSize}>
        {buttonText ?? t('components.uniBatch.batchActions')}
        <DownOutlined style={{ fontSize: 10, marginLeft: 4, opacity: 0.75 }} />
      </Button>
    </Dropdown>
  );
};

/** @deprecated 请优先使用 `UniBatchDeleteButton` + `UniBatchMenuButton` 并列 */
export type UniBatchSplitMenuItem = UniBatchMenuItem;

export interface UniBatchSplitToolbarProps {
  selectedRowKeys: React.Key[];
  onDelete: (keys: React.Key[]) => void | Promise<void>;
  /** 下拉中的其它批量操作（不含删除） */
  menuItems?: UniBatchSplitMenuItem[];
  toolBarButtonSize?: ButtonProps['size'];
  deleteButtonText?: string;
  menuButtonText?: string;
  confirmTitle?: string | ((count: number) => string);
  confirmDescription?: string | ((count: number) => string);
}

/**
 * 批量操作工具条：左侧独立删除 + 右侧批量操作下拉（uni-batch 推荐形态）。
 */
export const UniBatchSplitToolbar: React.FC<UniBatchSplitToolbarProps> = ({
  selectedRowKeys,
  onDelete,
  menuItems = [],
  toolBarButtonSize = 'middle',
  deleteButtonText,
  menuButtonText,
  confirmTitle,
  confirmDescription,
}) => {
  return (
    <Space size={8}>
      <UniBatchDeleteButton
        selectedRowKeys={selectedRowKeys}
        onConfirm={onDelete}
        toolBarButtonSize={toolBarButtonSize}
        buttonText={deleteButtonText}
        confirmTitle={confirmTitle}
        confirmDescription={confirmDescription}
      />
      {menuItems.length > 0 ? (
        <UniBatchMenuButton
          selectedRowKeys={selectedRowKeys}
          menuItems={menuItems}
          toolBarButtonSize={toolBarButtonSize}
          buttonText={menuButtonText}
        />
      ) : null}
    </Space>
  );
};

export {
  UniAuditBatchMenuButton,
  DEFAULT_AUDIT_BATCH_CAPABILITY_KEYS,
  DEFAULT_AUDIT_BATCH_PERMISSION_ACTIONS,
  buildAuditBatchMenuItems,
  defaultAuditBatchAllowed,
  pickCapability,
  useAuditBatchRunner,
} from './auditBatchMenu';
export type {
  AuditBatchAction,
  AuditBatchCapabilityKeys,
  AuditBatchHandlers,
  BulkAuditBatchHandlers,
  BulkAuditBatchResult,
  BuildAuditBatchMenuItemsOptions,
  UniAuditBatchMenuButtonProps,
} from './auditBatchMenu';
export {
  UniCapabilityBatchButton,
  runCapabilityBatchLoop,
  runCapabilityBatchBulk,
} from './capabilityBatchButton';
export type {
  BulkCapabilityResult,
  CapabilityBatchLabels,
  UniCapabilityBatchButtonProps,
} from './capabilityBatchButton';
