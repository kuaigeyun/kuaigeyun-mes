/**
 * 自组菜单编辑器：应用 APP 层级结构（系统菜单固定，不参与自组）
 */
import React, { useCallback, useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import MenuIconPicker from '../../../components/MenuIconPicker';
import type { CustomMenuLayoutNode, MenuTree } from '../../../services/menu';
import { translateAppMenuItemName, translateMenuName } from '../../../utils/menuTranslation';

export type CustomLayoutGroupNode = {
  id: string;
  type: 'app_group' | 'custom_group';
  title: string;
  icon?: string;
  menuUuids: string[];
  children: CustomLayoutGroupNode[];
};

export type MenuOverride = {
  title?: string;
  icon?: string;
};

export type CustomLayoutEditorState = {
  enabled: boolean;
  appGroups: CustomLayoutGroupNode[];
  menuOverrides: Record<string, MenuOverride>;
};

const MAX_CUSTOM_GROUP_DEPTH = 2;
/** 左右栏列表滚动区统一高度（与左栏待选菜单列表一致） */
const CUSTOM_LAYOUT_SCROLL_HEIGHT = 420;
/** 右栏 Card body 最小高度，与左栏（搜索 + 提示 + 列表）对齐 */
const CUSTOM_LAYOUT_PANEL_BODY_MIN_HEIGHT = 504;
/** 分组行内控件间距（Tag / 名称 / 图标 / 操作按钮） */
const CUSTOM_LAYOUT_INLINE_GAP = 8;
const CUSTOM_LAYOUT_GROUP_TITLE_WIDTH = 140;
const CUSTOM_LAYOUT_GROUP_ICON_WIDTH = 120;

function isVirtualAppRootMenuNode(node: MenuTree): boolean {
  const path = (node.path || '').trim();
  if (!path.startsWith('/apps/')) return false;
  return /^\/apps\/[^/]+\/?$/.test(path);
}

function isSystemLevelMenuNode(node: MenuTree): boolean {
  const path = (node.path || '').trim();
  return path.startsWith('/system/');
}

function isAppLevelMenuNode(node: MenuTree): boolean {
  const path = (node.path || '').trim();
  return path.startsWith('/apps/') && !isVirtualAppRootMenuNode(node);
}

function resolveMenuTitle(
  node: MenuTree,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  const path = (node.path || '').trim();
  const title = path.startsWith('/apps/')
    ? translateAppMenuItemName(node.name, node.path, t, node.children)
    : translateMenuName(node.name, t, node.path);
  return (title || node.name || '').trim() || path;
}

function collectMenuUuidsFromGroups(groups: CustomLayoutGroupNode[]): string[] {
  const uuids: string[] = [];
  const walk = (nodes: CustomLayoutGroupNode[]) => {
    nodes.forEach((node) => {
      uuids.push(...node.menuUuids);
      if (node.children.length) walk(node.children);
    });
  };
  walk(groups);
  return uuids;
}

function findGroupNode(
  groups: CustomLayoutGroupNode[],
  id: string,
): { node: CustomLayoutGroupNode; parent: CustomLayoutGroupNode[]; index: number } | null {
  for (let i = 0; i < groups.length; i += 1) {
    const node = groups[i];
    if (node.id === id) return { node, parent: groups, index: i };
    const found = findGroupNodeInChildren(node.children, id);
    if (found) return found;
  }
  return null;
}

function findGroupNodeInChildren(
  children: CustomLayoutGroupNode[],
  id: string,
): { node: CustomLayoutGroupNode; parent: CustomLayoutGroupNode[]; index: number } | null {
  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (node.id === id) return { node, parent: children, index: i };
    const found = findGroupNodeInChildren(node.children, id);
    if (found) return found;
  }
  return null;
}

function getCustomGroupDepth(groups: CustomLayoutGroupNode[], targetId: string): number | null {
  const walk = (nodes: CustomLayoutGroupNode[], depth: number): number | null => {
    for (const node of nodes) {
      if (node.id === targetId) return depth;
      const found = walk(node.children, depth + 1);
      if (found != null) return found;
    }
    return null;
  };
  for (const app of groups) {
    if (app.id === targetId) return 0;
    const found = walk(app.children, 1);
    if (found != null) return found;
  }
  return null;
}

function updateGroupTree(
  groups: CustomLayoutGroupNode[],
  id: string,
  updater: (node: CustomLayoutGroupNode) => CustomLayoutGroupNode,
): CustomLayoutGroupNode[] {
  return groups.map((group) => {
    if (group.id === id) return updater(group);
    if (!group.children.length) return group;
    return { ...group, children: updateGroupTree(group.children, id, updater) };
  });
}

function removeGroupFromTree(groups: CustomLayoutGroupNode[], id: string): CustomLayoutGroupNode[] {
  return groups
    .filter((g) => g.id !== id)
    .map((g) => ({ ...g, children: removeGroupFromTree(g.children, id) }));
}

function swapArrayItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function replaceGroupChildren(
  groups: CustomLayoutGroupNode[],
  childId: string,
  newChildren: CustomLayoutGroupNode[],
): CustomLayoutGroupNode[] {
  return groups.map((group) => {
    if (group.children.some((c) => c.id === childId)) {
      return { ...group, children: newChildren };
    }
    if (group.children.length) {
      return { ...group, children: replaceGroupChildren(group.children, childId, newChildren) };
    }
    return group;
  });
}

function moveGroupInTree(
  groups: CustomLayoutGroupNode[],
  groupId: string,
  direction: -1 | 1,
): CustomLayoutGroupNode[] {
  const rootIndex = groups.findIndex((g) => g.id === groupId);
  if (rootIndex >= 0) return swapArrayItem(groups, rootIndex, direction);
  const found = findGroupNode(groups, groupId);
  if (!found) return groups;
  const reordered = swapArrayItem([...found.parent], found.index, direction);
  return replaceGroupChildren(groups, groupId, reordered);
}

export function parseCustomLayoutEditorState(
  nodes: CustomMenuLayoutNode[],
  t: (key: string, options?: { defaultValue?: string }) => string,
): CustomLayoutEditorState {
  const menuOverrides: Record<string, MenuOverride> = {};

  const parseGroup = (node: CustomMenuLayoutNode): CustomLayoutGroupNode => {
    const groupType = node.type === 'app_group' ? 'app_group' : 'custom_group';
    const group: CustomLayoutGroupNode = {
      id: node.id,
      type: groupType,
      title:
        node.title ||
        (groupType === 'app_group'
          ? t('pages.system.menus.customLayoutDefaultAppGroup')
          : t('pages.system.menus.customLayoutDefaultGroup')),
      icon: node.icon,
      menuUuids: [],
      children: [],
    };
    (node.children || []).forEach((child) => {
      if (child.type === 'menu_ref' && child.menu_uuid) {
        const menuUuid = String(child.menu_uuid);
        group.menuUuids.push(menuUuid);
        if (child.title || child.icon) {
          menuOverrides[menuUuid] = {
            title: child.title || undefined,
            icon: child.icon || undefined,
          };
        }
        return;
      }
      if (child.type === 'custom_group') {
        group.children.push(parseGroup(child));
      }
    });
    return group;
  };

  const appGroups = (nodes || [])
    .filter((n) => n.type === 'app_group' || n.type === 'custom_group')
    .map((n) => {
      const parsed = parseGroup(n);
      if (parsed.type === 'custom_group') {
        return {
          ...parsed,
          type: 'app_group' as const,
          title: parsed.title || t('pages.system.menus.customLayoutDefaultAppGroup'),
        };
      }
      return parsed;
    });

  return { enabled: false, appGroups, menuOverrides };
}

export function buildCustomLayoutPayload(
  state: Pick<CustomLayoutEditorState, 'enabled' | 'appGroups' | 'menuOverrides'>,
  menuLookup: Map<string, MenuTree>,
): { enabled: boolean; nodes: CustomMenuLayoutNode[] } {
  const buildGroupNode = (group: CustomLayoutGroupNode): CustomMenuLayoutNode => {
    const childGroups = group.children.map(buildGroupNode);
    const menuRefs = (group.menuUuids || []).map((uuid) => {
      const source = menuLookup.get(uuid);
      const override = state.menuOverrides[uuid] || {};
      return {
        id: `${group.id}-${uuid}`,
        type: 'menu_ref' as const,
        menu_uuid: uuid,
        menu_path: source?.path,
        title: override.title || undefined,
        icon: override.icon || undefined,
        children: [],
      };
    });
    return {
      id: group.id,
      type: group.type,
      title: group.title,
      icon: group.icon,
      children: [...childGroups, ...menuRefs],
    };
  };

  return {
    enabled: state.enabled,
    nodes: state.appGroups.map(buildGroupNode),
  };
}

export interface CustomMenuLayoutEditorProps {
  sourceTree: MenuTree[];
  state: CustomLayoutEditorState;
  activeGroupId?: string;
  menuSearch: string;
  onStateChange: (patch: Partial<CustomLayoutEditorState>) => void;
  onActiveGroupIdChange: (id: string | undefined) => void;
  onMenuSearchChange: (value: string) => void;
}

const CustomMenuLayoutEditor: React.FC<CustomMenuLayoutEditorProps> = ({
  sourceTree,
  state,
  activeGroupId,
  menuSearch,
  onStateChange,
  onActiveGroupIdChange,
  onMenuSearchChange,
}) => {
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();

  const menuLookup = useMemo(() => {
    const byUuid = new Map<string, MenuTree>();
    const walk = (nodes: MenuTree[]) => {
      nodes.forEach((node) => {
        byUuid.set(node.uuid, node);
        if (node.children?.length) walk(node.children);
      });
    };
    walk(sourceTree);
    return byUuid;
  }, [sourceTree]);

  const appMenuLibrary = useMemo(() => {
    const rows: Array<{ key: string; title: string; path: string; description: string }> = [];
    const walk = (nodes: MenuTree[], appLabel?: string) => {
      nodes.forEach((node) => {
        if (isSystemLevelMenuNode(node)) {
          if (node.children?.length) walk(node.children, appLabel);
          return;
        }
        const currentAppLabel = appLabel || (node.path?.split('/')?.[2] || node.name);
        if (isVirtualAppRootMenuNode(node)) {
          if (node.children?.length) walk(node.children, currentAppLabel);
          return;
        }
        if (isAppLevelMenuNode(node)) {
          rows.push({
            key: node.uuid,
            title: resolveMenuTitle(node, t),
            path: node.path || '',
            description: `${currentAppLabel} · ${node.path}`,
          });
        }
        if (node.children?.length) walk(node.children, currentAppLabel);
      });
    };
    walk(sourceTree);
    return rows;
  }, [sourceTree, t]);

  const assignedAppMenuUuids = useMemo(
    () => new Set(collectMenuUuidsFromGroups(state.appGroups)),
    [state.appGroups],
  );

  const availableAppMenus = useMemo(() => {
    const kw = menuSearch.trim().toLowerCase();
    return appMenuLibrary.filter((item) => {
      if (assignedAppMenuUuids.has(item.key)) return false;
      if (!kw) return true;
      return `${item.title} ${item.path} ${item.description}`.toLowerCase().includes(kw);
    });
  }, [appMenuLibrary, assignedAppMenuUuids, menuSearch]);

  const setAppGroups = useCallback(
    (updater: (prev: CustomLayoutGroupNode[]) => CustomLayoutGroupNode[]) => {
      onStateChange({ appGroups: updater(state.appGroups) });
    },
    [onStateChange, state.appGroups],
  );

  const handleAddAppGroup = useCallback(() => {
    const id = `app_group-${Date.now()}`;
    setAppGroups((prev) => [
      ...prev,
      {
        id,
        type: 'app_group',
        title: t('pages.system.menus.customLayoutDefaultAppGroup'),
        menuUuids: [],
        children: [],
      },
    ]);
    onActiveGroupIdChange(id);
  }, [onActiveGroupIdChange, setAppGroups, t]);

  const handleAddChildGroup = useCallback(
    (parentId: string) => {
      const depth = getCustomGroupDepth(state.appGroups, parentId);
      if (depth == null) return;
      if (depth >= MAX_CUSTOM_GROUP_DEPTH) {
        messageApi.warning(t('pages.system.menus.customLayoutMaxGroupDepth'));
        return;
      }
      const id = `custom_group-${Date.now()}`;
      setAppGroups((prev) =>
        updateGroupTree(prev, parentId, (node) => ({
          ...node,
          children: [
            ...node.children,
            {
              id,
              type: 'custom_group',
              title: t('pages.system.menus.customLayoutDefaultGroup'),
              menuUuids: [],
              children: [],
            },
          ],
        })),
      );
      onActiveGroupIdChange(id);
    },
    [messageApi, onActiveGroupIdChange, setAppGroups, state.appGroups, t],
  );

  const handleQuickAddToActiveGroup = useCallback(
    (menuUuid: string) => {
      if (!activeGroupId) {
        messageApi.warning(t('pages.system.menus.customLayoutSelectTargetGroup'));
        return;
      }
      const found = findGroupNode(state.appGroups, activeGroupId);
      if (!found) {
        messageApi.warning(t('pages.system.menus.customLayoutSelectTargetGroup'));
        return;
      }
      if (found.node.type === 'app_group') {
        messageApi.warning(t('pages.system.menus.customLayoutAppCannotHoldMenus'));
        return;
      }
      setAppGroups((prev) =>
        updateGroupTree(prev, activeGroupId, (node) => {
          if (node.menuUuids.includes(menuUuid)) return node;
          return { ...node, menuUuids: [...node.menuUuids, menuUuid] };
        }),
      );
    },
    [activeGroupId, messageApi, setAppGroups, state.appGroups, t],
  );

  const renderGroupMenus = (group: CustomLayoutGroupNode) => (
    <Space direction="vertical" style={{ width: '100%', marginTop: CUSTOM_LAYOUT_INLINE_GAP }} size={CUSTOM_LAYOUT_INLINE_GAP}>
      <Select
        mode="multiple"
        size="small"
        style={{ width: '100%' }}
        value={group.menuUuids}
        disabled={group.type === 'app_group'}
        onChange={(value) =>
          setAppGroups((prev) =>
            updateGroupTree(prev, group.id, (node) => ({ ...node, menuUuids: value as string[] })),
          )
        }
        options={appMenuLibrary.map((item) => ({ value: item.key, label: item.title }))}
        placeholder={t('pages.system.menus.customLayoutGroupMenus')}
      />
      {group.menuUuids.map((menuUuid, menuIndex) => {
        const source = menuLookup.get(menuUuid);
        if (!source) return null;
        const override = state.menuOverrides[menuUuid] || {};
        return (
          <Space key={`${group.id}-${menuUuid}`} style={{ width: '100%', justifyContent: 'space-between' }} align="center" size={CUSTOM_LAYOUT_INLINE_GAP}>
            <Space align="center" size={CUSTOM_LAYOUT_INLINE_GAP}>
              <Button
                size="small"
                disabled={menuIndex === 0}
                onClick={() =>
                  setAppGroups((prev) =>
                    updateGroupTree(prev, group.id, (node) => {
                      const nextMenus = [...node.menuUuids];
                      [nextMenus[menuIndex - 1], nextMenus[menuIndex]] = [nextMenus[menuIndex], nextMenus[menuIndex - 1]];
                      return { ...node, menuUuids: nextMenus };
                    }),
                  )
                }
              >
                ↑
              </Button>
              <Button
                size="small"
                disabled={menuIndex === group.menuUuids.length - 1}
                onClick={() =>
                  setAppGroups((prev) =>
                    updateGroupTree(prev, group.id, (node) => {
                      const nextMenus = [...node.menuUuids];
                      [nextMenus[menuIndex + 1], nextMenus[menuIndex]] = [nextMenus[menuIndex], nextMenus[menuIndex + 1]];
                      return { ...node, menuUuids: nextMenus };
                    }),
                  )
                }
              >
                ↓
              </Button>
              <Typography.Text style={{ width: 180 }} ellipsis>
                {resolveMenuTitle(source, t)}
              </Typography.Text>
            </Space>
            <Space size={CUSTOM_LAYOUT_INLINE_GAP}>
              <Input
                size="small"
                value={override.title}
                onChange={(e) =>
                  onStateChange({
                    menuOverrides: {
                      ...state.menuOverrides,
                      [menuUuid]: { ...state.menuOverrides[menuUuid], title: e.target.value || undefined },
                    },
                  })
                }
                placeholder={t('pages.system.menus.customLayoutMenuTitleOverride')}
                style={{ width: 140 }}
              />
              <MenuIconPicker
                size="small"
                style={{ width: CUSTOM_LAYOUT_GROUP_ICON_WIDTH }}
                value={override.icon}
                onChange={(icon) =>
                  onStateChange({
                    menuOverrides: {
                      ...state.menuOverrides,
                      [menuUuid]: { ...state.menuOverrides[menuUuid], icon: icon || undefined },
                    },
                  })
                }
              />
              <Button
                size="small"
                danger
                onClick={() =>
                  setAppGroups((prev) =>
                    updateGroupTree(prev, group.id, (node) => ({
                      ...node,
                      menuUuids: node.menuUuids.filter((id) => id !== menuUuid),
                    })),
                  )
                }
              >
                {t('common.remove')}
              </Button>
            </Space>
          </Space>
        );
      })}
    </Space>
  );

  const renderGroupCard = (
    group: CustomLayoutGroupNode,
    siblings: CustomLayoutGroupNode[],
    siblingIndex: number,
    depth: number,
  ) => {
    const isActive = activeGroupId === group.id;
    const canAddChildGroup = depth < MAX_CUSTOM_GROUP_DEPTH;
    return (
      <div key={group.id} style={{ marginLeft: depth > 0 ? 16 : 0 }}>
        <Card
          size="small"
          style={{
            marginBottom: CUSTOM_LAYOUT_INLINE_GAP,
            borderColor: isActive ? '#1677ff' : undefined,
            boxShadow: isActive ? '0 0 0 1px #1677ff' : undefined,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onActiveGroupIdChange(group.id);
          }}
          styles={{ header: { minHeight: 'auto', padding: '8px 12px' } }}
          title={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: CUSTOM_LAYOUT_INLINE_GAP,
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              <Space size={CUSTOM_LAYOUT_INLINE_GAP} align="center">
                <Tag color={group.type === 'app_group' ? 'blue' : 'default'} style={{ margin: 0 }}>
                  {group.type === 'app_group'
                    ? t('pages.system.menus.customLayoutGroupTypeApp')
                    : t('pages.system.menus.customLayoutGroupTypeCustom')}
                </Tag>
                <Input
                  size="small"
                  value={group.title}
                  onChange={(e) =>
                    setAppGroups((prev) =>
                      updateGroupTree(prev, group.id, (node) => ({ ...node, title: e.target.value })),
                    )
                  }
                  style={{ width: CUSTOM_LAYOUT_GROUP_TITLE_WIDTH }}
                  placeholder={t('pages.system.menus.customLayoutGroupTitle')}
                />
                <MenuIconPicker
                  size="small"
                  style={{ width: CUSTOM_LAYOUT_GROUP_ICON_WIDTH }}
                  value={group.icon}
                  onChange={(icon) =>
                    setAppGroups((prev) =>
                      updateGroupTree(prev, group.id, (node) => ({ ...node, icon })),
                    )
                  }
                />
              </Space>
              <Space size={CUSTOM_LAYOUT_INLINE_GAP} align="center">
                {canAddChildGroup && (
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddChildGroup(group.id);
                    }}
                  >
                    {t('pages.system.menus.customLayoutAddSubGroup')}
                  </Button>
                )}
                <Button
                  size="small"
                  disabled={siblingIndex === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAppGroups((prev) => moveGroupInTree(prev, group.id, -1));
                  }}
                >
                  ↑
                </Button>
                <Button
                  size="small"
                  disabled={siblingIndex === siblings.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAppGroups((prev) => moveGroupInTree(prev, group.id, 1));
                  }}
                >
                  ↓
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={(e) => {
                    e.stopPropagation();
                    if (depth === 0) {
                      onStateChange({ appGroups: state.appGroups.filter((g) => g.id !== group.id) });
                    } else {
                      setAppGroups((prev) => removeGroupFromTree(prev, group.id));
                    }
                    if (activeGroupId === group.id) onActiveGroupIdChange(undefined);
                  }}
                >
                  {t('common.delete')}
                </Button>
              </Space>
            </div>
          }
        >
          {group.type !== 'app_group' && renderGroupMenus(group)}
          {group.children.length > 0 && (
            <div style={{ marginTop: group.type !== 'app_group' ? CUSTOM_LAYOUT_INLINE_GAP : 0 }}>
              {group.children.map((child, childIndex) =>
                renderGroupCard(child, group.children, childIndex, depth + 1),
              )}
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Space align="center" size={12}>
        <Typography.Text>{t('pages.system.menus.customLayoutEnabled')}</Typography.Text>
        <Switch
          checked={state.enabled}
          onChange={(enabled) => onStateChange({ enabled })}
        />
      </Space>
      <Row gutter={12}>
        <Col span={10}>
          <Card
            title={t('pages.system.menus.customLayoutTransferSource')}
            size="small"
            styles={{ body: { minHeight: CUSTOM_LAYOUT_PANEL_BODY_MIN_HEIGHT } }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Input
                value={menuSearch}
                onChange={(e) => onMenuSearchChange(e.target.value)}
                placeholder={t('pages.system.menus.customLayoutSearchMenuPlaceholder')}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('pages.system.menus.customLayoutAppMenuHint')}
              </Typography.Text>
              <div style={{ maxHeight: CUSTOM_LAYOUT_SCROLL_HEIGHT, overflowY: 'auto' }}>
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {availableAppMenus.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('pages.system.menus.customLayoutNoAvailableMenus')}
                    />
                  ) : (
                    availableAppMenus.map((item) => (
                      <Card key={item.key} size="small" styles={{ body: { padding: '8px 10px' } }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <Typography.Text strong ellipsis={{ tooltip: item.title }}>
                              {item.title}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              ellipsis={{ tooltip: item.path }}
                              style={{ display: 'block', fontSize: 12, lineHeight: '18px' }}
                            >
                              {item.path}
                            </Typography.Text>
                          </div>
                          <Button
                            size="small"
                            type="primary"
                            style={{ flexShrink: 0 }}
                            onClick={() => handleQuickAddToActiveGroup(item.key)}
                          >
                            {t('pages.system.menus.customLayoutQuickAdd')}
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={14}>
          <Card
            title={t('pages.system.menus.customLayoutTransferTarget')}
            size="small"
            styles={{ body: { minHeight: CUSTOM_LAYOUT_PANEL_BODY_MIN_HEIGHT } }}
            extra={
              <Button type="primary" onClick={handleAddAppGroup}>
                {t('pages.system.menus.customLayoutAddApp')}
              </Button>
            }
          >
            <div
              style={{
                maxHeight: CUSTOM_LAYOUT_SCROLL_HEIGHT,
                minHeight: CUSTOM_LAYOUT_SCROLL_HEIGHT,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: state.appGroups.length === 0 ? 'center' : 'flex-start',
              }}
            >
              {state.appGroups.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('pages.system.menus.customLayoutNoApps')}
                />
              ) : (
                state.appGroups.map((group, index) => renderGroupCard(group, state.appGroups, index, 0))
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default CustomMenuLayoutEditor;
