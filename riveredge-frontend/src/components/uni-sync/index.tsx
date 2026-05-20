/**
 * uni-sync：列表工具栏「同步」按钮（与 UniTable 右侧 3.2 区一致，也可在页面中单独使用）。
 */

import React from 'react';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface UniSyncButtonProps extends Omit<ButtonProps, 'icon' | 'onClick'> {
  onSync: () => void;
  /** 覆盖默认 i18n `components.uniTable.sync` */
  buttonText?: string;
  /** 仅图标（窄屏/工具栏宽度不足） */
  iconOnly?: boolean;
}

export const UniSyncButton: React.FC<UniSyncButtonProps> = ({
  onSync,
  buttonText,
  children,
  type = 'default',
  iconOnly = false,
  ...rest
}) => {
  const { t } = useTranslation();
  const label = String(children ?? buttonText ?? t('components.uniTable.sync'));
  const btn = (
    <Button type={type} icon={<SyncOutlined />} onClick={onSync} aria-label={label} {...rest}>
      {iconOnly ? null : label}
    </Button>
  );
  return iconOnly ? <Tooltip title={label}>{btn}</Tooltip> : btn;
};
