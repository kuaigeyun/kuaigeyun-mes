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
  Table,
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
  getRolePresetPreview,
  type PresetRoleItem,
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

function fieldNameDisplayLabel(item: FieldPermissionPolicy): string {
  return (item.field_label || '').trim() || (item.field_name || '').trim();
}

const normCache = new Map<string, string>();
/** 功能权限 code 比较用规范化（与后端 manifest / 同步一致） */
function normalizeFunctionPermissionCode(code: string): string {
  if (!code) return '';
  let res = normCache.get(code);
  if (res !== undefined) return res;
  res = code.trim().toLowerCase().replace(/_/g, '-');
  normCache.set(code, res);
  return res;
}

const anchorCache = new Map<string, string | null>();
/**
 * 从 app:resource:action 解析 resource 锚点（resource 内可含冒号，如多段）。
 * 用于避免父资源前缀 startsWith 误吞子资源码（例：...-reporting 不得匹配 ...-reporting-statistics）。
 */
function resourceAnchorFromPermissionCode(full: string): string | null {
  if (!full) return null;
  let res = anchorCache.get(full);
  if (res !== undefined) return res;
  const parts = normalizeFunctionPermissionCode(full).split(':').filter(Boolean);
  if (parts.length < 3) {
    anchorCache.set(full, null);
    return null;
  }
  const computed = parts.slice(1, -1).join(':');
  anchorCache.set(full, computed);
  return computed;
}

const prefixCache = new Map<string, string[]>();
/**
 * 菜单 permission_code 对应的资源前缀（含 app 段），兼容 meta.node 下划线与 manifest 连字符两种写法。
 */
function resourcePrefixesForMenuCode(menuCode: string): string[] {
  if (!menuCode) return [];
  let res = prefixCache.get(menuCode);
  if (res !== undefined) return res;
  const parts = normalizeFunctionPermissionCode(menuCode).split(':').filter(Boolean);
  if (parts.length < 2) {
    prefixCache.set(menuCode, []);
    return [];
  }
  const app = parts[0];
  const appVariants = [...new Set([app, app.replace(/_/g, '-'), app.replace(/-/g, '_')])];
  const resourceParts = parts.length >= 3 ? parts.slice(1, -1) : parts.slice(1);
  const resourceJoined = resourceParts.join(':');
  const asHyphen = resourceJoined.replace(/_/g, '-');
  const asUnder = resourceJoined.replace(/-/g, '_');
  const uniq = [...new Set([resourceJoined, asHyphen, asUnder])];
  const computed = appVariants.flatMap((a) => uniq.map((r) => `${a}:${r}:`));
  prefixCache.set(menuCode, computed);
  return computed;
}

/** 路径型菜单资源（如 quality-management-incoming-inspection）对应到 manifest 短资源码（incoming-inspection） */
const GENERIC_RESOURCE_SUFFIX = new Set(['dashboard', 'reports', 'statistics', 'terminal']);
const RESOURCE_ALIAS_MAP: Record<string, string[]> = {
  'purchase-request': ['purchase-requisition'],
  'purchase-requisition': ['purchase-request'],
  // 快财务：菜单码为 sales-invoice / purchase-invoice，API 与权限真源为 kuaicaiwu:invoice:*
  'sales-invoice': ['invoice'],
  'purchase-invoice': ['invoice'],
  // 主数据：「物料管理」菜单码为 material:read，物料分组权限码为 material-group:*，需归并展示
  material: ['material-group'],
  // 批号规则（material-batch-rule）与批号记录 API（material-batch:*）为两套码；合并到批号规则菜单匹配，避免 DB 未同步「批号记录」时出现孤儿
  'material-batch-rule': ['material-batch'],
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
  const c = normalizeFunctionPermissionCode(menuCode);
  if (!c) return [];
  
  const prefixes: string[] = [];
  prefixes.push(...resourcePrefixesForMenuCode(c));
  const parts = c.split(':').filter(Boolean);
  if (parts.length >= 3) {
    const app = parts[0];
    const appVariants = [...new Set([app, app.replace(/_/g, '-'), app.replace(/-/g, '_')])];
    const resource = parts.slice(1, -1).join(':');
    for (const alias of resourceExactAliases(resource)) {
      for (const appv of appVariants) {
        prefixes.push(`${appv}:${alias}:`);
      }
    }
    for (const alias of resourceSuffixAliases(resource)) {
      for (const appv of appVariants) {
        prefixes.push(`${appv}:${alias}:`);
      }
    }
  }
  if (parts.length === 1) {
    prefixes.push(`${parts[0]}:`);
  }

  const seen = new Set<string>();
  const out: Permission[] = [];

  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.code) continue;
    const pNorm = normalizeFunctionPermissionCode(p.code);
    let matched = false;
    if (pNorm === c) {
      matched = true;
    } else {
      for (let j = 0; j < prefixes.length; j++) {
        if (pNorm.startsWith(prefixes[j])) {
          matched = true;
          break;
        }
      }
    }
    if (matched && !seen.has(p.uuid)) {
      seen.add(p.uuid);
      out.push(p);
    }
  }

  const menuAnchor = resourceAnchorFromPermissionCode(c);
  const filtered =
    menuAnchor == null
      ? out
      : out.filter((p) => {
          const pNorm = normalizeFunctionPermissionCode(p.code || '');
          if (pNorm === c) return true;
          const pAnchor = resourceAnchorFromPermissionCode(pNorm);
          if (!pAnchor) return true;
          if (pAnchor === menuAnchor) return true;
          if (pAnchor !== menuAnchor && pAnchor.startsWith(`${menuAnchor}-`)) return false;
          return true;
        });

  filtered.sort((a, b) => a.code.localeCompare(b.code));
  return filtered;
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

const parseCache = new Map<string, { resource: string; action: string } | null>();
function parseResourceAndAction(code: string): { resource: string; action: string } | null {
  if (!code) return null;
  let res = parseCache.get(code);
  if (res !== undefined) return res;
  const parts = (code || '').split(':').filter(Boolean);
  if (parts.length < 3) {
    parseCache.set(code, null);
    return null;
  }
  const computed = {
    resource: parts.slice(0, -1).join(':'),
    action: parts[parts.length - 1].toLowerCase(),
  };
  parseCache.set(code, computed);
  return computed;
}

function buildMenuPermissionTreeData(
  menus: MenuTree[],
  pool: Permission[],
  globallyUsed: Set<string>,
  expandKeys: React.Key[],
  t: (key: string, opts?: { defaultValue?: string }) => string,
  token: { colorPrimary: string },
  mergedPermissionMap: Record<string, string[]>
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
          mergedPermissionMap
        )
      : [];

    const code = m.permission_code?.trim();
    let actionItems: Array<{ key: string; label: string }> = [];
    if (code) {
      let matchPool = permissionsMatchingMenuCode(code, pool);
      // 菜单展示不做全局占用去重，避免前序节点“吃掉”后序分组导致菜单被误判为空。
      // globallyUsed 仅用于未挂载统计。
      const matched = matchPool;
      matched.forEach((p) => globallyUsed.add(p.uuid));
      const parsedMenu = parseResourceAndAction(code);
      const preferredByAction = new Map<string, Permission>();
      matched.forEach((permission) => {
        const parsed = parseResourceAndAction(permission.code || '');
        const actionKey = (parsed?.action || permission.action || permission.code || '').toLowerCase();
        const existing = preferredByAction.get(actionKey);
        if (!existing) {
          preferredByAction.set(actionKey, permission);
          return;
        }
        const existingParsed = parseResourceAndAction(existing.code || '');
        const isCurr = parsedMenu && parsed && parsed.resource === parsedMenu.resource;
        const existingIsCurr =
          parsedMenu && existingParsed && existingParsed.resource === parsedMenu.resource;
        if (isCurr && !existingIsCurr) {
          preferredByAction.set(actionKey, permission);
        }
      });
      const matchedUnique = [...preferredByAction.values()];

      const plainActionItems = matchedUnique.map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        return {
          key: permission.uuid,
          label: actionLabel,
        };
      });

      const reviewGroup = new Map<string, string[]>();
      matchedUnique.forEach((permission) => {
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
      title: menuTreeNodeTitle(m, t),
      _actionItems: actionItems,
      key,
      disableCheckbox: true,
      icon: <AppstoreOutlined />,
      className: actionItems.length > 0 ? 'permission-menu-with-actions' : undefined,
      actionKeys,
      children,
    } as DataNode);
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

const FieldNameInput: React.FC<{
  item: FieldPermissionPolicy;
  onChange: (val: string) => void;
}> = ({ item, onChange }) => {
  const [focused, setFocused] = useState(false);
  const showLabel = !focused && item.field_label;
  
  return (
    <Tooltip title={`英文字段: ${item.field_name || '-'}`}>
      <Input
        style={{ width: 240 }}
        placeholder="英文字段名"
        value={showLabel ? item.field_label : item.field_name}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          // If the user changes it while focused, e.target.value is the english field name.
          // If the user changes it somehow while not focused (unlikely), handle smoothly.
          onChange(e.target.value);
        }}
      />
    </Tooltip>
  );
};

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
  const [functionBatchApp, setFunctionBatchApp] = useState<string>('');
  const [dataPolicies, setDataPolicies] = useState<DataPermissionPolicy[]>([]);
  const [fieldPolicies, setFieldPolicies] = useState<FieldPermissionPolicy[]>([]);
  const [selectedDataResources, setSelectedDataResources] = useState<string[]>([]);
  const [dataBatchScope, setDataBatchScope] = useState<DataPermissionPolicy['scope_type']>('scope_self');
  const [dataBatchApp, setDataBatchApp] = useState<string>('');
  const [selectedFieldIndexes, setSelectedFieldIndexes] = useState<number[]>([]);
  const [fieldBatchMaskLevel, setFieldBatchMaskLevel] = useState<FieldPermissionPolicy['mask_level']>('masked');
  const [fieldKeywordInput, setFieldKeywordInput] = useState('amount,price,customer_name');
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
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [presetRoleList, setPresetRoleList] = useState<PresetRoleItem[]>([]);
  const [selectedPresetRoleCodes, setSelectedPresetRoleCodes] = useState<string[]>([]);
  const [presetConfirmLoading, setPresetConfirmLoading] = useState(false);

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
  const filteredRoles = useMemo(() => {
    return roles
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
  }, [roles, roleSearchKeyword]);

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

      // 后端限制 page_size <= 1000；使用分页聚合拿全量，避免参数越界。
      const pageSize = 1000;
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

    const menusForPool = menuTree;
    const mergedMap: Record<string, string[]> = {};
    const treeData = buildMenuPermissionTreeData(
      menusForPool,
      filteredItems,
      globallyUsed,
      expandKeys,
      t,
      token,
      mergedMap
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

  const permissionUuidSet = useMemo(() => new Set(allPermissions.map((p) => p.uuid)), [allPermissions]);
  const visibleFunctionPermissionUuids = useMemo(() => {
    const uniq = Array.from(new Set(displayedPermissionUuids));
    return uniq.filter((k) => permissionUuidSet.has(k));
  }, [displayedPermissionUuids, permissionUuidSet]);

  const functionBatchAppOptions = useMemo(() => {
    const byApp = new Set<string>();
    allPermissions.forEach((p) => {
      const code = (p.code || '').trim();
      const i = code.indexOf(':');
      if (i > 0) byApp.add(code.slice(0, i));
    });
    return Array.from(byApp)
      .sort((a, b) => a.localeCompare(b))
      .map((app) => ({ value: app, label: getAppDisplayName(app, t, app) }));
  }, [allPermissions, t]);

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
    // 数据权限资源以菜单真源为准，避免历史权限池中的脏资源进入第二页配置。
    return Array.from(resourceLabelMap.keys())
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
  }, [resourceLabelMap, t]);

  const dataBatchAppOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ value: string; label: string }> = [];
    resourceOptions.forEach((item) => {
      const app = item.value.split(':')[0] || '';
      if (!app || seen.has(app)) return;
      seen.add(app);
      opts.push({ value: app, label: getAppDisplayName(app, t, app) });
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  }, [resourceOptions, t]);

  const applyScopeToResources = useCallback(
    (resources: string[], scope: DataPermissionPolicy['scope_type']) => {
      if (resources.length === 0) return 0;
      setDataPolicies((prev) => {
        const map = new Map(prev.map((x) => [x.resource, x]));
        resources.forEach((r) => {
          const row = map.get(r);
          if (row) {
            map.set(r, { ...row, scope_type: scope, scope_payload: scope === 'scope_custom' ? row.scope_payload : undefined });
          } else {
            map.set(r, {
              uuid: `tmp-data-${Date.now()}-${r}`,
              role_uuid: selectedRole?.uuid || '',
              resource: r,
              scope_type: scope,
              scope_payload: undefined,
            });
          }
        });
        return Array.from(map.values()).sort((a, b) => a.resource.localeCompare(b.resource));
      });
      return resources.length;
    },
    [selectedRole?.uuid]
  );

  const applyFieldMaskToIndexes = useCallback((indexes: number[], level: FieldPermissionPolicy['mask_level']) => {
    if (indexes.length === 0) return 0;
    const indexSet = new Set(indexes);
    setFieldPolicies((prev) =>
      prev.map((item, idx) => (indexSet.has(idx) ? { ...item, mask_level: level } : item))
    );
    return indexes.length;
  }, []);

  const applyFieldMaskByKeywords = useCallback(
    (keywords: string[], level: FieldPermissionPolicy['mask_level']) => {
      const norms = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (norms.length === 0) return 0;
      let affected = 0;
      setFieldPolicies((prev) =>
        prev.map((item) => {
          const fieldLower = (item.field_name || '').toLowerCase();
          const labelLower = (item.field_label || '').toLowerCase();
          const hit = norms.some((k) => fieldLower.includes(k) || labelLower.includes(k));
          if (!hit) return item;
          affected += 1;
          return { ...item, mask_level: level };
        })
      );
      return affected;
    },
    []
  );

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
        messageApi.success(`功能权限保存成功：${permissionUuids.length} 项`);
      } else if (permissionLayer === 'data') {
        const payload = dataPolicies
          .filter((x) => x.resource)
          .map((x) => ({
            resource: x.resource,
            scope_type: x.scope_type,
            scope_payload: x.scope_payload,
          }));
        await saveRoleDataPolicies(
          selectedRole.uuid,
          payload
        );
        messageApi.success(`数据权限保存成功：${payload.length} 条`);
      } else {
        const dedupMap = new Map<string, Pick<FieldPermissionPolicy, 'resource' | 'field_name' | 'mask_level'>>();
        fieldPolicies.forEach((x) => {
          const resource = (x.resource || '').trim();
          const fieldName = (x.field_name || '').trim();
          if (!resource || !fieldName) return;
          const key = `${resource}::${fieldName}`;
          dedupMap.set(key, {
            resource,
            field_name: fieldName,
            mask_level: x.mask_level,
          });
        });
        const payload = Array.from(dedupMap.values());
        await saveRoleFieldPolicies(
          selectedRole.uuid,
          payload
        );
        messageApi.success(`字段权限保存成功：${payload.length} 条（已自动去重）`);
      }

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

  const selectAllVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionUuids.length) return;
    setCheckedKeys((prev) => Array.from(new Set([...prev.map(String), ...visibleFunctionPermissionUuids])));
  }, [visibleFunctionPermissionUuids]);

  const clearVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionUuids.length) return;
    const target = new Set(visibleFunctionPermissionUuids);
    setCheckedKeys((prev) => prev.map(String).filter((k) => !target.has(k)));
  }, [visibleFunctionPermissionUuids]);

  const invertVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionUuids.length) return;
    const visible = new Set(visibleFunctionPermissionUuids);
    setCheckedKeys((prev) => {
      const curr = new Set(prev.map(String));
      visible.forEach((u) => {
        if (curr.has(u)) curr.delete(u);
        else curr.add(u);
      });
      return Array.from(curr);
    });
  }, [visibleFunctionPermissionUuids]);

  const selectByFunctionModule = useCallback(() => {
    if (!functionBatchApp) return;
    const uuids = allPermissions
      .filter((p) => (p.code || '').startsWith(`${functionBatchApp}:`))
      .map((p) => p.uuid);
    setCheckedKeys((prev) => Array.from(new Set([...prev.map(String), ...uuids])));
  }, [functionBatchApp, allPermissions]);

  const clearByFunctionModule = useCallback(() => {
    if (!functionBatchApp) return;
    const target = new Set(
      allPermissions.filter((p) => (p.code || '').startsWith(`${functionBatchApp}:`)).map((p) => p.uuid)
    );
    setCheckedKeys((prev) => prev.map(String).filter((k) => !target.has(k)));
  }, [functionBatchApp, allPermissions]);

  return (
    <div
      className="roles-permissions-page"
      style={{
        display: 'flex',
        height: '100%',
        margin: 0,
        padding: '0 16px',
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
                    const list = await getRolePresetPreview();
                    setPresetRoleList(list);
                    setSelectedPresetRoleCodes(list.map((x) => x.code));
                    setPresetModalVisible(true);
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
            borderTopRightRadius: token.borderRadiusLG || token.borderRadius,
          }}
        >
          {/* 第一层：状态、角色身份与全局操作 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '8px 16px',
            borderBottom: `1px solid ${token.colorBorderSecondary || 'rgba(0,0,0,0.06)'}`
          }}>
            <Space size="middle" style={{ flex: 1, minWidth: 0 }}>
              {selectedRole ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <Space size="small">
                      <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRole.name}</span>
                      <Tag color="blue" variant="filled" style={{ margin: 0 }}>{selectedRole.code}</Tag>
                      {selectedRole.is_system && <Tag color="default" variant="filled">{t('pages.system.roles.systemRole')}</Tag>}
                    </Space>
                  </div>
                  <Divider orientation="vertical" style={{ height: 24 }} />
                </>
              ) : (
                <span style={{ color: token.colorTextSecondary, marginRight: 8 }}>{t('pages.system.roles.selectRoleHint')}</span>
              )}

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
            </Space>

            {selectedRole && (
              <Space>
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
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    功能权限用于控制“能看/能操作哪些功能”。支持搜索、全选、全不选、反选及按模块批量授权。
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <Input
                      size="small"
                      placeholder={t('pages.system.roles.searchPermission')}
                      prefix={<SearchOutlined />}
                      value={permissionSearchKeyword}
                      onChange={(e) => setPermissionSearchKeyword(e.target.value)}
                      allowClear
                      style={{ width: 220 }}
                    />
                    <Button size="small" onClick={selectAllVisibleFunctionPermissions}>
                      全选
                    </Button>
                    <Button size="small" onClick={clearVisibleFunctionPermissions}>
                      全不选
                    </Button>
                    <Button size="small" onClick={invertVisibleFunctionPermissions}>
                      反选
                    </Button>
                    <Select
                      size="small"
                      style={{ width: 180 }}
                      value={functionBatchApp || undefined}
                      allowClear
                      placeholder="按模块权限"
                      options={functionBatchAppOptions}
                      onChange={(val) => setFunctionBatchApp(val || '')}
                    />
                    <Button size="small" onClick={selectByFunctionModule}>
                      模块全选
                    </Button>
                    <Button size="small" onClick={clearByFunctionModule}>
                      模块清空
                    </Button>
                  </Flex>
                  <Tree
                    className="permission-tree-horizontal"
                    treeData={permissionTreeData}
                    expandedKeys={permissionTreeExpandedKeys}
                    onExpand={(keys) => setPermissionTreeExpandedKeys(keys as React.Key[])}
                    showIcon
                    titleRender={(node: any) => {
                      if (node._actionItems && node._actionItems.length > 0) {
                        return (
                          <span className="permission-menu-title-wrap">
                            <span style={{ fontWeight: node.children?.length ? 600 : undefined, color: token.colorPrimary }}>
                              {node.title}
                            </span>
                            <div className="permission-action-row">
                              {node._actionItems.map((item: any) => {
                                const mergedChildren = mergedPermissionKeyMapRef.current[item.key] || [];
                                const checked = mergedChildren.length
                                  ? checkedPermissionSet.has(item.key) || mergedChildren.some((u) => checkedPermissionSet.has(u))
                                  : checkedPermissionSet.has(item.key);
                                return (
                                  <label key={item.key} className="permission-action-chip">
                                    <Checkbox checked={checked} onChange={(e) => togglePermissionKey(item.key, e.target.checked)} />
                                    <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </span>
                        );
                      }
                      if (node._actionItems && node._actionItems.length === 0) {
                        return (
                          <span className="permission-menu-title-wrap">
                            <span style={{ fontWeight: node.children?.length ? 600 : undefined, color: token.colorPrimary }}>
                              {node.title}
                            </span>
                          </span>
                        );
                      }
                      return node.title;
                    }}
                  />
                </Space>
              )}
              {permissionLayer === 'data' && (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    数据权限用于控制“看哪些数据”。支持按资源/应用批量设置范围，减少逐条维护。
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <Button size="small" onClick={() => setSelectedDataResources(dataPolicies.map((x) => x.resource))}>
                      全选当前
                    </Button>
                    <Button size="small" onClick={() => setSelectedDataResources([])}>
                      清空选择
                    </Button>
                    <Select
                      size="small"
                      style={{ width: 160 }}
                      value={dataBatchScope}
                      options={[
                        { value: 'scope_all', label: '全部' },
                        { value: 'scope_department', label: '本部门' },
                        { value: 'scope_self', label: '本人' },
                        { value: 'scope_custom', label: '自定义' },
                      ]}
                      onChange={(val) => setDataBatchScope(val as DataPermissionPolicy['scope_type'])}
                    />
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => {
                        const n = applyScopeToResources(selectedDataResources, dataBatchScope);
                        messageApi.info(`已批量更新 ${n} 条数据权限`);
                      }}
                    >
                      批量应用到已选
                    </Button>
                    <Select
                      size="small"
                      style={{ width: 180 }}
                      value={dataBatchApp || undefined}
                      allowClear
                      placeholder="按应用批量"
                      options={dataBatchAppOptions}
                      onChange={(val) => setDataBatchApp(val || '')}
                    />
                    <Button
                      size="small"
                      onClick={() => {
                        if (!dataBatchApp) return;
                        const targets = resourceOptions
                          .map((x) => x.value)
                          .filter((x) => x.startsWith(`${dataBatchApp}:`));
                        const n = applyScopeToResources(targets, dataBatchScope);
                        messageApi.info(`已按应用批量更新 ${n} 条数据权限`);
                      }}
                    >
                      应用到应用全部资源
                    </Button>
                  </Flex>
                  {dataPolicies.map((item, idx) => (
                    <Flex key={`data-${idx}`} gap={8}>
                      <Checkbox
                        checked={selectedDataResources.includes(item.resource)}
                        onChange={(e) =>
                          setSelectedDataResources((prev) =>
                            e.target.checked ? Array.from(new Set([...prev, item.resource])) : prev.filter((x) => x !== item.resource)
                          )
                        }
                      />
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
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    字段权限用于控制“看见什么样子”（明文/脱敏/隐藏）。支持金额与客户名关键词批量处理。
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <Button size="small" onClick={() => setSelectedFieldIndexes(fieldPolicies.map((_, i) => i))}>
                      全选当前
                    </Button>
                    <Button size="small" onClick={() => setSelectedFieldIndexes([])}>
                      清空选择
                    </Button>
                    <Select
                      size="small"
                      style={{ width: 140 }}
                      value={fieldBatchMaskLevel}
                      options={[
                        { value: 'full', label: '明文' },
                        { value: 'masked', label: '脱敏' },
                        { value: 'hidden', label: '隐藏' },
                      ]}
                      onChange={(val) => setFieldBatchMaskLevel(val as FieldPermissionPolicy['mask_level'])}
                    />
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => {
                        const n = applyFieldMaskToIndexes(selectedFieldIndexes, fieldBatchMaskLevel);
                        messageApi.info(`已批量更新 ${n} 条字段权限`);
                      }}
                    >
                      批量应用到已选
                    </Button>
                    <Input
                      size="small"
                      style={{ width: 280 }}
                      value={fieldKeywordInput}
                      onChange={(e) => setFieldKeywordInput(e.target.value)}
                      placeholder="关键词，逗号分隔：amount,price,customer_name"
                    />
                    <Button
                      size="small"
                      onClick={() => {
                        const ks = fieldKeywordInput.split(',');
                        const n = applyFieldMaskByKeywords(ks, fieldBatchMaskLevel);
                        messageApi.info(`关键词匹配并更新 ${n} 条字段权限`);
                      }}
                    >
                      关键词批量应用
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        const n = applyFieldMaskByKeywords(
                          ['amount', 'price', 'unit_price', 'total_amount', 'tax_amount'],
                          'masked'
                        );
                        messageApi.info(`金额模板已应用 ${n} 条`);
                      }}
                    >
                      金额字段模板
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        const n = applyFieldMaskByKeywords(['customer_name', 'customername', 'client_name', 'clientname'], 'masked');
                        messageApi.info(`客户名称模板已应用 ${n} 条`);
                      }}
                    >
                      客户名称模板
                    </Button>
                  </Flex>
                  {fieldPolicies.map((item, idx) => (
                    <Flex key={`field-${idx}`} gap={8}>
                      <Checkbox
                        checked={selectedFieldIndexes.includes(idx)}
                        onChange={(e) =>
                          setSelectedFieldIndexes((prev) =>
                            e.target.checked ? Array.from(new Set([...prev, idx])) : prev.filter((x) => x !== idx)
                          )
                        }
                      />
                      <Select
                        style={{ width: 320 }}
                        value={item.resource}
                        showSearch
                        options={resourceOptions}
                        onChange={(val) =>
                          setFieldPolicies((prev) => prev.map((x, i) => (i === idx ? { ...x, resource: val } : x)))
                        }
                      />
                      <FieldNameInput
                        item={item}
                        onChange={(val) =>
                          setFieldPolicies((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, field_name: val } : x))
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
              fontSize: '12px',
              color: token.colorTextSecondary,
            }}
          >
            <Space separator={<Divider orientation="vertical" />}>
              <span>系统总权限：{allPermissions.length} 项</span>
              <span>当前已授权：<span style={{ color: token.colorPrimary, fontWeight: 500 }}>{checkedKeys.filter(
                (key) => typeof key === 'string' && isAssignablePermissionTreeKey(key)
              ).length}</span> 项</span>
              <span>角色关联用户：<span style={{ color: token.colorSuccess, fontWeight: 500 }}>{selectedRole.user_count || 0}</span> 人</span>
            </Space>
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

      {/* 加载角色预设预览：可勾选后确认 */}
      <Modal
        title={t('field.role.loadPreset')}
        open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)}
        width={1000}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setPresetModalVisible(false)}>
            {t('common.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={presetConfirmLoading}
            disabled={selectedPresetRoleCodes.length === 0}
            onClick={async () => {
              try {
                setPresetConfirmLoading(true);
                const res = await loadPresetRoles(selectedPresetRoleCodes);
                messageApi.success(res.message);
                setPresetModalVisible(false);
                await loadRoles();
              } catch (e: any) {
                messageApi.error(e?.message || t('common.operationFailed'));
              } finally {
                setPresetConfirmLoading(false);
              }
            }}
          >
            {t('common.confirm')}
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: token.colorTextSecondary }}>
          {t('app.master-data.presetModalDesc')}
        </p>
        <Table<PresetRoleItem>
          size="small"
          rowKey="code"
          dataSource={presetRoleList}
          pagination={false}
          scroll={{ x: 920, y: 280 }}
          rowSelection={{
            selectedRowKeys: selectedPresetRoleCodes,
            onChange: (keys) => setSelectedPresetRoleCodes(keys as string[]),
          }}
          columns={[
            { title: t('field.role.name'), dataIndex: 'name', width: 140, ellipsis: true },
            {
              title: t('field.role.code'),
              dataIndex: 'code',
              width: 220,
              ellipsis: { showTitle: true },
            },
            {
              title: t('field.role.description'),
              dataIndex: 'description',
              ellipsis: true,
            },
          ]}
        />
      </Modal>

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
