/**
 * 列表工具栏「导入」触发按钮（与 UniTable 3.2 一致）；弹窗仍用 `UniImport`。
 */

import React from 'react';
import { Button } from 'antd';
import type { ButtonProps } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type UniImportToolbarButtonProps = Omit<ButtonProps, 'icon' | 'onClick'> & {
  onOpen: () => void;
  /** 覆盖默认 i18n `components.uniTable.import` */
  buttonText?: string;
};

export const UniImportToolbarButton: React.FC<UniImportToolbarButtonProps> = ({
  onOpen,
  buttonText,
  type = 'default',
  children,
  ...rest
}) => {
  const { t } = useTranslation();
  return (
    <Button type={type} icon={<ImportOutlined />} onClick={onOpen} {...rest}>
      {children ?? buttonText ?? t('components.uniTable.import')}
    </Button>
  );
};
