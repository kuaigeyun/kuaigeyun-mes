/**
 * 角色权限管理合并页面
 * 
 * 左侧：角色树形菜单
 * 右侧：选中角色的权限编辑界面
 * 
 * 整合了角色管理和权限分配功能，提供更直观的管理体验。
 * 布局参考文件管理页面设计。
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Checkbox,
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
  NodeCollapseOutlined,
  NodeExpandOutlined,
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
  getRoleDataPolicies,
  saveRoleDataPolicies,
  getRoleFieldPolicies,
  saveRoleFieldPolicies,
  Role,
  Permission,
  DataPermissionPolicy,
  FieldPermissionPolicy,
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
  if (code === 'kuaizhizao:work-order:assign') {
    return t('permission.kuaizhizao.workOrderAssign', { defaultValue: '工单派工' });
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
  const actionFallback: Record<string, string> = {
    create: '新建',
    read: '查看',
    update: '编辑',
    delete: '删除',
    import: '导入',
    export: '导出',
    submit: '提交',
    approve: '审批通过',
    reject: '审批驳回',
    revoke: '撤销',
    audit: '审核',
    assign: '派工/分配',
    execute: '执行',
    print: '打印',
  };
  return actionFallback[String(actionSeg).toLowerCase()] || actionSeg;
}

/**
 * 菜单 permission_code 对应的资源前缀（含 app 段），兼容 meta.node 下划线与 manifest 连字符两种写法。
 */
function resourcePrefixesForMenuCode(menuCode: string): string[] {
  const parts = menuCode.split(':').filter(Boolean);
  if (parts.length < 2) return [];
  const app = parts[0];
  const appVariants = [...new Set([app, app.replace(/_/g, '-'), app.replace(/-/g, '_')])];
  const resourceParts = parts.length >= 3 ? parts.slice(1, -1) : parts.slice(1);
  const resourceJoined = resourceParts.join(':');
  const asHyphen = resourceJoined.replace(/_/g, '-');
  const asUnder = resourceJoined.replace(/-/g, '_');
  const uniq = [...new Set([resourceJoined, asHyphen, asUnder])];
  return appVariants.flatMap((a) => uniq.map((r) => `${a}:${r}:`));
}

/** 路径型菜单资源（如 quality-management-incoming-inspection）对应到 manifest 短资源码（incoming-inspection） */
const GENERIC_RESOURCE_SUFFIX = new Set(['dashboard', 'reports', 'statistics', 'terminal']);
const RESOURCE_ALIAS_MAP: Record<string, string[]> = {
  'purchase-request': ['purchase-requisition'],
  'purchase-requisition': ['purchase-request'],
};

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

function resourceExactAliases(resource: string): string[] {
  if (!resource) return [];
  return RESOURCE_ALIAS_MAP[resource] || [];
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
    for (const alias of resourceExactAliases(resource)) {
      const prefix = `${app}:${alias}:`;
      for (const p of pool) {
        if (p.code.startsWith(prefix)) add(p);
      }
    }
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

const REVIEW_ACTIONS = new Set(['approve', 'audit', 'reject']);

function parseResourceAndAction(code: string): { resource: string; action: string } | null {
  const parts = (code || '').split(':').filter(Boolean);
  if (parts.length < 3) return null;
  return {
    resource: parts.slice(0, -1).join(':'),
    action: parts[parts.length - 1].toLowerCase(),
  };
}

function buildMenuPermissionTreeData(
  menus: MenuTree[],
  pool: Permission[],
  globallyUsed: Set<string>,
  expandKeys: React.Key[],
  t: (key: string, opts?: { defaultValue?: string }) => string,
  token: { colorPrimary: string },
  mergedPermissionMap: Record<string, string[]>,
  checkedPermissionSet: Set<string>,
  onTogglePermission: (key: string, checked: boolean) => void
): DataNode[] {
  const sorted = [...menus].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const nodes: DataNode[] = [];

  for (const m of sorted) {
    const key = `menu-${m.uuid}`;
    expandKeys.push(key);

    const childMenus = m.children?.length
      ? buildMenuPermissionTreeData(
          m.children,
          pool,
          globallyUsed,
          expandKeys,
          t,
          token,
          mergedPermissionMap,
          checkedPermissionSet,
          onTogglePermission
        )
      : [];

    const code = m.permission_code?.trim();
    let actionItems: Array<{ key: string; label: string }> = [];
    if (code) {
      const matched = permissionsMatchingMenuCode(code, pool).filter((p) => !globallyUsed.has(p.uuid));
      matched.forEach((p) => globallyUsed.add(p.uuid));
      const plainActionItems = matched.map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        return {
          key: permission.uuid,
          label: actionLabel,
        };
      });

      const reviewGroup = new Map<string, string[]>();
      matched.forEach((permission) => {
        const parsed = parseResourceAndAction(permission.code || '');
        if (!parsed || !REVIEW_ACTIONS.has(parsed.action)) return;
        if (!reviewGroup.has(parsed.resource)) reviewGroup.set(parsed.resource, []);
        reviewGroup.get(parsed.resource)!.push(permission.uuid);
      });

      const mergedReviewItems: Array<{ key: string; label: string }> = [];
      reviewGroup.forEach((uuids, resource) => {
        if (uuids.length < 2) return;
        const mergedKey = `merged-review:${resource}`;
        mergedPermissionMap[mergedKey] = uuids;
        mergedReviewItems.push({ key: mergedKey, label: '审核' });
      });

      const covered = new Set(Object.values(mergedPermissionMap).flat());
      const remaining = plainActionItems
        .filter((n) => !covered.has(String(n.key)))
        .map((n) => ({ key: String(n.key), label: n.label || '' }));
      actionItems = [...mergedReviewItems, ...remaining];
    }

    const children = [...childMenus];
    const actionKeys = actionItems.map((a) => a.key);
    if (children.length === 0 && actionItems.length === 0) continue;

    nodes.push({
      title: (
        <span className="permission-menu-title-wrap">
          <span style={{ fontWeight: childMenus.length ? 600 : undefined, color: token.colorPrimary }}>
            {menuTreeNodeTitle(m, t)}
          </span>
          {actionItems.length > 0 && (
            <div className="permission-action-row">
              {actionItems.map((item) => {
                const mergedChildren = mergedPermissionMap[item.key] || [];
                const checked = mergedChildren.length
                  ? checkedPermissionSet.has(item.key) || mergedChildren.some((u) => checkedPermissionSet.has(u))
                  : checkedPermissionSet.has(item.key);
                return (
                  <label key={item.key} className="permission-action-chip">
                    <Checkbox checked={checked} onChange={(e) => onTogglePermission(item.key, e.target.checked)} />
                    <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </span>
      ),
      key,
      disableCheckbox: true,
      icon: <AppstoreOutlined />,
      className: actionItems.length > 0 ? 'permission-menu-with-actions' : undefined,
      actionKeys,
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
    // 无应用前缀（不含 ":"）的权限不在未挂载分组中展示
    if (i <= 0) continue;
    const app = p.code.slice(0, i);
    if (!byApp.has(app)) byApp.set(app, []);
    byApp.get(app)!.push(p);
  }
  return [...byApp.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function isMenuMountRequiredPermission(code: string): boolean {
  const c = (code || '').trim().toLowerCase();
  if (!c) return false;
  // 系统治理类接口权限（system:*）不以菜单挂载为目标，避免误报“未挂载”。
  if (c.startsWith('system:')) return false;
  return true;
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
  const [permissionLayer, setPermissionLayer] = useState<'function' | 'data' | 'field'>('function');
  const [permissionSearchKeyword, setPermissionSearchKeyword] = useState('');
  const [permissionTreeExpandedKeys, setPermissionTreeExpandedKeys] = useState<React.Key[]>([]);
  const [dataPolicies, setDataPolicies] = useState<DataPermissionPolicy[]>([]);
  const [fieldPolicies, setFieldPolicies] = useState<FieldPermissionPolicy[]>([]);
  const [mergedPermissionKeyMap, setMergedPermissionKeyMap] = useState<Record<string, string[]>>({});
  const mergedPermissionKeyMapRef = useRef<Record<string, string[]>>({});
  const initializedExpandRef = useRef(false);
  const checkedPermissionSet = useMemo(() => new Set(checkedKeys.map(String)), [checkedKeys]);
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
        const response = await getAllPermissions({
          page,
          page_size: pageSize,
          exclude_derived_data: true,
        });
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
  const togglePermissionKey = useCallback(
    (key: string, checked: boolean) => {
      setCheckedKeys((prev) => {
        const set = new Set(prev.map(String));
        const merged = mergedPermissionKeyMapRef.current[key] || [];
        if (checked) {
          set.add(key);
          if (merged.length > 0) merged.forEach((u) => set.delete(u));
        } else {
          set.delete(key);
          if (merged.length > 0) merged.forEach((u) => set.delete(u));
        }
        return Array.from(set);
      });
    },
    []
  );

  useEffect(() => {
    if (allPermissions.length === 0) {
      setPermissionTreeData([]);
      return;
    }

    const searchLower = permissionSearchKeyword.toLowerCase().trim();
    const filteredItems = allPermissions.filter((p) => {
      const matchSearch =
        !searchLower ||
        p.name.toLowerCase().includes(searchLower) ||
        p.code.toLowerCase().includes(searchLower) ||
        (p.description && p.description.toLowerCase().includes(searchLower));
      return matchSearch;
    });

    const expandKeys: React.Key[] = [];
    const globallyUsed = new Set<string>();

    const orphanChildren = (list: Permission[]): DataNode[] =>
      [...list].sort((a, b) => a.code.localeCompare(b.code)).map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        return {
          title: <span style={{ whiteSpace: 'nowrap' }}>{actionLabel}</span>,
          key: permission.uuid,
          isLeaf: true,
          className: 'permission-action-leaf',
        };
      });

    const buildOrphanRootNode = (list: Permission[]): DataNode | null => {
      if (list.length === 0) return null;
      const appFolders: DataNode[] = groupOrphanPermissionsByApp(list).map(([app, plist]) => {
        const key = `menu-orphan-app-${app}`;
        expandKeys.push(key);
        const label = `${getAppDisplayName(app, t, app)} (${app}) · ${plist.length}`;
        return {
          title: <span style={{ fontWeight: 500 }}>{label}</span>,
          key,
          disableCheckbox: true,
          icon: <FolderOutlined />,
          children: orphanChildren(plist),
        };
      });
      if (appFolders.length === 0) return null;
      expandKeys.push('menu-orphan-root');
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
      if (!initializedExpandRef.current) {
        setPermissionTreeExpandedKeys(expandKeys);
        initializedExpandRef.current = true;
      }
      mergedPermissionKeyMapRef.current = {};
      setMergedPermissionKeyMap({});
      return;
    }

    const menusForPool = filterMenusForDisplay(menuTree, filteredItems);
    const mergedMap: Record<string, string[]> = {};
    const treeData = buildMenuPermissionTreeData(
      menusForPool,
      filteredItems,
      globallyUsed,
      expandKeys,
      t,
      token,
      mergedMap,
      checkedPermissionSet,
      togglePermissionKey
    );

      const orphans = filteredItems.filter(
        (p) => !globallyUsed.has(p.uuid) && isMenuMountRequiredPermission(p.code)
      );
    const orphanRoot = buildOrphanRootNode(orphans);
    if (orphanRoot) treeData.push(orphanRoot);

    setPermissionTreeData(treeData);
    if (!initializedExpandRef.current) {
      setPermissionTreeExpandedKeys(expandKeys);
      initializedExpandRef.current = true;
    }
    mergedPermissionKeyMapRef.current = mergedMap;
    setMergedPermissionKeyMap(mergedMap);
  }, [
    allPermissions,
    permissionSearchKeyword,
    menuTree,
    t,
    token,
    checkedPermissionSet,
  ]);

  useEffect(() => {
    if (Object.keys(mergedPermissionKeyMap).length === 0) return;
    setCheckedKeys((prev) => {
      const set = new Set(prev.map(String));
      Object.entries(mergedPermissionKeyMap).forEach(([mergedKey, uuids]) => {
        if (uuids.some((u) => set.has(u))) {
          set.add(mergedKey);
          uuids.forEach((u) => set.delete(u));
        }
      });
      return Array.from(set);
    });
  }, [mergedPermissionKeyMap]);

  /**
   * 当前树中展示的权限 UUID 列表（受搜索和类型筛选影响）
   */
  const displayedPermissionUuids = useMemo(() => {
    const collect: string[] = [];
    const walk = (nodes: any[]) => {
      if (!nodes) return;
      for (const node of nodes) {
        if (Array.isArray(node.actionKeys)) {
          node.actionKeys.forEach((k: string) => collect.push(k));
        }
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

  const resourceLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (nodes: MenuTree[]) => {
      for (const m of nodes || []) {
        const code = (m.permission_code || '').trim();
        if (code) {
          const parts = code.split(':').filter(Boolean);
          if (parts.length >= 2) {
            const app = parts[0];
            const resource = parts.length >= 3 ? parts.slice(1, -1).join(':') : parts[1];
            map.set(`${app}:${resource}`, menuTreeNodeTitle(m, t));
          }
        }
        if (m.children?.length) walk(m.children);
      }
    };
    walk(menuTree);
    return map;
  }, [menuTree, t]);

  const resourceOptions = useMemo(() => {
    const set = new Set<string>();
    allPermissions.forEach((p) => {
      const parts = (p.code || '').split(':').filter(Boolean);
      if (parts.length >= 2) {
        set.add(`${parts[0]}:${parts.slice(1, -1).join(':') || parts[1]}`);
      }
    });
    return Array.from(set)
      .sort()
      .map((value) => {
        const [app, ...rest] = value.split(':');
        const resource = rest.join(':');
        const appName = getAppDisplayName(app, t, app);
        const fallback = `${appName} / ${resource}`;
        return {
          value,
          label: resourceLabelMap.get(value) || fallback,
        };
      });
  }, [allPermissions, resourceLabelMap, t]);

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

      // 并行加载三层权限数据
      const [rolePermissions, roleDataPolicies, roleFieldPolicies] = await Promise.all([
        getRolePermissions(role.uuid),
        getRoleDataPolicies(role.uuid),
        getRoleFieldPolicies(role.uuid),
      ]);
      setCheckedKeys(rolePermissions.map(p => p.uuid));
      setDataPolicies(roleDataPolicies);
      setFieldPolicies(roleFieldPolicies);
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
      if (permissionLayer === 'function') {
        const expanded = new Set<string>();
        checkedKeys.forEach((key) => {
          if (typeof key !== 'string' || !isAssignablePermissionTreeKey(key)) return;
          const merged = mergedPermissionKeyMap[key];
          if (merged?.length) {
            merged.forEach((u) => expanded.add(u));
          } else {
            expanded.add(key);
          }
        });
        const permissionUuids = Array.from(expanded);
        await assignPermissions(selectedRole.uuid, permissionUuids);
      } else if (permissionLayer === 'data') {
        await saveRoleDataPolicies(
          selectedRole.uuid,
          dataPolicies.map((x) => ({
            resource: x.resource,
            scope_type: x.scope_type,
            scope_payload: x.scope_payload,
          }))
        );
      } else {
        await saveRoleFieldPolicies(
          selectedRole.uuid,
          fieldPolicies.map((x) => ({
            resource: x.resource,
            field_name: x.field_name,
            mask_level: x.mask_level,
          }))
        );
      }
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

  /**
   * 一键展开/收起权限树
   */
  const togglePermissionTreeExpand = useCallback(() => {
    if (permissionTreeExpandedKeys.length > 0) {
      setPermissionTreeExpandedKeys([]);
    } else {
      const allKeys: React.Key[] = [];
      const traverse = (nodes: any[]) => {
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            allKeys.push(node.key);
            traverse(node.children);
          }
        });
      };
      traverse(permissionTreeData);
      setPermissionTreeExpandedKeys(allKeys);
    }
  }, [permissionTreeExpandedKeys, permissionTreeData]);

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
        {/* 顶部工具栏 - 重新组织的标题容器 */}
        <div
          style={{
            backgroundColor: token.colorBgContainer,
            zIndex: 1,
          }}
        >
          {/* 第一层：状态、角色身份与全局操作 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '12px 16px',
            borderBottom: selectedRole ? `1px solid ${token.colorBorderSecondary || 'rgba(0,0,0,0.06)'}` : 'none'
          }}>
            <Space size="middle" style={{ flex: 1, minWidth: 0 }}>
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
                <Button
                  icon={permissionTreeExpandedKeys.length > 0 ? <NodeCollapseOutlined /> : <NodeExpandOutlined />}
                  onClick={togglePermissionTreeExpand}
                >
                  {permissionTreeExpandedKeys.length > 0
                    ? t('pages.system.roles.collapseAll')
                    : t('pages.system.roles.expandAll')}
                </Button>
              </Space>

              {selectedRole ? (
                <>
                  <Divider type="vertical" style={{ height: 24 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Space size="small">
                      <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRole.name}</span>
                      <Tag color="blue" bordered={false} style={{ margin: 0 }}>{selectedRole.code}</Tag>
                      {selectedRole.is_system && <Tag color="default" bordered={false}>{t('pages.system.roles.systemRole')}</Tag>}
                    </Space>
                    <div style={{ 
                      fontSize: '12px', 
                      color: token.colorTextSecondary, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}>
                      {t('pages.system.roles.roleDescription')}{selectedRole.description || t('pages.system.roles.noDescription')}
                    </div>
                  </div>
                </>
              ) : (
                <span style={{ color: token.colorTextSecondary, marginLeft: 8 }}>{t('pages.system.roles.selectRoleHint')}</span>
              )}
            </Space>

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

          {/* 第二层：树操作工具（搜索、批处理、模板、统计与页签） */}
          {selectedRole && (
            <div style={{ padding: '16px 16px 0 16px' }}>
              <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                <Space size="middle">
                  {permissionLayer === 'function' && (
                    <>
                      <Input
                        placeholder={t('pages.system.roles.searchPermission')}
                        prefix={<SearchOutlined />}
                        value={permissionSearchKeyword}
                        onChange={(e) => setPermissionSearchKeyword(e.target.value)}
                        allowClear
                        style={{ width: 280 }}
                      />
                      <Space split={<Divider type="vertical" style={{ height: 14 }} />} size={0}>
                        <Tooltip title={t('pages.system.roles.selectAllTooltip')}>
                          <Button type="text" size="small" icon={<CheckSquareOutlined />} onClick={handleSelectAll}>
                            {t('pages.system.roles.selectAll')}
                          </Button>
                        </Tooltip>
                        <Tooltip title={t('pages.system.roles.selectNoneTooltip')}>
                          <Button type="text" size="small" icon={<BorderOutlined />} onClick={handleSelectNone}>
                            {t('pages.system.roles.selectNone')}
                          </Button>
                        </Tooltip>
                        <Tooltip title={t('pages.system.roles.selectInvertTooltip')}>
                          <Button type="text" size="small" icon={<SwapOutlined />} onClick={handleSelectInvert}>
                            {t('pages.system.roles.selectInvert')}
                          </Button>
                        </Tooltip>
                      </Space>
                    </>
                  )}
                </Space>
                
                <Space size="middle">
                  <div style={{ fontSize: '13px', color: token.colorTextSecondary }}>
                    <span>{t('pages.system.roles.permissionCount')} <Tag color="blue" bordered={false}>{selectedRole.permission_count || 0}</Tag></span>
                    <span style={{ marginLeft: 12 }}>{t('pages.system.roles.userCount')} <Tag color="green" bordered={false}>{selectedRole.user_count || 0}</Tag></span>
                  </div>
                  {permissionLayer === 'function' && (
                    <Select
                      placeholder={t('pages.system.roles.applyTemplate')}
                      style={{ width: 180 }}
                      allowClear
                      onChange={(key) => key && handleApplyTemplate(key)}
                      options={PERMISSION_TEMPLATES.map((tmpl) => ({
                        value: tmpl.key,
                        label: tmpl.name + (tmpl.description ? ` (${tmpl.description})` : ''),
                      }))}
                    />
                  )}
                </Space>
              </Flex>
              <Tabs
                activeKey={permissionLayer}
                onChange={(key) => setPermissionLayer(key as 'function' | 'data' | 'field')}
                items={[
                  { key: 'function', label: '功能权限' },
                  { key: 'data', label: '数据权限' },
                  { key: 'field', label: '字段权限' },
                ]}
                style={{ marginBottom: 8 }}
                tabBarStyle={{ marginBottom: 0 }}
              />
            </div>
          )}
        </div>

        {/* 权限编辑区域 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {selectedRole ? (
            <Spin spinning={selectedRoleLoading || permissionsLoading}>
              {permissionLayer === 'function' && (
                <Tree
                  className="permission-tree-horizontal"
                  treeData={permissionTreeData}
                  expandedKeys={permissionTreeExpandedKeys}
                  onExpand={(keys) => setPermissionTreeExpandedKeys(keys as React.Key[])}
                  showIcon
                />
              )}
              {permissionLayer === 'data' && (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {dataPolicies.map((item, idx) => (
                    <Flex key={`data-${idx}`} gap={8}>
                      <Select
                        style={{ width: 360 }}
                        value={item.resource}
                        showSearch
                        options={resourceOptions}
                        onChange={(val) =>
                          setDataPolicies((prev) => prev.map((x, i) => (i === idx ? { ...x, resource: val } : x)))
                        }
                      />
                      <Select
                        style={{ width: 180 }}
                        value={item.scope_type}
                        options={[
                          { value: 'scope_all', label: '全部' },
                          { value: 'scope_department', label: '本部门' },
                          { value: 'scope_self', label: '本人' },
                          { value: 'scope_custom', label: '自定义' },
                        ]}
                        onChange={(val) =>
                          setDataPolicies((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, scope_type: val as DataPermissionPolicy['scope_type'] } : x))
                          )
                        }
                      />
                      <Button danger onClick={() => setDataPolicies((prev) => prev.filter((_, i) => i !== idx))}>
                        删除
                      </Button>
                    </Flex>
                  ))}
                  <Button
                    onClick={() =>
                      setDataPolicies((prev) => [
                        ...prev,
                        {
                          uuid: `tmp-data-${Date.now()}`,
                          role_uuid: selectedRole.uuid,
                          resource: resourceOptions[0]?.value || '',
                          scope_type: 'scope_self',
                        },
                      ])
                    }
                  >
                    新增数据权限策略
                  </Button>
                </Space>
              )}
              {permissionLayer === 'field' && (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {fieldPolicies.map((item, idx) => (
                    <Flex key={`field-${idx}`} gap={8}>
                      <Select
                        style={{ width: 320 }}
                        value={item.resource}
                        showSearch
                        options={resourceOptions}
                        onChange={(val) =>
                          setFieldPolicies((prev) => prev.map((x, i) => (i === idx ? { ...x, resource: val } : x)))
                        }
                      />
                      <Input
                        style={{ width: 220 }}
                        placeholder="字段名"
                        value={item.field_name}
                        onChange={(e) =>
                          setFieldPolicies((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, field_name: e.target.value } : x))
                          )
                        }
                      />
                      <Select
                        style={{ width: 160 }}
                        value={item.mask_level}
                        options={[
                          { value: 'full', label: '明文' },
                          { value: 'masked', label: '脱敏' },
                          { value: 'hidden', label: '隐藏' },
                        ]}
                        onChange={(val) =>
                          setFieldPolicies((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, mask_level: val as FieldPermissionPolicy['mask_level'] } : x))
                          )
                        }
                      />
                      <Button danger onClick={() => setFieldPolicies((prev) => prev.filter((_, i) => i !== idx))}>
                        删除
                      </Button>
                    </Flex>
                  ))}
                  <Button
                    onClick={() =>
                      setFieldPolicies((prev) => [
                        ...prev,
                        {
                          uuid: `tmp-field-${Date.now()}`,
                          role_uuid: selectedRole.uuid,
                          resource: resourceOptions[0]?.value || '',
                          field_name: '',
                          mask_level: 'full',
                        },
                      ])
                    }
                  >
                    新增字段权限策略
                  </Button>
                </Space>
              )}
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
      <style>{`
        .permission-tree-horizontal .ant-tree-iconEle + span,
        .permission-tree-horizontal .ant-tree-title {
          white-space: nowrap;
        }
        .permission-tree-horizontal .ant-tree-node-content-wrapper {
          white-space: nowrap;
        }
        .permission-tree-horizontal .permission-menu-title-wrap {
          display: inline-flex;
          flex-direction: column;
          vertical-align: top;
        }
        .permission-tree-horizontal .permission-action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 16px;
          margin-top: 4px;
        }
        .permission-tree-horizontal .permission-action-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default RolesPermissionsPage;
