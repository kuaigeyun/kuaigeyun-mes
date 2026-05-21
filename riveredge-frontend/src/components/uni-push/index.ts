import type { MenuProps } from 'antd';

export type UniPushMenuItem = NonNullable<MenuProps['items']>[number];

/**
 * uni-push 统一“下推菜单项”构建入口。
 * 支持普通项和 divider，便于逐页替换历史内联菜单定义。
 */
export const buildUniPushMenuItems = (items: UniPushMenuItem[]): UniPushMenuItem[] => items;

export { UniPushToolbarButton } from './UniPushToolbarButton';
export type { UniPushToolbarButtonProps } from './UniPushToolbarButton';
