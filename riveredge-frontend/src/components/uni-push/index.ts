import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';

export type UniPushMenuItem = NonNullable<MenuProps['items']>[number];

export type UniPushMenuItemInput = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** 有值则菜单项置灰，并作为 hover 提示 */
  disabledReason?: ReactNode;
  onClick?: () => void;
};

/** 构建单个下推菜单项：不可操作时置灰而非隐藏 */
export function buildUniPushMenuItem(input: UniPushMenuItemInput): UniPushMenuItem {
  const disabled =
    input.disabledReason != null &&
    (typeof input.disabledReason !== 'string' || input.disabledReason.trim() !== '');
  return {
    key: input.key,
    label: input.label,
    icon: input.icon,
    disabled,
    title: disabled ? input.disabledReason : undefined,
    onClick: disabled ? undefined : input.onClick,
  };
}

/**
 * uni-push 统一“下推菜单项”构建入口。
 * 禁止过滤 disabled 项；不可操作须置灰展示。
 */
export const buildUniPushMenuItems = (items: UniPushMenuItem[]): UniPushMenuItem[] => items;

/** 下推主按钮是否因选中态不合法而禁用（不因单项不可下推而禁用整钮） */
export function isUniPushToolbarSelectionBlocked(options: {
  selectedCount: number;
  hasSelectedRecord: boolean;
}): boolean {
  return options.selectedCount !== 1 || !options.hasSelectedRecord;
}

export type UniPushToolbarDisabledReasonOptions = {
  selectedCount: number;
  hasSelectedRecord: boolean;
  /** 选中态合法后的业务门禁（如状态不可下推） */
  extraReason?: string;
};

/** 列表工具栏下推按钮禁用提示（与需求计算页规范一致） */
export function buildUniPushToolbarDisabledReason(
  t: (key: string, options?: Record<string, unknown>) => string,
  options: UniPushToolbarDisabledReasonOptions,
): string | undefined {
  const { selectedCount, hasSelectedRecord, extraReason } = options;
  if (selectedCount === 0) {
    return t('components.uniPush.toolbarSelectOneFirst');
  }
  if (selectedCount !== 1) {
    return t('components.uniPush.toolbarPushSingleOnly');
  }
  if (!hasSelectedRecord) {
    return t('components.uniPush.toolbarSelectedNotInList');
  }
  return extraReason;
}

export { UniPushToolbarButton } from './UniPushToolbarButton';
export type { UniPushToolbarButtonProps } from './UniPushToolbarButton';
