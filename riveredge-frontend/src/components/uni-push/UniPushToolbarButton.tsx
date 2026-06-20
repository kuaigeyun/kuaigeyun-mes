/**
 * uni-push 列表工具栏「下推」主按钮规范：
 * - 紧跟「新建 / uni-pull」之后
 * - type="primary"、size="middle"、ArrowDownOutlined
 * - 无选中行或 disabled 时不可点
 */

import React, { useMemo } from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import type { ButtonProps, MenuProps } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniPushMenuItem = NonNullable<MenuProps['items']>[number];

export interface UniPushToolbarButtonProps {
  menuItems: UniPushMenuItem[];
  disabled?: boolean;
  disabledReason?: React.ReactNode;
  buttonText?: React.ReactNode;
  size?: ButtonProps['size'];
}

export const UniPushToolbarButton: React.FC<UniPushToolbarButtonProps> = ({
  menuItems,
  disabled = false,
  disabledReason,
  buttonText,
  size = 'middle',
}) => {
  const { t } = useTranslation();
  const label = buttonText ?? t('components.uniPush.push');
  const resolvedDisabledReason = useMemo(() => {
    if (!disabled) return undefined;
    if (disabledReason) return disabledReason;
    const actionItems = (menuItems || []).filter(
      (item): item is Exclude<UniPushMenuItem, null> =>
        !!item && typeof item === 'object' && (item as { type?: string }).type !== 'divider',
    ) as Array<{ disabled?: boolean; title?: React.ReactNode }>;
    if (actionItems.length === 0) {
      return t('components.uniPush.disabled.noActions', { defaultValue: '当前无可用下推操作' });
    }
    const hasEnabled = actionItems.some((item) => item.disabled !== true);
    if (hasEnabled) {
      return t('components.uniPush.disabled.selection', { defaultValue: '请先选择一条可下推单据' });
    }
    const firstTitle = actionItems.find((item) => item.disabled && item.title != null)?.title;
    if (typeof firstTitle === 'string' && firstTitle.trim()) return firstTitle;
    return t('components.uniPush.disabled.unavailable', { defaultValue: '当前状态不可下推' });
  }, [disabled, disabledReason, menuItems, t]);

  const button = (
    <Button type="primary" icon={<ArrowDownOutlined />} size={size} disabled={disabled}>
      {label}
    </Button>
  );

  return (
    <Dropdown trigger={['click']} disabled={disabled} menu={{ items: menuItems }}>
      {disabled && resolvedDisabledReason ? <Tooltip title={resolvedDisabledReason}>{button}</Tooltip> : button}
    </Dropdown>
  );
};

export default UniPushToolbarButton;
