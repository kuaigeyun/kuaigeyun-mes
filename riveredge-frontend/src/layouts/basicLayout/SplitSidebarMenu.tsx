import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  findActiveRootKey,
  findFirstLeafPath,
  menuItemKey,
  toSidebarShortLabel,
} from './sidebarMenuLayout';
import { buildSplitSecondaryMenuItems } from './splitSidebarMenuItems';

export type SplitSidebarMenuProps = {
  roots: MenuDataItem[];
  currentPath: string;
  collapsed: boolean;
  selectedKeys: string[];
  openKeys: string[];
  onOpenChange: (keys: string[]) => void;
  searchExtra?: React.ReactNode;
  menuItemRender?: (item: MenuDataItem, dom: React.ReactNode) => React.ReactNode;
  onNavigate?: (path: string) => void;
};

type SplitPrimaryRailProps = {
  roots: MenuDataItem[];
  activeRootKey: string;
  collapsed: boolean;
  onNavigate?: (path: string) => void;
  onActiveRootChange: (key: string) => void;
};

type SplitSecondaryMenuProps = {
  items: MenuProps['items'];
  selectedKeys: string[];
  openKeys: string[];
  onOpenChange: (keys: string[]) => void;
};

const SplitPrimaryRail = memo(function SplitPrimaryRail({
  roots,
  activeRootKey,
  collapsed,
  onNavigate,
  onActiveRootChange,
}: SplitPrimaryRailProps) {
  const { t } = useTranslation();
  const rootsRef = useRef(roots);
  rootsRef.current = roots;

  const handleRailClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-root-key]');
      if (!button) return;
      const key = button.dataset.rootKey;
      if (!key) return;
      onActiveRootChange(key);
      if (!collapsed) return;
      const root = rootsRef.current.find((item) => menuItemKey(item) === key);
      if (!root) return;
      const target =
        root.path && !root.path.startsWith('#')
          ? root.path
          : findFirstLeafPath(root.children ?? []);
      if (target) onNavigate?.(target);
    },
    [collapsed, onActiveRootChange, onNavigate],
  );

  return (
    <div
      className="riveredge-split-sidebar-primary"
      role="tablist"
      aria-orientation="vertical"
      onClick={handleRailClick}
    >
      {roots.map((root) => {
        const key = menuItemKey(root);
        const active = key === activeRootKey;
        const shortLabel = toSidebarShortLabel(root, t);
        return (
          <button
            key={key}
            type="button"
            role="tab"
            data-root-key={key}
            aria-selected={active}
            className={`riveredge-split-sidebar-primary-item${active ? ' is-active' : ''}`}
            title={typeof root.name === 'string' ? root.name : undefined}
          >
            <span className="riveredge-split-sidebar-primary-icon">{root.icon ?? null}</span>
            <span className="riveredge-split-sidebar-primary-label">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
});

const SplitSecondaryMenu = memo(function SplitSecondaryMenu({
  items,
  selectedKeys,
  openKeys,
  onOpenChange,
}: SplitSecondaryMenuProps) {
  const handleOpenChange = useCallback(
    (keys: string[]) => {
      onOpenChange(keys);
    },
    [onOpenChange],
  );

  return (
    <div className="riveredge-split-sidebar-secondary">
      <Menu
        mode="inline"
        inlineIndent={12}
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={handleOpenChange}
        items={items}
        className="ant-pro-sider-menu ant-menu ant-menu-root ant-menu-inline ant-pro-base-menu-inline-menu riveredge-split-sidebar-menu"
      />
    </div>
  );
});

const SplitSidebarMenu: React.FC<SplitSidebarMenuProps> = ({
  roots,
  currentPath,
  collapsed,
  selectedKeys,
  openKeys,
  onOpenChange,
  searchExtra,
  menuItemRender,
  onNavigate,
}) => {
  const [activeRootKey, setActiveRootKey] = useState(() => findActiveRootKey(roots, currentPath));

  useEffect(() => {
    setActiveRootKey(findActiveRootKey(roots, currentPath));
  }, [currentPath, roots]);

  const activeRoot = useMemo(
    () => roots.find((item) => menuItemKey(item) === activeRootKey) ?? roots[0],
    [activeRootKey, roots],
  );

  const secondaryNodes = useMemo(() => {
    if (activeRoot?.children?.length) return activeRoot.children;
    if (activeRoot?.path && !activeRoot.path.startsWith('#')) return [activeRoot];
    return [];
  }, [activeRoot]);

  const secondaryItems = useMemo(
    () => buildSplitSecondaryMenuItems(secondaryNodes, menuItemRender),
    [secondaryNodes, menuItemRender],
  );

  const handleActiveRootChange = useCallback((key: string) => {
    setActiveRootKey(key);
  }, []);

  return (
    <div className="riveredge-split-sidebar">
      {!collapsed && searchExtra ? (
        <div className="riveredge-split-sidebar-search">{searchExtra}</div>
      ) : null}
      <div className={`riveredge-split-sidebar-body${collapsed ? ' is-collapsed' : ''}`}>
        <SplitPrimaryRail
          roots={roots}
          activeRootKey={activeRootKey}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onActiveRootChange={handleActiveRootChange}
        />
        {!collapsed ? (
          <SplitSecondaryMenu
            items={secondaryItems}
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </div>
    </div>
  );
};

export default memo(SplitSidebarMenu);
