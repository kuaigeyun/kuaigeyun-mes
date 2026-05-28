import React from 'react';
import { Button, Dropdown, Space } from 'antd';
import { DownOutlined } from '@ant-design/icons';

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
  return (
    <Space.Compact key={compactKey}>
      <Button type="primary" icon={createIcon} onClick={onCreate}>
        {createLabel}
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

