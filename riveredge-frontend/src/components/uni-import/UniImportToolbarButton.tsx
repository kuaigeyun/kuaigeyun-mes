/**
 * 列表工具栏「导入」触发按钮（与 UniTable 3.2 一致）；弹窗仍用 `UniImport`。
 */

import React from 'react';
import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniImportToolbarButtonProps = Omit<ButtonProps, 'icon' | 'onClick'> & {
  onOpen: () => void;
  /** 覆盖默认 i18n `components.uniTable.import` */
  buttonText?: string;
  /** 仅图标（窄屏/工具栏宽度不足） */
  iconOnly?: boolean;
};

export const UniImportToolbarButton: React.FC<UniImportToolbarButtonProps> = ({
  onOpen,
  buttonText,
  type = 'default',
  children,
  iconOnly = false,
  ...rest
}) => {
  const { t } = useTranslation();
  const label = String(children ?? buttonText ?? t('components.uniTable.import'));
  const btn = (
    <Button type={type} icon={<ImportOutlined />} onClick={onOpen} aria-label={label} {...rest}>
      {iconOnly ? null : label}
    </Button>
  );
  return iconOnly ? <Tooltip title={label}>{btn}</Tooltip> : btn;
};
