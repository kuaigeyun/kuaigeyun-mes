import React from 'react';
import { Button, Dropdown, Space } from 'antd';
import type { ButtonProps } from 'antd';
import { DownOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { withSingleNewShortcutHint } from '../../utils/globalNewShortcut';

export interface UniPullMenuItem {
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export interface UniPullCreateToolbarProps {
  createLabel: React.ReactNode;
  onCreate: () => void;
  menuItems: UniPullMenuItem[];
  createIcon?: React.ReactNode;
  /** 作为列表子项时的 React key（与 compactKey 默认同值） */
  compactKey?: string;
}

/**
 * 统一“新建 + 上拉建单”入口。
 * 页面只需要传主按钮行为和上拉菜单项，避免重复拼装 Dropdown 结构。
 */
export const UniPullCreateToolbar: React.FC<UniPullCreateToolbarProps> = ({
  createLabel,
  onCreate,
  menuItems,
  createIcon,
  compactKey = 'uni-pull-create-toolbar',
}) => {
  const createButtonLabel =
    typeof createLabel === 'string' ? withSingleNewShortcutHint(createLabel) : createLabel;

  return (
    <Space.Compact key={compactKey} className="uni-pull-create-toolbar">
      <Button type="primary" icon={createIcon} onClick={onCreate}>
        {createButtonLabel}
      </Button>
      <Dropdown
        trigger={['click']}
        menu={{
          items: menuItems.map((it) => ({
            key: it.key,
            label: it.label,
            disabled: it.disabled,
            onClick: it.onClick,
          })),
        }}
      >
        <Button type="primary" icon={<DownOutlined />} />
      </Dropdown>
    </Space.Compact>
  );
};

export interface UniPullLoadButtonProps {
  /** 默认「从单据加载」 */
  label?: React.ReactNode;
  menuItems: UniPullMenuItem[];
  icon?: React.ReactNode;
  type?: ButtonProps['type'];
  color?: ButtonProps['color'];
  variant?: ButtonProps['variant'];
  compactKey?: string;
}

/**
 * 独立的「从单据加载」入口，与「新建」主按钮并列，便于发现取单能力。
 */
export const UniPullLoadButton: React.FC<UniPullLoadButtonProps> = ({
  label,
  menuItems,
  icon,
  type,
  color = 'primary',
  variant = 'outlined',
  compactKey = 'uni-pull-load-button',
}) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('components.uniPull.loadFromDocument');

  return (
  <Dropdown
    key={compactKey}
    trigger={['click']}
    menu={{
      items: menuItems.map((it) => ({
        key: it.key,
        label: it.label,
        disabled: it.disabled,
        onClick: it.onClick,
      })),
    }}
  >
    <Button type={type} color={color} variant={variant} icon={icon ?? <FileSearchOutlined />}>
      {resolvedLabel}
      <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
    </Button>
  </Dropdown>
  );
};

