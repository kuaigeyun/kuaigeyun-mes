/**
 * 列表工具栏「导入」下拉（按导入类型拆分），与 UniExportMenuButton 视觉一致。
 */

import React from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import type { ButtonProps } from 'antd';
import { DownOutlined, ImportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface UniImportMenuItem {
  key: string;
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface UniImportMenuButtonProps extends Omit<ButtonProps, 'icon' | 'onClick'> {
  items: UniImportMenuItem[];
  /** 覆盖默认 i18n `components.uniTable.import` */
  buttonText?: string;
  /** 仅图标（窄屏/工具栏宽度不足） */
  iconOnly?: boolean;
}

export function UniImportMenuButton({
  items,
  buttonText,
  type = 'default',
  iconOnly = false,
  ...rest
}: UniImportMenuButtonProps) {
  const { t } = useTranslation();
  const importLabel = buttonText ?? t('components.uniTable.import');

  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    disabled: item.disabled,
    onClick: item.onClick,
  }));

  if (menuItems.length === 0) return null;

  const trigger = (
    <Button type={type} icon={<ImportOutlined />} aria-label={importLabel} {...rest}>
      {iconOnly ? null : (
        <>
          {importLabel}
          <DownOutlined style={{ fontSize: 10, marginInlineStart: 2, opacity: 0.65 }} />
        </>
      )}
    </Button>
  );

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['hover', 'click']}
      mouseEnterDelay={0.05}
      mouseLeaveDelay={0.2}
    >
      {iconOnly ? <Tooltip title={importLabel}>{trigger}</Tooltip> : trigger}
    </Dropdown>
  );
}
