/**
 * uni-push 列表工具栏「下推」主按钮规范：
 * - 紧跟「新建 / uni-pull」之后
 * - type="primary"、size="middle"、ArrowDownOutlined
 * - 无选中行或 disabled 时不可点
 */

import React from 'react';
import { Button, Dropdown } from 'antd';
import type { ButtonProps, MenuProps } from 'antd';
import { ArrowDownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniPushMenuItem = NonNullable<MenuProps['items']>[number];

export interface UniPushToolbarButtonProps {
  menuItems: UniPushMenuItem[];
  disabled?: boolean;
  buttonText?: React.ReactNode;
  size?: ButtonProps['size'];
}

export const UniPushToolbarButton: React.FC<UniPushToolbarButtonProps> = ({
  menuItems,
  disabled = false,
  buttonText,
  size = 'middle',
}) => {
  const { t } = useTranslation();
  const label = buttonText ?? t('components.uniPush.push');

  return (
    <Dropdown trigger={['click']} disabled={disabled} menu={{ items: menuItems }}>
      <Button type="primary" icon={<ArrowDownOutlined />} size={size} disabled={disabled}>
        {label}
      </Button>
    </Dropdown>
  );
};

export default UniPushToolbarButton;
