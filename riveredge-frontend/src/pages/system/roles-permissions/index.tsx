/**
 * 角色权限管理合并页面
 * 
 * 左侧：角色树形菜单
 * 右侧：选中角色的权限编辑界面
 * 
 * 整合了角色管理和权限分配功能，提供更直观的管理体验。
 * 布局参考文件管理页面设计。
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Space,
  Tag,
  Tree,
  Modal,
  Popconfirm,
  Input,
  Empty,
  Spin,
  Divider,
  Tooltip,
  App,
  theme,
  Select,
  Tabs,
  Flex,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useNewShortcut } from '../../../hooks/useNewShortcut';
import { useSubmitShortcut } from '../../../hooks/useSubmitShortcut';
import { NEW_SHORTCUT_HINT } from '../../../utils/globalNewShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../utils/globalSubmitShortcut';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  SearchOutlined,
  FolderOutlined,
  AppstoreOutlined,
  CopyOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import {
  getRoleList,
  getRoleByUuid,
  deleteRole,
  getRolePermissions,
  assignPermissions,
  getAllPermissions,
  loadPresetRoles,
  cleanupLegacyRoles,
  Role,
  Permission,
} from '../../../services/role';
import { RoleFormModal } from '../roles/components/RoleFormModal';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import { PERMISSION_TEMPLATES, getPermissionUuidsByTemplate } from '../../../config/permission-modules';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import { KUAIZHIZAO_PRICING_VIEW } from '../../../utils/kuaizhizaoPricingPermission';

/** 权限树叶子节点展示名：数据范围走 permission.scope，其余走 permission.action */
function permissionLeafDisplayLabel(
  permission: Permission,
  t: (key: string, opts?: { defaultValue?: string }) => string
): string {
  const code = permission.code || '';
  if (code === KUAIZHIZAO_PRICING_VIEW) {
    return t('permission.kuaizhizao.pricingView', { defaultValue: '查看价格与金额' });
  }
  const parts = code.split(':').filter(Boolean);
  const n = parts.length;
  if (n === 0) return permission.name || '';

  const lower = parts.map((x) => x.toLowerCase());
  if (n >= 3 && lower[n - 2] === 'data') {
    const scopeSeg = parts[n - 1] || '';
    const scopeKey = `permission.scope.${scopeSeg.toLowerCase()}`;
    const tr = t(scopeKey, { defaultValue: '' });
    if (tr && tr !== scopeKey) return tr;
    return scopeSeg;
  }

  const actionSeg = parts[n - 1] || permission.action || '';
  const actionKey = `permission.action.${String(actionSeg).toLowerCase()}`;
  const tr = t(actionKey, { defaultValue: '' });
  if (tr && tr !== actionKey) return tr;
  return actionSeg;
}

/**
 * 菜单 permission_code 对应的资源前缀（含 app 段），兼容 meta.node 下划线与 manifest 连字符两种写法。
 */
function resourcePrefixesForMenuCode(menuCode: string): string[] {
  const parts = menuCode.split(':').filter(Boolean);
  if (parts.length < 2) return [];
  const app = parts[0];
  const resourceParts = parts.length >= 3 ? parts.slice(1, -1) : parts.slice(1);
  const resourceJoined = resourceParts.join(':');
  const asHyphen = resourceJoined.replace(/_/g, '-');
  const asUnder = resourceJoined.replace(/-/g, '_');
  const uniq = [...new Set([resourceJoined, asHyphen, asUnder])];
  return uniq.map((r) => `${app}:${r}:`);
}

/** 路径型菜单资源（如 quality-management-incoming-inspection）对应到 manifest 短资源码（incoming-inspection） */
const GENERIC_RESOURCE_SUFFIX = new Set(['dashboard', 'reports', 'statistics', 'terminal']);

function resourceSuffixAliases(resource: string): string[] {
  if (!resource || !resource.includes('-')) return [];
  const parts = resource.split('-').filter(Boolean);
  if (parts.length < 2) return [];
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const cand = parts.slice(i).join('-');
    const segCount = parts.length - i;
    if (segCount === 1 && GENERIC_RESOURCE_SUFFIX.has(cand)) continue;
    if (cand.split('-').length < 2) continue;
    out.push(cand);
  }
  return out;
}

/** 与菜单 permission_code 同资源前缀下的所有权限（菜单下列为可勾选操作） */
function permissionsMatchingMenuCode(menuCode: string, pool: Permission[]): Permission[] {
  const c = menuCode.trim();
  if (!c) return [];
  const seen = new Set<string>();
  const out: Permission[] = [];
  const add = (p: Permission) => {
    if (seen.has(p.uuid)) return;
    seen.add(p.uuid);
    out.push(p);
  };

  for (const p of pool) {
    if (p.code === c) add(p);
  }

  for (const prefix of resourcePrefixesForMenuCode(c)) {
    for (const p of pool) {
      if (p.code.startsWith(prefix)) add(p);
    }
  }

  const parts = c.split(':').filter(Boolean);
  if (parts.length >= 3) {
    const app = parts[0];
    const resource = parts.slice(1, -1).join(':');
    for (const alias of resourceSuffixAliases(resource)) {
      const prefix = `${app}:${alias}:`;
      for (const p of pool) {
        if (p.code.startsWith(prefix)) add(p);
      }
    }
  }

  if (parts.length === 1) {
    const rp = `${parts[0]}:`;
    for (const p of pool) {
      if (p.code.startsWith(rp)) add(p);
    }
  }

  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

/** 仅保留「子树内仍有可展示权限」的菜单分支 */
function filterMenusForDisplay(menus: MenuTree[], pool: Permission[]): MenuTree[] {
  const result: MenuTree[] = [];
  const sorted = [...menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const m of sorted) {
    const sub = m.children?.length ? filterMenusForDisplay(m.children, pool) : [];
    const code = m.permission_code?.trim();
    const myPerms = code ? permissionsMatchingMenuCode(code, pool) : [];
    if (sub.length > 0 || myPerms.length > 0) {
      result.push({ ...m, children: sub });
    }
  }
  return result;
}

function menuTreeNodeTitle(menu: MenuTree, t: (key: string, opts?: { defaultValue?: string }) => string): string {
  const path = menu.path;
  const isAppMenu = (path || '').startsWith('/apps/');
  if (isAppMenu) {
    const normalized = (path || '').replace(/\/$/, '');
    const isAppRoot = !path || /^\/apps\/[^/]+$/.test(normalized);
    if (isAppRoot) {
      const appCode = extractAppCodeFromPath(path);
      if (appCode) {
        const dn = getAppDisplayName(appCode, t, menu.name || appCode);
        if (dn) return dn;
      }
    }
    return translateAppMenuItemName(menu.name, path, t, menu.children);
  }
  return translateMenuName(menu.name, t, menu.path);
}

function buildMenuPermissionTreeData(
  menus: MenuTree[],
  pool: Permission[],
  globallyUsed: Set<string>,
  expandKeys: React.Key[],
  t: (key: string, opts?: { defaultValue?: string }) => string,
  token: { colorPrimary: string }
): DataNode[] {
  const sorted = [...menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const nodes: DataNode[] = [];

  for (const m of sorted) {
    const key = `menu-${m.uuid}`;
    expandKeys.push(key);

    const childMenus = m.children?.length
      ? buildMenuPermissionTreeData(m.children, pool, globallyUsed, expandKeys, t, token)
      : [];

    const code = m.permission_code?.trim();
    let opNodes: DataNode[] = [];
    if (code) {
      const matched = permissionsMatchingMenuCode(code, pool).filter((p) => !globallyUsed.has(p.uuid));
      matched.forEach((p) => globallyUsed.add(p.uuid));
      opNodes = matched.map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        return {
          title: (
            <Space size={4} wrap>
              <span>{actionLabel}</span>
              <Tag color="cyan" style={{ fontSize: 10 }}>
                {permission.code}
              </Tag>
              {permission.permission_type === 'field' && (
                <Tag color="orange" style={{ fontSize: '10px' }}>
                  {t('pages.system.roles.permissionTypeField')}
                </Tag>
              )}
              {permission.permission_type === 'data' && (
                <Tag color="green" style={{ fontSize: '10px' }}>
                  {t('pages.system.roles.permissionTypeData')}
                </Tag>
              )}
            </Space>
          ),
          key: permission.uuid,
          isLeaf: true,
        };
      });
    }

    const children = [...childMenus, ...opNodes];
    if (children.length === 0) continue;

    nodes.push({
      title: (
        <span style={{ fontWeight: childMenus.length ? 600 : undefined, color: token.colorPrimary }}>
          {menuTreeNodeTitle(m, t)}
        </span>
      ),
      key,
      disableCheckbox: true,
      icon: <AppstoreOutlined />,
      children,
    });
  }
  return nodes;
}

function isAssignablePermissionTreeKey(key: string): boolean {
  return !key.startsWith('menu-');
}

/** 未挂载权限按 code 首段（应用 code）分组，便于看出自哪个应用 manifest / 同步 */
function groupOrphanPermissionsByApp(orphans: Permission[]): [string, Permission[]][] {
  const byApp = new Map<string, Permission[]>();
  for (const p of orphans) {
    const i = p.code.indexOf(':');
    const app = i > 0 ? p.code.slice(0, i) : '_other';
    if (!byApp.has(app)) byApp.set(app, []);
    byApp.get(app)!.push(p);
  }
  return [...byApp.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * 角色权限管理合并页面组件
 */
const RolesPermissionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { t } = useTranslation();

  // 角色列表相关状态
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSearchKeyword, setRoleSearchKeyword] = useState('');
  const [roleTreeData, setRoleTreeData] = useState<DataNode[]>([]);
  const [filteredRoleTreeData, setFilteredRoleTreeData] = useState<DataNode[]>([]);
  const [expandedRoleKeys, setExpandedRoleKeys] = useState<React.Key[]>([]);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<React.Key[]>([]);

  // 选中角色相关状态
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedRoleLoading, setSelectedRoleLoading] = useState(false);

  // 权限相关状态
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [permissionTreeData, setPermissionTreeData] = useState<any[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSearchKeyword, setPermissionSearchKeyword] = useState('');
  const [permissionTypeFilter, setPermissionTypeFilter] = useState<string>('all');
  const [permissionTreeExpandedKeys, setPermissionTreeExpandedKeys] = useState<React.Key[]>([]);

  // 角色编辑 Modal 相关状态
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [currentEditRole, setCurrentEditRole] = useState<Role | null>(null);
  
  // 复制权限相关状态
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [sourceRoleUuid, setSourceRoleUuid] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  // 加载初始相关状态
  const [loadPresetLoading, setLoadPresetLoading] = useState(false);
  const [cleanupLegacyLoading, setCleanupLegacyLoading] = useState(false);

  /** 与侧栏一致的菜单树（名称/顺序来自后端 + 菜单翻译） */
  const [menuTree, setMenuTree] = useState<MenuTree[]>([]);

  // 按快制造业务单据流排序：销售 -> 采购 -> 生产 -> 质量 -> 仓储 -> 财务 -> 行政 -> 通用
  const ROLE_ORDER_BY_CODE: Record<string, number> = {
    SALES_MANAGER: 100,
    SALES_OPERATOR: 110,
    SALES_PERSON: 120,
    PURCHASE_MANAGER: 200,
    PURCHASE_OPERATOR: 210,
    PURCHASE_PERSON: 220,
    PRODUCTION_MANAGER: 300,
    PRODUCTION_TEAM_LEADER: 310,
    PRODUCTION_CLERK: 320,
    PRODUCTION_STAFF: 330,
    PRODUCTION_OPERATOR: 330,
    QUALITY_MANAGER: 400,
    QUALITY_OPERATOR: 410,
    WAREHOUSE_MANAGER: 500,
    WAREHOUSE_OPERATOR: 510,
    FINANCE_MANAGER: 600,
    FINANCE_OPERATOR: 610,
    ADMIN_OFFICE: 700,
    EMPLOYEE: 800,
  };

  /**
   * 加载角色列表
   */
  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      const response = await getRoleList({ page_size: 100 });
      setRoles(response.items);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.loadRolesFailed'));
    } finally {
      setRolesLoading(false);
    }
  };

  /**
   * 编辑角色（RoleFormModal 内部根据 editUuid 拉取详情并填表）
   */
  const handleEditRole = useCallback((role: Role) => {
    setCurrentEditRole(role);
    setRoleModalVisible(true);
  }, []);

  /**
   * 删除角色
   */
  const handleDeleteRole = useCallback(async (role: Role) => {
    try {
      await deleteRole(role.uuid);
      messageApi.success(t('pages.system.roles.deleteSuccess'));

      // 如果删除的是当前选中的角色，清空选择
      setSelectedRole((prev) => {
        if (prev?.uuid === role.uuid) {
          setCheckedKeys([]);
          setSelectedRoleKeys([]);
          return null;
        }
        return prev;
      });

      // 重新加载角色列表
      setRolesLoading(true);
      try {
        const response = await getRoleList({ page_size: 100 });
        setRoles(response.items);
      } catch (error: any) {
        messageApi.error(error.message || t('pages.system.roles.loadRolesFailed'));
      } finally {
        setRolesLoading(false);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.deleteFailed'));
    }
  }, [messageApi, t]);

  /**
   * 过滤角色列表
   */
  const filteredRoles = roles
    .filter(role => {
      if (!roleSearchKeyword) return true;
      const keyword = roleSearchKeyword.toLowerCase();
      return (
        role.name.toLowerCase().includes(keyword) ||
        role.code.toLowerCase().includes(keyword) ||
        (role.description && role.description.toLowerCase().includes(keyword))
      );
    })
    .sort((a, b) => {
      const aOrder = ROLE_ORDER_BY_CODE[a.code] ?? 9999;
      const bOrder = ROLE_ORDER_BY_CODE[b.code] ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

  /**
   * 构建角色树形数据
   */
  useEffect(() => {
    const treeNodes: DataNode[] = filteredRoles.map(role => ({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space style={{ display: 'flex', alignItems: 'center', lineHeight: '1.5' }}>
            {/* 状态指示点 */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: role.is_active ? token.colorSuccess : token.colorTextTertiary,
                flexShrink: 0,
                marginRight: '8px',
              }}
            />
            <span style={{ display: 'flex', alignItems: 'center', lineHeight: '1.5' }}>{role.name}</span>
            {role.is_system && <Tag color="default">{t('pages.system.roles.system')}</Tag>}
            {!role.is_active && <Tag color="default">{t('pages.system.roles.disabled')}</Tag>}
          </Space>
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            <Tooltip title={t('pages.system.roles.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditRole(role);
                }}
                disabled={role.is_system}
              />
            </Tooltip>
            <Popconfirm
              title={t('pages.system.roles.deleteConfirm')}
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDeleteRole(role);
              }}
              disabled={role.is_system}
            >
              <Tooltip title={t('pages.system.roles.delete')}>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  disabled={role.is_system}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      ),
      key: role.uuid,
      isLeaf: true,
    }));

    setRoleTreeData(treeNodes);
    if (!roleSearchKeyword.trim()) {
      setFilteredRoleTreeData(treeNodes);
    }
  }, [filteredRoles, roleSearchKeyword, handleEditRole, handleDeleteRole]);

  /**
   * 过滤角色树（根据搜索关键词）
   */
  useEffect(() => {
    if (!roleSearchKeyword.trim()) {
      setFilteredRoleTreeData(roleTreeData);
      return;
    }

    const searchLower = roleSearchKeyword.toLowerCase().trim();
    const filtered = roleTreeData.filter(node => {
      const title = (node.title as any)?.props?.children?.[0]?.props?.children?.[1]?.props?.children || '';
      const titleText = typeof title === 'string' ? title : '';
      return titleText.toLowerCase().includes(searchLower);
    });

    setFilteredRoleTreeData(filtered);

    // 如果有搜索结果，自动展开所有节点
    if (filtered.length > 0) {
      setExpandedRoleKeys(filtered.map(node => node.key));
    }
  }, [roleTreeData, roleSearchKeyword]);

  /**
   * 加载所有权限（仅拉取数据，树形结构由 useEffect 根据筛选条件构建）
   */
  const loadAllPermissions = async () => {
    try {
      setPermissionsLoading(true);
      try {
        const trees = await getMenuTree({ is_active: true });
        setMenuTree(Array.isArray(trees) ? trees : []);
      } catch {
        setMenuTree([]);
      }

      let allItems: Permission[] = [];
      let page = 1;
      let hasMore = true;

      const pageSize = 500;
      while (hasMore) {
        const response = await getAllPermissions({ page, page_size: pageSize });
        allItems = [...allItems, ...response.items];
        if (response.items.length < pageSize || allItems.length >= response.total) {
          hasMore = false;
        } else {
          page++;
        }
      }

      setAllPermissions(allItems);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.loadPermissionsFailed'));
    } finally {
      setPermissionsLoading(false);
    }
  };

  /**
   * 按菜单树结构展示权限：菜单标题与侧栏翻译一致，带 permission_code 的节点下挂同资源前缀的操作权限
   */
  useEffect(() => {
    if (allPermissions.length === 0) {
      setPermissionTreeData([]);
      return;
    }

    const searchLower = permissionSearchKeyword.toLowerCase().trim();
    const typeFilter = permissionTypeFilter;

    const filteredItems = allPermissions.filter((p) => {
      const matchType = typeFilter === 'all' || p.permission_type === typeFilter;
      const matchSearch =
        !searchLower ||
        p.name.toLowerCase().includes(searchLower) ||
        p.code.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower));
      return matchType && matchSearch;
    });

    const expandKeys: React.Key[] = [];
    const globallyUsed = new Set<string>();

    const orphanChildren = (list: Permission[]): DataNode[] =>
      [...list].sort((a, b) => a.code.localeCompare(b.code)).map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        return {
          title: (
            <Space size={4} wrap>
              <span>{actionLabel}</span>
              <Tag color="cyan" style={{ fontSize: 10 }}>
                {permission.code}
              </Tag>
              {permission.permission_type === 'field' && (
                <Tag color="orange" style={{ fontSize: '10px' }}>
                  {t('pages.system.roles.permissionTypeField')}
                </Tag>
              )}
              {permission.permission_type === 'data' && (
                <Tag color="green" style={{ fontSize: '10px' }}>
                  {t('pages.system.roles.permissionTypeData')}
                </Tag>
              )}
            </Space>
          ),
          key: permission.uuid,
          isLeaf: true,
        };
      });

    const buildOrphanRootNode = (list: Permission[]): DataNode | null => {
      if (list.length === 0) return null;
      expandKeys.push('menu-orphan-root');
      const appFolders: DataNode[] = groupOrphanPermissionsByApp(list).map(([app, plist]) => {
        const key = `menu-orphan-app-${app}`;
        expandKeys.push(key);
        const label =
          app === '_other'
            ? t('pages.system.roles.orphanNoAppPrefix')
            : `${getAppDisplayName(app, t, app)} (${app}) · ${plist.length}`;
        return {
          title: <span style={{ fontWeight: 500 }}>{label}</span>,
          key,
          disableCheckbox: true,
          icon: <FolderOutlined />,
          children: orphanChildren(plist),
        };
      });
      return {
        title: (
          <Tooltip title={t('pages.system.roles.orphanPermissionsTooltip')}>
            <span style={{ fontWeight: 600, color: token.colorPrimary }}>
              {t('pages.system.roles.permissionsNotInMenu')}
            </span>
          </Tooltip>
        ),
        key: 'menu-orphan-root',
        disableCheckbox: true,
        icon: <FolderOutlined />,
        children: appFolders,
      };
    };

    if (!menuTree.length) {
      const treeData: DataNode[] = [];
      const orphanRoot = buildOrphanRootNode(filteredItems);
      if (orphanRoot) treeData.push(orphanRoot);
      setPermissionTreeData(treeData);
      setPermissionTreeExpandedKeys(expandKeys);
      return;
    }

    const menusForPool = filterMenusForDisplay(menuTree, filteredItems);
    const treeData = buildMenuPermissionTreeData(
      menusForPool,
      filteredItems,
      globallyUsed,
      expandKeys,
      t,
      token
    );

    const orphans = filteredItems.filter((p) => !globallyUsed.has(p.uuid));
    const orphanRoot = buildOrphanRootNode(orphans);
    if (orphanRoot) treeData.push(orphanRoot);

    setPermissionTreeData(treeData);
    setPermissionTreeExpandedKeys(expandKeys);
  }, [
    allPermissions,
    permissionSearchKeyword,
    permissionTypeFilter,
    menuTree,
    t,
    token,
  ]);

  /**
   * 当前树中展示的权限 UUID 列表（受搜索和类型筛选影响）
   */
  const displayedPermissionUuids = useMemo(() => {
    const collect: string[] = [];
    const walk = (nodes: any[]) => {
      if (!nodes) return;
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
        const k = typeof node.key === 'string' ? node.key : '';
        if (k && isAssignablePermissionTreeKey(k)) {
          collect.push(k);
        }
      }
    };
    walk(permissionTreeData);
    return collect;
  }, [permissionTreeData]);

  /**
   * 批量操作：全选当前展示的权限
   */
  const handleSelectAll = useCallback(() => {
    const currentChecked = new Set(
      checkedKeys.filter((k) => typeof k === 'string' && isAssignablePermissionTreeKey(k))
    );
    displayedPermissionUuids.forEach((uuid) => currentChecked.add(uuid));
    setCheckedKeys(Array.from(currentChecked));
  }, [checkedKeys, displayedPermissionUuids]);

  /**
   * 批量操作：全不选当前展示的权限
   */
  const handleSelectNone = useCallback(() => {
    const toRemove = new Set(displayedPermissionUuids);
    const kept = checkedKeys.filter(
      (k) =>
        typeof k !== 'string' ||
        !isAssignablePermissionTreeKey(k) ||
        !toRemove.has(k)
    );
    setCheckedKeys(kept);
  }, [checkedKeys, displayedPermissionUuids]);

  /**
   * 批量操作：反选当前展示的权限
   */
  const handleSelectInvert = useCallback(() => {
    const displayedSet = new Set(displayedPermissionUuids);
    const currentChecked = new Set(
      checkedKeys.filter((k) => typeof k === 'string' && isAssignablePermissionTreeKey(k))
    );
    const result: string[] = [];
    displayedSet.forEach((uuid) => {
      if (!currentChecked.has(uuid)) result.push(uuid);
    });
    checkedKeys.forEach((k) => {
      if (typeof k === 'string' && !displayedSet.has(k) && isAssignablePermissionTreeKey(k)) {
        result.push(k);
      }
    });
    setCheckedKeys(result);
  }, [checkedKeys, displayedPermissionUuids]);

  /**
   * 应用权限模板
   */
  const handleApplyTemplate = useCallback(
    (templateKey: string) => {
      const uuids = getPermissionUuidsByTemplate(templateKey, allPermissions);
      setCheckedKeys(uuids);
      const template = PERMISSION_TEMPLATES.find((tmpl) => tmpl.key === templateKey);
      messageApi.success(t('pages.system.roles.templateApplied', { name: template?.name || templateKey, count: uuids.length }));
    },
    [allPermissions, messageApi, t]
  );

  /**
   * 处理角色树选择
   */
  const handleRoleTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const roleUuid = selectedKeys[0] as string;
      setSelectedRoleKeys(selectedKeys);
      const role = roles.find(r => r.uuid === roleUuid);
      if (role) {
        handleSelectRole(role);
      }
    }
  };

  /**
   * 选择角色
   */
  const handleSelectRole = async (role: Role) => {
    try {
      setSelectedRoleLoading(true);
      setSelectedRole(role);

      // 加载角色的权限
      const rolePermissions = await getRolePermissions(role.uuid);
      const rolePermissionUuids = rolePermissions.map(p => p.uuid);
      setCheckedKeys(rolePermissionUuids);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.loadRolePermissionsFailed'));
    } finally {
      setSelectedRoleLoading(false);
    }
  };

  /**
   * 保存权限分配
   */
  const handleSavePermissions = async () => {
    if (!selectedRole) {
      messageApi.warning(t('pages.system.roles.selectRoleFirst'));
      return;
    }

    try {
      setSavingPermissions(true);
      const permissionUuids = checkedKeys.filter(
        (key) => typeof key === 'string' && isAssignablePermissionTreeKey(key)
      ) as string[];

      await assignPermissions(selectedRole.uuid, permissionUuids);
      messageApi.success(t('pages.system.roles.assignSuccess'));

      // 重新加载角色列表（更新权限数）
      await loadRoles();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.assignFailed'));
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleCreateRole = () => {
    setCurrentEditRole(null);
    setRoleModalVisible(true);
  };

  useNewShortcut(handleCreateRole);

  /**
   * 处理从角色复制权限
   */
  const handleCopyPermissions = async () => {
    if (!sourceRoleUuid || !selectedRole) return;
    
    try {
      setCopying(true);
      const rolePermissions = await getRolePermissions(sourceRoleUuid);
      const uuids = rolePermissions.map(p => p.uuid);
      
      // 更新当前勾选状态（覆盖）
      setCheckedKeys(uuids);
      messageApi.success(t('pages.system.roles.copySuccess'));
      setCopyModalVisible(false);
      setSourceRoleUuid(null);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.copySourceFailed'));
    } finally {
      setCopying(false);
    }
  };

  useSubmitShortcut(copyModalVisible ? handleCopyPermissions : undefined, copyModalVisible);

  // 初始化加载
  useEffect(() => {
    loadRoles();
    loadAllPermissions();
  }, []);

  return (
    <div
      className="roles-permissions-page"
      style={{
        display: 'flex',
        height: '100%',
        padding: `0 ${PAGE_SPACING?.PADDING ?? 16}px ${PAGE_SPACING?.PADDING ?? 16}px ${PAGE_SPACING?.PADDING ?? 16}px`,
        margin: 0,
        boxSizing: 'border-box',
        borderRadius: token.borderRadiusLG || token.borderRadius,
        overflow: 'hidden',
      }}
    >
      <style>{`
        /* 角色权限树特定样式：隐藏树切换器（因为所有节点都是叶子节点） */
        .roles-permissions-tree .ant-tree-switcher {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .roles-permissions-tree .ant-tree-switcher-leaf-line {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* 隐藏角色树节点图标占位符 */
        .roles-permissions-tree .ant-tree-iconEle {
          display: none !important;
          width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      {/* 左侧角色树 */}
      <div
        style={{
          width: '300px',
          borderTop: `1px solid ${token.colorBorder}`,
          borderBottom: `1px solid ${token.colorBorder}`,
          borderLeft: `1px solid ${token.colorBorder}`,
          borderRight: 'none',
          backgroundColor: token.colorFillAlter || '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderTopLeftRadius: token.borderRadiusLG || token.borderRadius,
          borderBottomLeftRadius: token.borderRadiusLG || token.borderRadius,
        }}
      >
        {/* 搜索栏 */}
        <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
          <Input
            placeholder={t('pages.system.roles.searchRole')}
            prefix={<SearchOutlined />}
            value={roleSearchKeyword}
            onChange={(e) => setRoleSearchKeyword(e.target.value)}
            allowClear
            size="middle"
          />
        </div>

        {/* 新建按钮与加载初始 */}
        <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
          <Space orientation="vertical" style={{ width: '100%' }} size="small">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={handleCreateRole}
            >
              {t('pages.system.roles.createRole') + NEW_SHORTCUT_HINT}
            </Button>
            <Flex gap="small" style={{ width: '100%' }}>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                loading={loadPresetLoading}
                onClick={async () => {
                  try {
                    setLoadPresetLoading(true);
                    const res = await loadPresetRoles();
                    messageApi.success(res.message);
                    await loadRoles();
                  } catch (e: any) {
                    messageApi.error(e?.message || t('common.operationFailed'));
                  } finally {
                    setLoadPresetLoading(false);
                  }
                }}
              >
                {t('field.role.loadPreset')}
              </Button>
              <Button
                style={{ flex: 1, minWidth: 0 }}
                loading={cleanupLegacyLoading}
                onClick={async () => {
                  try {
                    setCleanupLegacyLoading(true);
                    const res = await cleanupLegacyRoles();
                    messageApi.success(
                      `${res.message}（重命名${res.renamed}，合并${res.merged}，删除${res.soft_deleted}）`
                    );
                    await loadRoles();
                  } catch (e: any) {
                    messageApi.error(e?.message || t('common.operationFailed'));
                  } finally {
                    setCleanupLegacyLoading(false);
                  }
                }}
              >
                清理旧角色
              </Button>
            </Flex>
          </Space>
        </div>

        {/* 角色树 */}
        <div className="left-panel-scroll-container" style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <Spin spinning={rolesLoading}>
            <Tree
              className="roles-permissions-tree"
              treeData={filteredRoleTreeData.length > 0 || !roleSearchKeyword.trim() ? filteredRoleTreeData : roleTreeData}
              selectedKeys={selectedRoleKeys}
              expandedKeys={expandedRoleKeys}
              onSelect={handleRoleTreeSelect}
              onExpand={setExpandedRoleKeys}
              blockNode
            />
          </Spin>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: token.colorBgContainer,
        border: `1px solid ${token.colorBorder}`,
        borderLeft: 'none',
        borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
        borderBottomRightRadius: token.borderRadiusLG || token.borderRadius,
      }}>
        {/* 顶部工具栏 */}
        <div
          style={{
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadRoles();
                loadAllPermissions();
                if (selectedRole) {
                  handleSelectRole(selectedRole);
                }
              }}
            >
              {t('pages.system.roles.refresh')}
            </Button>
          </Space>

          {/* 角色信息 */}
          <div style={{ flex: 1 }}>
            {selectedRole ? (
              <Space>
                <span style={{ fontWeight: 500 }}>{selectedRole.name}</span>
                <Tag color="blue">{selectedRole.code}</Tag>
                {selectedRole.is_system && <Tag color="default">{t('pages.system.roles.systemRole')}</Tag>}
                {!selectedRole.is_active && <Tag color="default">{t('pages.system.roles.disabledRole')}</Tag>}
              </Space>
            ) : (
              <span style={{ color: token.colorTextSecondary }}>{t('pages.system.roles.selectRoleHint')}</span>
            )}
          </div>

          {selectedRole && (
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={() => setCopyModalVisible(true)}
              >
                {t('pages.system.roles.copyFromRole')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSavePermissions}
                loading={savingPermissions}
              >
                {t('pages.system.roles.savePermissions')}
              </Button>
            </Space>
          )}
        </div>

        {/* 权限编辑区域 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {selectedRole ? (
            <Spin spinning={selectedRoleLoading || permissionsLoading}>
              <div style={{ marginBottom: 16 }}>
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <span style={{ color: token.colorTextSecondary }}>{t('pages.system.roles.roleDescription')}</span>
                    <span style={{ color: token.colorText }}>
                      {selectedRole.description || t('pages.system.roles.noDescription')}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: token.colorTextSecondary }}>{t('pages.system.roles.permissionCount')}</span>
                    <Tag color="blue">{selectedRole.permission_count || 0}</Tag>
                    <span style={{ color: token.colorTextSecondary, marginLeft: 16 }}>{t('pages.system.roles.userCount')}</span>
                    <Tag color="green">{selectedRole.user_count || 0}</Tag>
                  </div>
                </Space>
              </div>
              <div style={{ marginTop: 16 }}>
                <Tabs
                  activeKey={permissionTypeFilter}
                  onChange={setPermissionTypeFilter}
                  items={[
                    { key: 'all', label: t('pages.system.roles.allTypes') },
                    { key: 'function', label: t('pages.system.roles.functionPermission') },
                    { key: 'data', label: t('pages.system.roles.dataPermission') },
                    { key: 'field', label: t('pages.system.roles.fieldPermission') },
                  ]}
                  style={{ marginBottom: 0 }}
                />
              </div>

              {/* 权限树搜索与批量操作 */}
              <Flex gap="middle" style={{ margin: '16px 0' }} wrap="wrap" align="center" justify="space-between">
                <Space>
                  <Input
                    placeholder={t('pages.system.roles.searchPermission')}
                    prefix={<SearchOutlined />}
                    value={permissionSearchKeyword}
                    onChange={(e) => setPermissionSearchKeyword(e.target.value)}
                    allowClear
                    style={{ width: 240 }}
                  />
                  <Divider orientation="vertical" />
                  <Space size="small">
                    <Tooltip title={t('pages.system.roles.selectAllTooltip')}>
                      <Button size="small" icon={<CheckSquareOutlined />} onClick={handleSelectAll}>
                        {t('pages.system.roles.selectAll')}
                      </Button>
                  </Tooltip>
                  <Tooltip title={t('pages.system.roles.selectNoneTooltip')}>
                    <Button size="small" icon={<BorderOutlined />} onClick={handleSelectNone}>
                      {t('pages.system.roles.selectNone')}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('pages.system.roles.selectInvertTooltip')}>
                    <Button size="small" icon={<SwapOutlined />} onClick={handleSelectInvert}>
                      {t('pages.system.roles.selectInvert')}
                    </Button>
                  </Tooltip>
                </Space>
              </Space>
              <Select
                  placeholder={t('pages.system.roles.applyTemplate')}
                  style={{ width: 160 }}
                  allowClear
                  onChange={(key) => key && handleApplyTemplate(key)}
                  options={PERMISSION_TEMPLATES.map((tmpl) => ({
                    value: tmpl.key,
                    label: tmpl.name + (tmpl.description ? ` (${tmpl.description})` : ''),
                  }))}
                />
              </Flex>
              <Tree
                checkable
                checkedKeys={checkedKeys}
                onCheck={(checked) => {
                  const keys = Array.isArray(checked)
                    ? checked
                    : (checked as { checked?: React.Key[] }).checked ?? [];
                  setCheckedKeys(keys);
                }}
                treeData={permissionTreeData}
                expandedKeys={permissionTreeExpandedKeys}
                onExpand={(keys) => setPermissionTreeExpandedKeys(keys as React.Key[])}
                showIcon
                blockNode
              />
            </Spin>
          ) : (
            <Empty
              description={t('pages.system.roles.selectRoleToEdit')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>

        {/* 底部状态栏 */}
        {selectedRole && (
          <div
            style={{
              borderTop: `1px solid ${token.colorBorder}`,
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
              color: token.colorTextSecondary,
            }}
          >
            <span>
              {t('pages.system.roles.selectedCount', {
                count: checkedKeys.filter(
                  (key) => typeof key === 'string' && isAssignablePermissionTreeKey(key)
                ).length,
              })}
            </span>
            <span>
              {t('pages.system.roles.totalPermissions', { count: allPermissions.length })}
            </span>
          </div>
        )}
      </div>

      {/* 角色编辑 Modal - 复用 RoleFormModal（Schema 驱动，代码在名称前） */}
      <RoleFormModal
        open={roleModalVisible}
        onClose={() => { setRoleModalVisible(false); setCurrentEditRole(null); }}
        editUuid={currentEditRole?.uuid ?? null}
        onSuccess={async () => {
          const editedUuid = currentEditRole?.uuid;
          await loadRoles();
          if (editedUuid && selectedRole?.uuid === editedUuid) {
            try {
              const updated = await getRoleByUuid(editedUuid);
              setSelectedRole(updated);
              await handleSelectRole(updated);
            } catch (e: any) {
              messageApi.error(e?.message || t('common.loadFailed'));
            }
          }
        }}
      />

      {/* 复制权限 Modal */}
      <Modal
        title={t('pages.system.roles.copyFromRoleTitle')}
        open={copyModalVisible}
        onCancel={() => {
          setCopyModalVisible(false);
          setSourceRoleUuid(null);
        }}
        onOk={handleCopyPermissions}
        okText={t('common.confirm') + SUBMIT_SHORTCUT_HINT}
        confirmLoading={copying}
        okButtonProps={{ disabled: !sourceRoleUuid }}
      >
        <div style={{ marginBottom: 16 }}>
          <p>{t('pages.system.roles.copySourceHint')}</p>
          <Select
            placeholder={t('pages.system.roles.selectSourceRole')}
            style={{ width: '100%' }}
            onChange={setSourceRoleUuid}
            value={sourceRoleUuid}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={roles
              .filter(r => r.uuid !== selectedRole?.uuid)
              .map(r => ({
                label: r.name + ' (' + r.code + ')',
                value: r.uuid,
              }))}
          />
        </div>
        <p style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
          {t('pages.system.roles.copyWarning')}
        </p>
      </Modal>
    </div>
  );
};

export default RolesPermissionsPage;
