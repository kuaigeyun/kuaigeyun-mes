/**
 * 角色权限管理合并页面
 * 
 * 左侧：角色树形菜单
 * 右侧：选中角色的权限编辑界面
 * 
 * 整合了角色管理和权限分配功能，提供更直观的管理体验。
 * 布局壳与自定义字段 / 编号规则一致：外层 height 100%，内层 width 100% + border；水平留白仅 UniTabs 16px。
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Badge,
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
  List,
  Typography,
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
  AppstoreOutlined,
  CopyOutlined,
  NodeCollapseOutlined,
  NodeExpandOutlined,
  TeamOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import {
  getRoleList,
  getRoleByUuid,
  deleteRole,
  getRoleFunctionGrants,
  replaceRoleFunctionGrants,
  type RoleFunctionGrants,
  loadPresetRoles,
  getRolePresetPreview,
  type PresetRoleItem,
  cleanupLegacyRoles,
  getRoleDataPolicies,
  saveRoleDataPolicies,
  getRoleFieldPolicies,
  saveRoleFieldPolicies,
  getRoleUsers,
  Role,
  Permission,
  DataPermissionPolicy,
  FieldPermissionPolicy,
  RoleUserListItem,
} from '../../../services/role';
import { refreshCurrentUserInStore } from '../../../services/auth';
import { useGlobalStore } from '../../../stores';
import { RoleFormModal } from '../roles/components/RoleFormModal';
import { UserFormModal } from '../users/components/UserFormModal';
import {
  PERMISSION_TEMPLATES,
  filterPermissionCodesByTemplate,
} from '../../../config/permission-modules';
import { ThemedSegmented } from '../../../components/themed-segmented';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import { useTrialRunMode } from '../../../hooks/useTrialRunMode';
import {
  resolvePresetRoleDescription,
  resolvePresetRoleName,
} from '../../../utils/presetEntityI18n';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import { KUAIZHIZAO_PRICING_VIEW } from '../../../utils/kuaizhizaoPricingPermission';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import './roles-permissions.less';
import {
  FunctionGrantTree,
  collectCodesFromGrantTree,
  collectMenuExpandKeysFromGrantTree,
} from './components/FunctionGrantTree';
import {
  collectGrantPickOptions,
  filterFunctionGrantTreeDeep,
  filterGrantTreeToSubtree,
  type FunctionGrantFilterMode,
} from './components/functionGrantTreeFilters';
import {
  collectDataAppPickOptions,
  collectDataModulePickOptions,
  filterDataResourceOptions,
  type DataPermissionFilterMode,
  type ResourceOption,
} from './components/dataPermissionFilters';
import { filterVisibleFieldPolicyIndexes, upsertFieldPolicyMask } from './components/fieldPermissionFilters';
import {
  buildDataPolicySavePayload,
  defaultCustomPayloadForResource,
} from './components/dataPolicySave';
import {
  collectGrantedResourceKeysFromGrantTree,
  collectGrantedResourceOptionsFromGrantTree,
  isGenericPolicyResourceCode,
  normalizeResourceKey,
} from './components/roleGrantedResourceScope';
import { resolveFieldPermissionLabel } from '../../../utils/fieldPermissionI18n';
import { resolvePermissionLabel } from '../../../utils/permissionContract';

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
  if (code === 'kuaizhizao:customer-pool:assign') {
    return t('permission.kuaizhizao.customerPoolAssign', { defaultValue: '客户池 · 分配客户' });
  }
  if (code === 'kuaizhizao:customer-pool:release') {
    return t('permission.kuaizhizao.customerPoolRelease', { defaultValue: '客户池 · 释放客户' });
  }
  if (code === 'kuaizhizao:customer-pool:recycle') {
    return t('permission.kuaizhizao.customerPoolRecycle', { defaultValue: '客户池 · 强制回收' });
  }
  if (code === 'kuaizhizao:customer-pool:claim') {
    return t('permission.kuaizhizao.customerPoolClaim', { defaultValue: '客户池 · 领取客户' });
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
  return resolvePermissionLabel(code, actionSeg, permission.name, t);
}

const FieldNameInput: React.FC<{
  item: FieldPermissionPolicy;
  displayLabel: string;
  onChange: (val: string) => void;
  t: (key: string, opts?: { defaultValue?: string }) => string;
}> = ({ item, displayLabel, onChange, t }) => {
  const [focused, setFocused] = useState(false);
  const showLabel = !focused && displayLabel;

  return (
    <Tooltip
      title={t('pages.system.roles.enFieldName', {
        name: item.field_name || '-',
        defaultValue: `英文字段: ${item.field_name || '-'}`,
      })}
    >
      <Input
        style={{ width: 240 }}
        placeholder={t('pages.system.roles.enFieldNamePlaceholder', { defaultValue: '英文字段名' })}
        value={showLabel ? displayLabel : item.field_name}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </Tooltip>
  );
};
const normCache = new Map<string, string>();
/** 功能权限 code 比较用规范化（与后端 manifest / 同步一致） */
function normalizeFunctionPermissionCode(code: string): string {
  if (!code) return '';
  let res = normCache.get(code);
  if (res !== undefined) return res;
  res = code.trim().toLowerCase();
  normCache.set(code, res);
  return res;
}

/** 功能权限树操作项；UI 勾选真源为 permissionCode（与后端 code 一致，避免权限同步后 UUID 变化导致无法回显） */
type PermissionActionItem = {
  key: string;
  label: string;
  permissionCode: string;
  mergedCodes?: string[];
};

function permissionCodesFromActionItem(item: PermissionActionItem): string[] {
  if (item.mergedCodes?.length) return item.mergedCodes;
  if (item.permissionCode) return [item.permissionCode];
  return [];
}

function isActionItemChecked(item: PermissionActionItem, selectedCodes: Set<string>): boolean {
  const codes = permissionCodesFromActionItem(item);
  if (codes.length === 0) return false;
  return codes.every((c) => selectedCodes.has(c));
}

function applyActionItemToggle(
  selectedCodes: Set<string>,
  item: PermissionActionItem,
  checked: boolean
): Set<string> {
  const next = new Set(selectedCodes);
  permissionCodesFromActionItem(item).forEach((c) => {
    if (checked) next.add(c);
    else next.delete(c);
  });
  return next;
}

function collectPermissionCodesFromTree(nodes: DataNode[]): string[] {
  const codes: string[] = [];
  const walk = (list: DataNode[]) => {
    for (const node of list) {
      const items = (node as { _actionItems?: PermissionActionItem[] })._actionItems;
      if (items?.length) {
        items.forEach((item) => {
          codes.push(...permissionCodesFromActionItem(item));
        });
      }
      const ch = node.children as DataNode[] | undefined;
      if (ch?.length) walk(ch);
    }
  };
  walk(nodes);
  return [...new Set(codes)];
}

function permissionCodesFromRolePermissions(rolePermissions: Permission[]): string[] {
  const codes = rolePermissions
    .map((p) => normalizeFunctionPermissionCode(p.code || ''))
    .filter(Boolean);
  return [...new Set(codes)];
}

function permissionUuidsFromCodes(codes: Iterable<string>, pool: Permission[]): string[] {
  const byCode = new Map<string, string>();
  pool.forEach((p) => {
    const c = normalizeFunctionPermissionCode(p.code || '');
    if (c) byCode.set(c, p.uuid);
  });
  const uuids: string[] = [];
  for (const code of codes) {
    const uuid = byCode.get(code);
    if (uuid) uuids.push(uuid);
  }
  return [...new Set(uuids)];
}

/** 分组/占位菜单码（非页面级资源，不得用前缀吞并子菜单权限） */
function isGenericMenuPermissionCode(norm: string): boolean {
  return isGenericPolicyResourceCode(norm);
}

function appCodeFromMenu(menu: MenuTree): string | null {
  const code = menu.permission_code?.trim();
  if (!code) return null;
  const parts = normalizeFunctionPermissionCode(code).split(':').filter(Boolean);
  if (parts.length < 3) return null;
  return parts[0];
}

/**
 * 解析菜单对应的功能资源（唯一绑定依据，仅认 permission_code）。
 */
function resolveMenuTargetResource(menu: MenuTree): string | null {
  const code = menu.permission_code?.trim() || '';
  const norm = normalizeFunctionPermissionCode(code);
  const parsed = code ? parseResourceAndAction(code) : null;
  if (!parsed || isGenericMenuPermissionCode(norm)) return null;
  return parsed.resource;
}

/**
 * 菜单节点可勾选权限：仅同一 app + 同一 resource 精确匹配。
 */
function permissionsForMenu(menu: MenuTree, pool: Permission[]): Permission[] {
  const targetResource = resolveMenuTargetResource(menu);
  const app = appCodeFromMenu(menu);
  if (!targetResource || !app) return [];

  const targetResourceKey = normalizeResourceKey(targetResource);

  const seen = new Set<string>();
  const out: Permission[] = [];
  for (const p of pool) {
    if (!p.code) continue;
    const pNorm = normalizeFunctionPermissionCode(p.code);
    const parts = pNorm.split(':').filter(Boolean);
    if (parts.length < 3) continue;
    if (parts[0] !== app) continue;
    const pr = parseResourceAndAction(p.code);
    if (!pr) continue;
    if (normalizeResourceKey(pr.resource) !== targetResourceKey) continue;
    if (seen.has(p.uuid)) continue;
    seen.add(p.uuid);
    out.push(p);
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
    const myPerms = permissionsForMenu(m, pool);
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

const parseCache = new Map<string, { app: string; resource: string; action: string } | null>();
function parseResourceAndAction(code: string): { app: string; resource: string; action: string } | null {
  if (!code) return null;
  let res = parseCache.get(code);
  if (res !== undefined) return res;
  const parts = (code || '').split(':').filter(Boolean);
  if (parts.length < 3) {
    parseCache.set(code, null);
    return null;
  }
  const computed = {
    app: parts[0],
    resource: parts.slice(1, -1).join(':'),
    action: parts[parts.length - 1].toLowerCase(),
  };
  parseCache.set(code, computed);
  return computed;
}

function buildMenuPermissionTreeData(
  menus: MenuTree[],
  pool: Permission[],
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
      ? buildMenuPermissionTreeData(m.children, pool, expandKeys, t, token)
      : [];

    let actionItems: PermissionActionItem[] = [];
    const matched = permissionsForMenu(m, pool);
    if (matched.length > 0) {
      const preferredByAction = new Map<string, Permission>();
      matched.forEach((permission) => {
        const parsed = parseResourceAndAction(permission.code || '');
        const actionKey = (parsed?.action || permission.action || permission.code || '').toLowerCase();
        preferredByAction.set(actionKey, permission);
      });
      const matchedUnique = [...preferredByAction.values()];

      const plainActionItems: PermissionActionItem[] = matchedUnique.map((permission) => {
        const actionLabel = permissionLeafDisplayLabel(permission, t);
        const permCode = normalizeFunctionPermissionCode(permission.code || '');
        return {
          key: `${m.uuid}:${permCode}`,
          label: actionLabel,
          permissionCode: permCode,
        };
      });

      const reviewGroup = new Map<string, string[]>();
      matchedUnique.forEach((permission) => {
        const parsed = parseResourceAndAction(permission.code || '');
        if (!parsed || !REVIEW_ACTIONS.has(parsed.action)) return;
        const permCode = normalizeFunctionPermissionCode(permission.code || '');
        if (!permCode) return;
        if (!reviewGroup.has(parsed.resource)) reviewGroup.set(parsed.resource, []);
        reviewGroup.get(parsed.resource)!.push(permCode);
      });

      const mergedReviewItems: PermissionActionItem[] = [];
      reviewGroup.forEach((codes, resource) => {
        if (codes.length < 2) return;
        const mergedKey = `merged-review:${m.uuid}:${resource}`;
        mergedReviewItems.push({
          key: mergedKey,
          label: t('permission.action.audit', { defaultValue: '审核' }),
          permissionCode: codes[0],
          mergedCodes: codes,
        });
      });

      const covered = new Set(
        mergedReviewItems.flatMap((item) => item.mergedCodes ?? [])
      );
      const remaining = plainActionItems.filter(
        (n) => !n.permissionCode || !covered.has(n.permissionCode)
      );
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

/**
 * 角色权限管理合并页面组件
 */
const RolesPermissionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const trialRunMode = useTrialRunMode();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [roleUsers, setRoleUsers] = useState<RoleUserListItem[]>([]);
  const [roleUsersLoading, setRoleUsersLoading] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userEditUuid, setUserEditUuid] = useState<string | null>(null);
  // 权限相关状态
  /** 功能权限：服务端矩阵（菜单树 + granted_codes） */
  const [functionGrants, setFunctionGrants] = useState<RoleFunctionGrants | null>(null);
  const [grantedCodes, setGrantedCodes] = useState<string[]>([]);
  const [menuTreeLoading, setMenuTreeLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionLayer, setPermissionLayer] = useState<'function' | 'data' | 'field'>('function');
  const [permissionSearchKeyword, setPermissionSearchKeyword] = useState('');
  const [functionFilterMode, setFunctionFilterMode] = useState<FunctionGrantFilterMode>('all');
  const [functionFilterMenuUuid, setFunctionFilterMenuUuid] = useState<string>('');
  const [permissionTreeExpandedKeys, setPermissionTreeExpandedKeys] = useState<React.Key[]>([]);
  const [dataPolicies, setDataPolicies] = useState<DataPermissionPolicy[]>([]);
  const [fieldPolicies, setFieldPolicies] = useState<FieldPermissionPolicy[]>([]);
  const [selectedDataResources, setSelectedDataResources] = useState<string[]>([]);
  const [dataBatchScope, setDataBatchScope] = useState<DataPermissionPolicy['scope_type']>('scope_all');
  const [dataFilterMode, setDataFilterMode] = useState<DataPermissionFilterMode>('all');
  const [dataFilterTarget, setDataFilterTarget] = useState<string>('');
  const [dataSearchKeyword, setDataSearchKeyword] = useState('');
  const [selectedFieldIndexes, setSelectedFieldIndexes] = useState<number[]>([]);
  const [fieldBatchMaskLevel, setFieldBatchMaskLevel] = useState<FieldPermissionPolicy['mask_level']>('full');
  const [fieldFilterMode, setFieldFilterMode] = useState<DataPermissionFilterMode>('all');
  const [fieldFilterTarget, setFieldFilterTarget] = useState<string>('');
  const [fieldSearchKeyword, setFieldSearchKeyword] = useState('');
  const initializedExpandRef = useRef(false);
  const grantedCodeSet = useMemo(() => new Set(grantedCodes), [grantedCodes]);
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

  /** 与侧栏一致的菜单树（数据/字段权限筛选用，按需加载） */
  const [menuTree, setMenuTree] = useState<MenuTree[]>([]);
  const menuTreeLoadPromiseRef = useRef<Promise<void> | null>(null);

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
          setFunctionGrants(null);
          setGrantedCodes([]);
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
        <div className="role-tree-row" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
          <Space size={6} style={{ flex: 1, minWidth: 0 }} className="role-tree-row__label">
            <TeamOutlined
              style={{
                color: token.colorPrimary,
                flexShrink: 0,
              }}
            />
            <span>{resolvePresetRoleName(role, t)}</span>
            {(role.user_count ?? 0) > 0 && (
              <Tooltip title={t('field.department.userCountTag', { count: role.user_count ?? 0 })}>
                <Badge
                  count={role.user_count}
                  size="small"
                  color={token.colorPrimary}
                  style={{ flexShrink: 0 }}
                />
              </Tooltip>
            )}
            {role.role_type === 'external' && role.external_partner_type === 'supplier' && (
              <Tag color="cyan">{t('pages.system.roles.externalSupplier', { defaultValue: '供应商' })}</Tag>
            )}
            {role.role_type === 'external' && role.external_partner_type === 'customer' && (
              <Tag color="geekblue">{t('pages.system.roles.externalCustomer', { defaultValue: '客户' })}</Tag>
            )}
            {role.is_system && <Tag color="default">{t('pages.system.roles.system')}</Tag>}
            {!role.is_active && <Tag color="default">{t('pages.system.roles.disabled')}</Tag>}
          </Space>
          <Space size={4} className="role-tree-row__actions" onClick={(e) => e.stopPropagation()}>
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
  }, [filteredRoles, roleSearchKeyword, handleEditRole, handleDeleteRole, t, token]);

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
   * 数据/字段权限筛选所需菜单树（按需加载，避免首屏多一次全量菜单请求）
   */
  const ensureMenuTreeLoaded = useCallback(async () => {
    if (menuTree.length > 0) return;
    if (!menuTreeLoadPromiseRef.current) {
      menuTreeLoadPromiseRef.current = (async () => {
        try {
          setMenuTreeLoading(true);
          const trees = await getMenuTree({ is_active: true });
          setMenuTree(Array.isArray(trees) ? trees : []);
        } catch {
          setMenuTree([]);
        } finally {
          setMenuTreeLoading(false);
        }
      })();
    }
    await menuTreeLoadPromiseRef.current;
  }, [menuTree.length]);

  /**
   * 按菜单树结构展示权限：菜单标题与侧栏翻译一致，带 permission_code 的节点下挂同资源前缀的操作权限
   */
  const toggleGrantedCodes = useCallback((codes: string[], checked: boolean) => {
    setGrantedCodes((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => {
        if (checked) next.add(c);
        else next.delete(c);
      });
      return Array.from(next);
    });
  }, []);

  const loadFunctionGrantsForRole = useCallback(async (roleUuid: string) => {
    const data = await getRoleFunctionGrants(roleUuid);
    setFunctionGrants(data);
    setGrantedCodes(data.granted_codes || []);
    if (!initializedExpandRef.current && data.tree?.length) {
      setPermissionTreeExpandedKeys(collectMenuExpandKeysFromGrantTree(data.tree, 1));
      initializedExpandRef.current = true;
    }
    return data;
  }, []);

  const functionGrantBaseTree = functionGrants?.tree ?? [];

  const functionGrantPermissionCodes = useMemo(
    () => collectCodesFromGrantTree(functionGrantBaseTree),
    [functionGrantBaseTree],
  );

  const functionFilterPickOptions = useMemo(() => {
    if (functionFilterMode === 'app') {
      return collectGrantPickOptions(functionGrantBaseTree, 0, t);
    }
    if (functionFilterMode === 'module') {
      return collectGrantPickOptions(functionGrantBaseTree, 1, t);
    }
    return [];
  }, [functionGrantBaseTree, functionFilterMode, t]);

  const filteredFunctionGrantTree = useMemo(() => {
    if (functionFilterMode === 'all') {
      return functionGrantBaseTree;
    }
    if (functionFilterMode === 'app' || functionFilterMode === 'module') {
      if (!functionFilterMenuUuid) return [];
      return filterGrantTreeToSubtree(functionGrantBaseTree, functionFilterMenuUuid);
    }
    return filterFunctionGrantTreeDeep(functionGrantBaseTree, permissionSearchKeyword, t);
  }, [
    functionGrantBaseTree,
    functionFilterMode,
    functionFilterMenuUuid,
    permissionSearchKeyword,
    t,
  ]);

  const visibleFunctionPermissionCodes = useMemo(
    () => collectCodesFromGrantTree(filteredFunctionGrantTree),
    [filteredFunctionGrantTree]
  );

  const assignedFunctionPermissionCount = grantedCodes.length;
  const treeVisibleAssignedCount = functionGrants?.stats?.granted_visible_on_tree ?? 0;
  const grantedNotOnTree = functionGrants?.stats?.granted_not_on_tree ?? 0;

  /** 功能权限树已勾选页 → 数据/字段权限可配置资源（唯一前端范围推导） */
  const functionScopedResourceOptions = useMemo(
    () => collectGrantedResourceOptionsFromGrantTree(functionGrantBaseTree, grantedCodes, t),
    [functionGrantBaseTree, grantedCodes, t]
  );

  const grantedDataResourceKeys = useMemo(
    () => collectGrantedResourceKeysFromGrantTree(functionGrantBaseTree, grantedCodes),
    [functionGrantBaseTree, grantedCodes]
  );

  useEffect(() => {
    setSelectedDataResources((prev) =>
      prev.filter((r) => grantedDataResourceKeys.has(normalizeResourceKey(r)))
    );
  }, [grantedDataResourceKeys]);

  const dataFilterPickOptions = useMemo(() => {
    if (dataFilterMode === 'app') {
      return collectDataAppPickOptions(menuTree, t);
    }
    if (dataFilterMode === 'module') {
      return collectDataModulePickOptions(menuTree, t);
    }
    return [];
  }, [menuTree, dataFilterMode, t]);

  const visibleDataResourceOptions = useMemo(
    () =>
      filterDataResourceOptions(
        functionScopedResourceOptions,
        menuTree,
        dataFilterMode,
        dataFilterTarget,
        dataSearchKeyword
      ),
    [
      functionScopedResourceOptions,
      menuTree,
      dataFilterMode,
      dataFilterTarget,
      dataSearchKeyword,
    ]
  );

  const visibleDataResourceKeys = useMemo(
    () => visibleDataResourceOptions.map((o) => o.value),
    [visibleDataResourceOptions]
  );

  const dataPolicyByResource = useMemo(() => {
    const map = new Map<string, DataPermissionPolicy>();
    dataPolicies.forEach((p) => map.set(normalizeResourceKey(p.resource), p));
    return map;
  }, [dataPolicies]);

  const DATA_SCOPE_OPTIONS: Array<{ value: DataPermissionPolicy['scope_type']; label: string }> = [
    { value: 'scope_all', label: t('permission.scope.all', { defaultValue: '全部' }) },
    { value: 'scope_department', label: t('permission.scope.department', { defaultValue: '本部门' }) },
    { value: 'scope_self', label: t('permission.scope.self', { defaultValue: '本人' }) },
    { value: 'scope_custom', label: t('permission.scope.custom', { defaultValue: '自定义' }) },
  ];

  const FIELD_MASK_OPTIONS: Array<{ value: FieldPermissionPolicy['mask_level']; label: string }> = [
    { value: 'full', label: t('permission.field.full', { defaultValue: '明文' }) },
    { value: 'masked', label: t('permission.field.masked', { defaultValue: '脱敏' }) },
    { value: 'hidden', label: t('permission.field.hidden', { defaultValue: '隐藏' }) },
  ];

  const fieldResourceLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    functionScopedResourceOptions.forEach((o) => map.set(normalizeResourceKey(o.value), o.label));
    return map;
  }, [functionScopedResourceOptions]);

  const fieldNameDisplayLabel = useCallback(
    (item: FieldPermissionPolicy) =>
      resolveFieldPermissionLabel(item.field_name, item.field_label, t),
    [t],
  );

  const fieldFilterPickOptions = useMemo(() => {
    if (fieldFilterMode === 'app') {
      return collectDataAppPickOptions(menuTree, t);
    }
    if (fieldFilterMode === 'module') {
      return collectDataModulePickOptions(menuTree, t);
    }
    return [];
  }, [menuTree, fieldFilterMode, t]);

  const visibleFieldPolicyIndexes = useMemo(
    () =>
      filterVisibleFieldPolicyIndexes(
        fieldPolicies,
        grantedDataResourceKeys,
        fieldResourceLabelByKey,
        menuTree,
        fieldFilterMode,
        fieldFilterTarget,
        fieldSearchKeyword,
        fieldNameDisplayLabel
      ),
    [
      fieldPolicies,
      grantedDataResourceKeys,
      fieldResourceLabelByKey,
      menuTree,
      fieldFilterMode,
      fieldFilterTarget,
      fieldSearchKeyword,
      fieldNameDisplayLabel,
    ]
  );

  useEffect(() => {
    const visible = new Set(visibleFieldPolicyIndexes);
    setSelectedFieldIndexes((prev) => prev.filter((i) => visible.has(i)));
  }, [visibleFieldPolicyIndexes]);

  useEffect(() => {
    if (permissionLayer !== 'field' || !selectedRole?.uuid) return;
    void getRoleFieldPolicies(selectedRole.uuid)
      .then(setFieldPolicies)
      .catch(() => {});
  }, [permissionLayer, selectedRole?.uuid, grantedCodes.length]);

  const upsertDataPolicyScope = useCallback(
    (resource: string, scopeType: DataPermissionPolicy['scope_type']) => {
      const nk = normalizeResourceKey(resource);
      setDataPolicies((prev) => {
        const idx = prev.findIndex((p) => normalizeResourceKey(p.resource) === nk);
        if (idx >= 0) {
          return prev.map((p, i) => {
            if (i !== idx) return p;
            return {
              ...p,
              resource: nk,
              scope_type: scopeType,
              scope_payload:
                scopeType === 'scope_custom'
                  ? p.scope_payload ?? defaultCustomPayloadForResource(nk)
                  : undefined,
            };
          });
        }
        return [
          ...prev,
          {
            uuid: `tmp-data-${Date.now()}-${nk}`,
            role_uuid: selectedRole?.uuid || '',
            resource: nk,
            scope_type: scopeType,
            scope_payload:
              scopeType === 'scope_custom' ? defaultCustomPayloadForResource(nk) : undefined,
          },
        ].sort((a, b) => a.resource.localeCompare(b.resource));
      });
    },
    [selectedRole?.uuid]
  );

  const removeDataPolicy = useCallback((resource: string) => {
    const nk = normalizeResourceKey(resource);
    setDataPolicies((prev) => prev.filter((p) => normalizeResourceKey(p.resource) !== nk));
    setSelectedDataResources((prev) => prev.filter((r) => normalizeResourceKey(r) !== nk));
  }, []);

  const applyScopeToResources = useCallback(
    (resources: string[], scope: DataPermissionPolicy['scope_type']) => {
      if (resources.length === 0) return 0;
      setDataPolicies((prev) => {
        const map = new Map(prev.map((x) => [normalizeResourceKey(x.resource), x]));
        resources.forEach((r) => {
          const nk = normalizeResourceKey(r);
          const row = map.get(nk);
          const defaultCustomPayload =
            scope === 'scope_custom' ? defaultCustomPayloadForResource(nk) : undefined;
          if (row) {
            map.set(nk, {
              ...row,
              resource: nk,
              scope_type: scope,
              scope_payload:
                scope === 'scope_custom'
                  ? row.scope_payload ?? defaultCustomPayload
                  : undefined,
            });
          } else {
            map.set(nk, {
              uuid: `tmp-data-${Date.now()}-${nk}`,
              role_uuid: selectedRole?.uuid || '',
              resource: nk,
              scope_type: scope,
              scope_payload: scope === 'scope_custom' ? defaultCustomPayload : undefined,
            });
          }
        });
        return Array.from(map.values()).sort((a, b) => a.resource.localeCompare(b.resource));
      });
      return resources.length;
    },
    [selectedRole?.uuid]
  );

  const applyFieldMaskToIndexes = useCallback(
    (indexes: number[], level: FieldPermissionPolicy['mask_level'], source: FieldPermissionPolicy[]) => {
      if (indexes.length === 0) return 0;
      setFieldPolicies((prev) => {
        let next = prev;
        for (const idx of indexes) {
          const item = source[idx];
          if (item) next = upsertFieldPolicyMask(next, item, level);
        }
        return next;
      });
      return indexes.length;
    },
    []
  );

  const selectAllVisibleFieldPolicies = useCallback(() => {
    setSelectedFieldIndexes(visibleFieldPolicyIndexes);
  }, [visibleFieldPolicyIndexes]);

  const clearVisibleFieldPolicies = useCallback(() => {
    setSelectedFieldIndexes([]);
  }, []);

  const invertVisibleFieldPolicies = useCallback(() => {
    const visible = new Set(visibleFieldPolicyIndexes);
    setSelectedFieldIndexes((prev) => {
      const next = prev.filter((i) => !visible.has(i));
      visible.forEach((i) => {
        if (!prev.includes(i)) next.push(i);
      });
      return next;
    });
  }, [visibleFieldPolicyIndexes]);

  const applyFieldMaskToVisibleSelection = useCallback(() => {
    const visible = new Set(visibleFieldPolicyIndexes);
    const targets = selectedFieldIndexes.filter((i) => visible.has(i));
    if (targets.length === 0) {
      messageApi.warning(
        t('pages.system.roles.selectFieldPolicyFirst', { defaultValue: '请先勾选要批量处理的字段策略' })
      );
      return;
    }
    const n = applyFieldMaskToIndexes(targets, fieldBatchMaskLevel, fieldPolicies);
    messageApi.success(
      t('pages.system.roles.fieldMaskApplied', {
        defaultValue: '已更新 {{count}} 条字段权限',
        count: n,
      })
    );
  }, [
    applyFieldMaskToIndexes,
    fieldPolicies,
    fieldBatchMaskLevel,
    messageApi,
    selectedFieldIndexes,
    t,
    visibleFieldPolicyIndexes,
  ]);

  /**
   * 应用权限模板
   */
  const handleApplyTemplate = useCallback(
    (templateKey: string) => {
      const codes = filterPermissionCodesByTemplate(templateKey, functionGrantPermissionCodes);
      setGrantedCodes(codes);
      const template = PERMISSION_TEMPLATES.find((tmpl) => tmpl.key === templateKey);
      messageApi.success(t('pages.system.roles.templateApplied', { name: template?.name || templateKey, count: codes.length }));
    },
    [functionGrantPermissionCodes, messageApi, t]
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
  useEffect(() => {
    if (functionFilterMode === 'search') {
      const kw = permissionSearchKeyword.trim();
      if (!kw || filteredFunctionGrantTree.length === 0) return;
      setPermissionTreeExpandedKeys(collectMenuExpandKeysFromGrantTree(filteredFunctionGrantTree));
      return;
    }
    if (filteredFunctionGrantTree.length > 0) {
      const depth = functionFilterMode === 'all' ? 1 : Number.POSITIVE_INFINITY;
      setPermissionTreeExpandedKeys(collectMenuExpandKeysFromGrantTree(filteredFunctionGrantTree, depth));
    }
  }, [functionFilterMode, permissionSearchKeyword, filteredFunctionGrantTree]);

  useEffect(() => {
    if (functionFilterMode === 'search' || functionFilterMode === 'all') return;
    if (functionFilterPickOptions.length === 0) {
      setFunctionFilterMenuUuid('');
      return;
    }
    if (!functionFilterPickOptions.some((o) => o.value === functionFilterMenuUuid)) {
      setFunctionFilterMenuUuid(functionFilterPickOptions[0].value);
    }
  }, [functionFilterMode, functionFilterPickOptions, functionFilterMenuUuid]);

  useEffect(() => {
    if (dataFilterMode === 'search' || dataFilterMode === 'all') return;
    if (dataFilterPickOptions.length === 0) {
      setDataFilterTarget('');
      return;
    }
    if (!dataFilterPickOptions.some((o) => o.value === dataFilterTarget)) {
      setDataFilterTarget(dataFilterPickOptions[0].value);
    }
  }, [dataFilterMode, dataFilterPickOptions, dataFilterTarget]);

  useEffect(() => {
    if (fieldFilterMode === 'search' || fieldFilterMode === 'all') return;
    if (fieldFilterPickOptions.length === 0) {
      setFieldFilterTarget('');
      return;
    }
    if (!fieldFilterPickOptions.some((o) => o.value === fieldFilterTarget)) {
      setFieldFilterTarget(fieldFilterPickOptions[0].value);
    }
  }, [fieldFilterMode, fieldFilterPickOptions, fieldFilterTarget]);

  const selectAllVisibleDataResources = useCallback(() => {
    setSelectedDataResources(visibleDataResourceKeys);
  }, [visibleDataResourceKeys]);

  const clearVisibleDataResources = useCallback(() => {
    setSelectedDataResources([]);
  }, []);

  const invertVisibleDataResources = useCallback(() => {
    const visible = new Set(visibleDataResourceKeys);
    setSelectedDataResources((prev) => {
      const next = prev.filter((r) => !visible.has(r));
      visible.forEach((r) => {
        if (!prev.includes(r)) next.push(r);
      });
      return next;
    });
  }, [visibleDataResourceKeys]);

  const applyDataScopeToVisibleSelection = useCallback(
    (scope: DataPermissionPolicy['scope_type']) => {
      const visible = new Set(visibleDataResourceKeys);
      const targets = selectedDataResources.filter((r) => visible.has(r));
      if (targets.length === 0) {
        messageApi.warning(t('pages.system.roles.selectScopeFirst', { defaultValue: '请先选择筛选范围' }));
        return;
      }
      const n = applyScopeToResources(targets, scope);
      messageApi.success(
        t('pages.system.roles.dataScopeApplied', {
          defaultValue: '已对 {{count}} 条资源应用数据范围',
          count: n,
        })
      );
    },
    [applyScopeToResources, messageApi, selectedDataResources, t, visibleDataResourceKeys]
  );

  const loadRoleUsers = useCallback(async (roleUuid: string) => {
    try {
      setRoleUsersLoading(true);
      const res = await getRoleUsers(roleUuid);
      setRoleUsers(res.items || []);
    } catch {
      setRoleUsers([]);
    } finally {
      setRoleUsersLoading(false);
    }
  }, []);

  const handleSelectRole = async (role: Role) => {
    try {
      setSelectedRoleLoading(true);
      setRoleUsers([]);
      setPermissionSearchKeyword('');
      setFunctionFilterMode('all');
      setFunctionFilterMenuUuid('');
      setDataFilterMode('all');
      setDataFilterTarget('');
      setDataSearchKeyword('');
      setSelectedDataResources([]);
      setFieldFilterMode('all');
      setFieldFilterTarget('');
      setFieldSearchKeyword('');
      setSelectedFieldIndexes([]);
      setSelectedRole(role);

      // 并行加载三层权限数据（列表项已含角色基础信息，无需再拉详情）
      initializedExpandRef.current = false;
      const [, roleDataPolicies, roleFieldPolicies] = await Promise.all([
        loadFunctionGrantsForRole(role.uuid),
        getRoleDataPolicies(role.uuid),
        getRoleFieldPolicies(role.uuid),
        loadRoleUsers(role.uuid),
      ]);
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
        const refreshed = await replaceRoleFunctionGrants(selectedRole.uuid, grantedCodes);
        setFunctionGrants(refreshed);
        setGrantedCodes(refreshed.granted_codes || []);
        const roleFieldPolicies = await getRoleFieldPolicies(selectedRole.uuid);
        setFieldPolicies(roleFieldPolicies);
        messageApi.success(t('pages.system.roles.functionGrantSuccess', { count: refreshed.granted_codes?.length ?? 0, defaultValue: `功能权限保存成功：${refreshed.granted_codes?.length ?? 0} 项` }));
      } else if (permissionLayer === 'data') {
        const payload = buildDataPolicySavePayload({
          dataPolicies,
          selectedResources: selectedDataResources,
          visibleResources: visibleDataResourceKeys,
          batchScope: dataBatchScope,
          grantedKeys: grantedDataResourceKeys,
        });
        if (payload.length === 0) {
          messageApi.warning(
            t('pages.system.roles.dataSaveEmpty', {
              defaultValue:
                '请先勾选资源、将批量范围设为「全部/本部门/自定义」后保存，或修改单行范围后再保存',
            })
          );
          return;
        }
        const saved = await saveRoleDataPolicies(selectedRole.uuid, payload);
        setDataPolicies(saved);
        setSelectedDataResources([]);
        messageApi.success(
          t('pages.system.roles.dataGrantSuccess', {
            count: saved.length,
            defaultValue: `数据权限保存成功：${saved.length} 条`,
          })
        );
      } else {
        const dedupMap = new Map<string, Pick<FieldPermissionPolicy, 'resource' | 'field_name' | 'mask_level'>>();
        fieldPolicies.forEach((x) => {
          const resource = (x.resource || '').trim();
          const fieldName = (x.field_name || '').trim();
          if (!resource || !fieldName) return;
          if (!grantedDataResourceKeys.has(normalizeResourceKey(resource))) return;
          if (x.mask_level === 'full') return;
          const key = `${normalizeResourceKey(resource)}::${fieldName}`;
          dedupMap.set(key, {
            resource: normalizeResourceKey(resource),
            field_name: fieldName,
            mask_level: x.mask_level,
          });
        });
        const payload = Array.from(dedupMap.values());
        const savedFieldPolicies = await saveRoleFieldPolicies(
          selectedRole.uuid,
          payload
        );
        setFieldPolicies(savedFieldPolicies);
        messageApi.success(t('pages.system.roles.fieldGrantSuccess', { count: payload.length, defaultValue: `字段权限保存成功：${payload.length} 条（已自动去重）` }));
      }

      // 重新加载角色列表（更新权限数）
      await loadRoles();

      if (permissionLayer === 'function' || permissionLayer === 'field') {
        try {
          await refreshCurrentUserInStore();
        } catch {
          /* 非阻塞：当前账号刷新失败时仍提示用户重新登录 */
        }
      }
      if (permissionLayer === 'function') {
        useGlobalStore.getState().incrementApplicationMenuVersion();
      }
    } catch (error: any) {
      messageApi.error(
        getApiErrorMessage(error, t('pages.system.roles.assignFailed', { defaultValue: '权限保存失败' }))
      );
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
      const sourceGrants = await getRoleFunctionGrants(sourceRoleUuid);
      setGrantedCodes(sourceGrants.granted_codes || []);
      setFunctionGrants((prev) =>
        prev ? { ...prev, granted_codes: sourceGrants.granted_codes } : prev
      );
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

  // 初始化：仅加载角色列表；权限矩阵随选中角色按需拉取
  useEffect(() => {
    loadRoles();
  }, []);

  /**
   * 处理 URL 参数（从账户管理等页面跳转时自动选中角色并打开编辑）
   */
  useEffect(() => {
    const roleUuid = searchParams.get('uuid');
    const action = searchParams.get('action');
    if (!roleUuid || roles.length === 0) return;

    const role = roles.find((item) => item.uuid === roleUuid);
    if (!role) return;

    setSelectedRoleKeys([roleUuid]);
    void handleSelectRole(role);

    if (action === 'edit') {
      setCurrentEditRole(role);
      setRoleModalVisible(true);
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, roles, setSearchParams]);

  useEffect(() => {
    if (permissionLayer === 'data' || permissionLayer === 'field') {
      void ensureMenuTreeLoaded();
    }
  }, [permissionLayer, ensureMenuTreeLoaded]);

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
      const traverseGrant = (nodes: RoleFunctionGrants['tree']) => {
        nodes.forEach((node) => {
          if (node.children?.length) {
            allKeys.push(`menu-${node.menu_uuid}`);
            traverseGrant(node.children);
          }
        });
      };
      if (functionGrants?.tree) traverseGrant(functionGrants.tree);
      setPermissionTreeExpandedKeys(allKeys);
    }
  }, [permissionTreeExpandedKeys, functionGrants]);

  const selectAllVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionCodes.length) return;
    setGrantedCodes((prev) => Array.from(new Set([...prev, ...visibleFunctionPermissionCodes])));
  }, [visibleFunctionPermissionCodes]);

  const clearVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionCodes.length) return;
    const target = new Set(visibleFunctionPermissionCodes);
    setGrantedCodes((prev) => prev.filter((c) => !target.has(c)));
  }, [visibleFunctionPermissionCodes]);

  const invertVisibleFunctionPermissions = useCallback(() => {
    if (!visibleFunctionPermissionCodes.length) return;
    const visible = new Set(visibleFunctionPermissionCodes);
    setGrantedCodes((prev) => {
      const curr = new Set(prev);
      visible.forEach((c) => {
        if (curr.has(c)) curr.delete(c);
        else curr.add(c);
      });
      return Array.from(curr);
    });
  }, [visibleFunctionPermissionCodes]);

  const applyFunctionTemplateToVisible = useCallback(
    (templateKey: string) => {
      if (!visibleFunctionPermissionCodes.length) {
        messageApi.warning(t('pages.system.roles.selectScopeFirst', { defaultValue: '请先选择筛选范围' }));
        return;
      }
      const visible = new Set(visibleFunctionPermissionCodes);
      const templateCodes = new Set(
        filterPermissionCodesByTemplate(templateKey, functionGrantPermissionCodes)
      );
      setGrantedCodes((prev) => {
        const kept = prev.filter((c) => !visible.has(c));
        const next = [...kept];
        visible.forEach((code) => {
          if (templateCodes.has(code)) next.push(code);
        });
        return Array.from(new Set(next));
      });
      const template = PERMISSION_TEMPLATES.find((item) => item.key === templateKey);
      const name =
        templateKey === 'manager'
          ? t('pages.system.roles.templateManager', { defaultValue: '管理者' })
          : template?.name || templateKey;
      messageApi.success(
        t('pages.system.roles.templateAppliedToVisible', {
          defaultValue: '已对当前范围应用「{{name}}」模板',
          name,
        })
      );
    },
    [functionGrantPermissionCodes, messageApi, t, visibleFunctionPermissionCodes]
  );

  return (
    <>
      <div
        className="roles-permissions-page"
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadiusLG || token.borderRadius,
          overflow: 'hidden',
        }}
      >
        {/* 左侧角色列表：固定宽度不参与收缩，由右侧区域伸缩 */}
        <div
          style={{
            width: '300px',
            minWidth: '300px',
            flexShrink: 0,
            borderRight: `1px solid ${token.colorBorder}`,
            backgroundColor: token.colorFillAlter || '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* 左侧栏 Header：首行搜索与中间/右侧首行同高 */}
          <div className="roles-permissions-column-header-row roles-permissions-column-header-row--primary roles-permissions-column-header-row--left">
            <Input
              placeholder={t('pages.system.roles.searchRole')}
              prefix={<SearchOutlined />}
              value={roleSearchKeyword}
              onChange={(e) => setRoleSearchKeyword(e.target.value)}
              allowClear
              size="middle"
              style={{ width: '100%' }}
            />
          </div>
          <div className="roles-permissions-column-header-row roles-permissions-column-header-row--secondary roles-permissions-column-header-row--left">
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <Button type="primary" block onClick={handleCreateRole}>
                  {t('pages.system.roles.createRole')}
                </Button>
                {trialRunMode && (
                <Button
                  type="primary"
                  block
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
                )}
                {trialRunMode && (
                <Tooltip title={t('pages.system.roles.cleanOldRoles', { defaultValue: '清理旧角色' })}>
                  <Button
                    icon={<ClearOutlined />}
                    style={{ width: 32, minWidth: 32, padding: 0, flexShrink: 0 }}
                    loading={cleanupLegacyLoading}
                    onClick={async () => {
                      try {
                        setCleanupLegacyLoading(true);
                        const res = await cleanupLegacyRoles();
                        messageApi.success(
                          t('pages.system.roles.cleanOldRolesResult', {
                            message: res.message,
                            renamed: res.renamed,
                            merged: res.merged,
                            deleted: res.soft_deleted,
                            defaultValue: `${res.message}（重命名${res.renamed}，合并${res.merged}，删除${res.soft_deleted}）`
                          })
                        );
                        await loadRoles();
                      } catch (e: any) {
                        messageApi.error(e?.message || t('common.operationFailed'));
                      } finally {
                        setCleanupLegacyLoading(false);
                      }
                    }}
                  />
                </Tooltip>
                )}
              </div>
          </div>
          {/* 角色列表 */}
          <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px' }}>
            {rolesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px', color: token.colorTextSecondary }}>
                  {t('pages.system.roles.loadingRoles', { defaultValue: '加载角色中...' })}
                </div>
              </div>
            ) : (
              <Tree
                className="roles-permissions-tree"
                treeData={
                  filteredRoleTreeData.length > 0 || !roleSearchKeyword.trim()
                    ? filteredRoleTreeData
                    : roleTreeData
                }
                selectedKeys={selectedRoleKeys}
                expandedKeys={expandedRoleKeys}
                onSelect={handleRoleTreeSelect}
                onExpand={setExpandedRoleKeys}
                blockNode
              />
            )}
          </div>
        </div>

        {/* 右侧配置区域：占据剩余空间，不足时可收缩并滚动 */}
        <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: token.colorBgContainer,
        }}
      >
        {selectedRole ? (
          <>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        {/* 顶部工具栏：首行与左/右栏首行同高 */}
        <div className="roles-permissions-column-header-row roles-permissions-column-header-row--primary roles-permissions-column-header-row--center">
          <div className="roles-permissions-center-toolbar">
            <div className="roles-permissions-center-toolbar__meta">
              <Space size="small" style={{ minWidth: 0 }}>
                <span style={{ fontSize: '16px', fontWeight: 600 }}>
                  {resolvePresetRoleName(selectedRole, t)}
                </span>
                <Tag color="blue" variant="filled" style={{ margin: 0 }}>{selectedRole.code}</Tag>
                {selectedRole.is_system && <Tag color="default" variant="filled">{t('pages.system.roles.systemRole')}</Tag>}
              </Space>
              <Divider orientation="vertical" style={{ height: 24, margin: '0 8px' }} />
              <Space size="small">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    loadRoles();
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
            </div>
            <div className="roles-permissions-center-toolbar__actions">
                {permissionLayer === 'function' && (
                  <Select
                    placeholder={t('pages.system.roles.applyTemplate')}
                    style={{ width: 160 }}
                    allowClear
                    onSelect={(key) => handleApplyTemplate(String(key))}
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
            </div>
          </div>
        </div>

          <div className="roles-permissions-column-header-row roles-permissions-column-header-row--secondary roles-permissions-column-header-row--center">
            <Tabs
              activeKey={permissionLayer}
              onChange={(key) => setPermissionLayer(key as 'function' | 'data' | 'field')}
              items={[
                { key: 'function', label: t('pages.system.roles.functionPermission', { defaultValue: '功能权限' }) },
                { key: 'data', label: t('pages.system.roles.dataPermission', { defaultValue: '数据权限' }) },
                { key: 'field', label: t('pages.system.roles.fieldPermission', { defaultValue: '字段权限' }) },
              ]}
            />
          </div>

        {/* 权限编辑区域：功能权限占满可滚动；数据/字段随内容高度，避免列表下方大块空白 */}
        <div
          className="scrollbar-like-modal"
          style={
            permissionLayer === 'function'
              ? { flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }
              : {
                  flex: '0 1 auto',
                  alignSelf: 'stretch',
                  maxHeight: '100%',
                  minHeight: 0,
                  overflow: 'auto',
                  padding: '24px',
                }
          }
        >
            <Spin spinning={selectedRoleLoading || (permissionLayer !== 'function' && menuTreeLoading)}>
              {permissionLayer === 'function' && (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    {t('pages.system.roles.functionGrantHint', {
                      defaultValue:
                        '功能权限控制可访问的菜单与操作。可选全部、按 APP（一级）、模块（二级）或搜索（三级及以上）筛选；快捷操作仅作用于当前可见范围。',
                    })}
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <ThemedSegmented
                      surfaceBackground
                      size="middle"
                      value={functionFilterMode}
                      options={[
                        {
                          label: t('pages.system.roles.filterAll', { defaultValue: '全部' }),
                          value: 'all',
                        },
                        {
                          label: t('pages.system.roles.filterByApp', { defaultValue: '按 APP' }),
                          value: 'app',
                        },
                        {
                          label: t('pages.system.roles.filterByModule', { defaultValue: '按模块' }),
                          value: 'module',
                        },
                        {
                          label: t('pages.system.roles.filterBySearch', { defaultValue: '按搜索' }),
                          value: 'search',
                        },
                      ]}
                      onChange={(value) => {
                        setFunctionFilterMode(value as FunctionGrantFilterMode);
                        setFunctionFilterMenuUuid('');
                        if (value !== 'search') setPermissionSearchKeyword('');
                      }}
                    />
                    {functionFilterMode === 'app' || functionFilterMode === 'module' ? (
                      <Select
                        style={{ width: 168, flex: '0 0 auto' }}
                        value={functionFilterMenuUuid || undefined}
                        showSearch
                        optionFilterProp="label"
                        placeholder={
                          functionFilterMode === 'app'
                            ? t('pages.system.roles.pickAppPlaceholder', { defaultValue: '选择应用（一级）' })
                            : t('pages.system.roles.pickModulePlaceholder', { defaultValue: '选择模块（二级）' })
                        }
                        options={functionFilterPickOptions}
                        onChange={(val) => setFunctionFilterMenuUuid(val)}
                      />
                    ) : functionFilterMode === 'search' ? (
                      <Input
                        placeholder={t('pages.system.roles.searchPermission')}
                        prefix={<SearchOutlined />}
                        value={permissionSearchKeyword}
                        onChange={(e) => setPermissionSearchKeyword(e.target.value)}
                        allowClear
                        style={{ width: 168, flex: '0 0 auto' }}
                      />
                    ) : null}
                    <Divider type="vertical" style={{ margin: 0, height: 32 }} />
                    <Button type="primary" onClick={selectAllVisibleFunctionPermissions}>
                      {t('pages.system.roles.selectAllVisible', { defaultValue: '全选' })}
                    </Button>
                    <Button onClick={clearVisibleFunctionPermissions}>
                      {t('pages.system.roles.clearAllVisible', { defaultValue: '全不选' })}
                    </Button>
                    <Button onClick={invertVisibleFunctionPermissions}>
                      {t('pages.system.roles.invertVisible', { defaultValue: '反选' })}
                    </Button>
                    <Button variant="outlined" onClick={() => applyFunctionTemplateToVisible('viewer')}>
                      {t('pages.system.roles.templateViewer', { defaultValue: '查看者' })}
                    </Button>
                    <Button variant="outlined" onClick={() => applyFunctionTemplateToVisible('editor')}>
                      {t('pages.system.roles.templateEditor', { defaultValue: '编辑者' })}
                    </Button>
                    <Button
                      color="primary"
                      variant="outlined"
                      onClick={() => applyFunctionTemplateToVisible('manager')}
                    >
                      {t('pages.system.roles.templateManager', { defaultValue: '管理者' })}
                    </Button>
                  </Flex>
                  {functionGrants?.tree?.length ? (
                    filteredFunctionGrantTree.length > 0 ? (
                      <FunctionGrantTree
                        tree={filteredFunctionGrantTree}
                        grantedCodes={grantedCodeSet}
                        expandedKeys={permissionTreeExpandedKeys}
                        onExpand={(keys) => setPermissionTreeExpandedKeys(keys)}
                        onToggle={toggleGrantedCodes}
                        t={t}
                      />
                    ) : (
                      <Empty
                        description={
                          functionFilterMode === 'search' && !permissionSearchKeyword.trim()
                            ? t('pages.system.roles.searchPermissionNeedKeyword', {
                                defaultValue: '请输入关键词搜索三级菜单及操作权限',
                              })
                            : t('pages.system.roles.searchPermissionEmpty', {
                                defaultValue: '未找到匹配的权限，请尝试其他关键词',
                              })
                        }
                      />
                    )
                  ) : (
                    <Empty description={t('pages.system.roles.noFunctionTree')} />
                  )}
                </Space>
              )}
              {permissionLayer === 'data' && (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    {t('pages.system.roles.dataGrantHint', {
                      defaultValue:
                        '仅展示已在「功能权限」中勾选的业务资源。批量范围选「全部/本部门/自定义」后点保存，会对当前列表内资源生效（勾选时仅作用于已选）；也可勾选后点「应用到已选」预览再保存。',
                    })}
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <ThemedSegmented
                      surfaceBackground
                      size="middle"
                      value={dataFilterMode}
                      options={[
                        {
                          label: t('pages.system.roles.filterAll', { defaultValue: '全部' }),
                          value: 'all',
                        },
                        {
                          label: t('pages.system.roles.filterByApp', { defaultValue: '按 APP' }),
                          value: 'app',
                        },
                        {
                          label: t('pages.system.roles.filterByModule', { defaultValue: '按模块' }),
                          value: 'module',
                        },
                        {
                          label: t('pages.system.roles.filterBySearch', { defaultValue: '按搜索' }),
                          value: 'search',
                        },
                      ]}
                      onChange={(value) => {
                        setDataFilterMode(value as DataPermissionFilterMode);
                        setDataFilterTarget('');
                        if (value !== 'search') setDataSearchKeyword('');
                      }}
                    />
                    {dataFilterMode === 'app' || dataFilterMode === 'module' ? (
                      <Select
                        style={{ width: 168, flex: '0 0 auto' }}
                        value={dataFilterTarget || undefined}
                        showSearch
                        optionFilterProp="label"
                        placeholder={
                          dataFilterMode === 'app'
                            ? t('pages.system.roles.pickAppPlaceholder', { defaultValue: '选择应用（一级）' })
                            : t('pages.system.roles.pickModulePlaceholder', { defaultValue: '选择模块（二级）' })
                        }
                        options={dataFilterPickOptions}
                        onChange={(val) => setDataFilterTarget(val)}
                      />
                    ) : dataFilterMode === 'search' ? (
                      <Input
                        placeholder={t('pages.system.roles.searchDataResource', {
                          defaultValue: '搜索资源名称或编码',
                        })}
                        prefix={<SearchOutlined />}
                        value={dataSearchKeyword}
                        onChange={(e) => setDataSearchKeyword(e.target.value)}
                        allowClear
                        style={{ width: 168, flex: '0 0 auto' }}
                      />
                    ) : null}
                    <Divider type="vertical" style={{ margin: 0, height: 32 }} />
                    <Button type="primary" onClick={selectAllVisibleDataResources}>
                      {t('pages.system.roles.selectAllVisible', { defaultValue: '全选' })}
                    </Button>
                    <Button onClick={clearVisibleDataResources}>
                      {t('pages.system.roles.clearAllVisible', { defaultValue: '全不选' })}
                    </Button>
                    <Button onClick={invertVisibleDataResources}>
                      {t('pages.system.roles.invertVisible', { defaultValue: '反选' })}
                    </Button>
                    <Select
                      style={{ width: 120, flex: '0 0 auto' }}
                      value={dataBatchScope}
                      options={DATA_SCOPE_OPTIONS}
                      onChange={(val) => setDataBatchScope(val as DataPermissionPolicy['scope_type'])}
                    />
                    <Button type="primary" onClick={() => applyDataScopeToVisibleSelection(dataBatchScope)}>
                      {t('pages.system.roles.applyScopeToSelected', { defaultValue: '应用到已选' })}
                    </Button>
                  </Flex>
                  {visibleDataResourceOptions.length > 0 ? (
                      <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                        {visibleDataResourceOptions.map((opt) => {
                          const policy = dataPolicyByResource.get(normalizeResourceKey(opt.value));
                          const scopeType = policy?.scope_type ?? 'scope_all';
                          const configured = Boolean(policy);
                          return (
                            <Flex key={opt.value} gap={8} align="center" style={{ width: '100%' }}>
                              <Checkbox
                                checked={selectedDataResources.includes(opt.value)}
                                onChange={(e) =>
                                  setSelectedDataResources((prev) =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, opt.value]))
                                      : prev.filter((x) => x !== opt.value)
                                  )
                                }
                              />
                              <span
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  color: configured ? token.colorText : token.colorTextSecondary,
                                }}
                              >
                                {opt.label}
                                {!configured && (
                                  <span style={{ marginLeft: 6, fontSize: 12, color: token.colorTextQuaternary }}>
                                    ({t('pages.system.roles.dataNotConfigured', { defaultValue: '默认：全部' })})
                                  </span>
                                )}
                              </span>
                              <Select
                                style={{ width: 140, flexShrink: 0 }}
                                value={scopeType}
                                options={DATA_SCOPE_OPTIONS}
                                onChange={(val) =>
                                  upsertDataPolicyScope(opt.value, val as DataPermissionPolicy['scope_type'])
                                }
                              />
                              {configured && (
                                <Button danger type="text" onClick={() => removeDataPolicy(opt.value)}>
                                  {t('common.delete', { defaultValue: '删除' })}
                                </Button>
                              )}
                            </Flex>
                          );
                        })}
                      </Space>
                  ) : (
                    <Empty
                      description={
                        grantedDataResourceKeys.size === 0
                          ? t('pages.system.roles.dataGrantNeedFunction', {
                              defaultValue: '请先在「功能权限」中勾选至少一项，再配置数据范围',
                            })
                          : dataFilterMode === 'search' && !dataSearchKeyword.trim()
                            ? t('pages.system.roles.searchDataNeedKeyword', {
                                defaultValue: '请输入关键词搜索数据资源',
                              })
                            : t('pages.system.roles.searchDataEmpty', {
                                defaultValue: '当前筛选下无匹配的数据资源',
                              })
                      }
                    />
                  )}
                </Space>
              )}
              {permissionLayer === 'field' && (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                    {t('pages.system.roles.fieldGrantHint', {
                      defaultValue:
                        '仅展示「功能权限」已授权、且业务单据确有金额/客户等敏感字段的资源（如销售订单、报价单）；消息、偏好设置等页面不会出现。可用全部、按 APP、按模块或搜索筛选；勾选后批量设置显示方式并保存。',
                    })}
                  </div>
                  <Flex gap={8} wrap="wrap" align="center">
                    <ThemedSegmented
                      surfaceBackground
                      size="middle"
                      value={fieldFilterMode}
                      options={[
                        {
                          label: t('pages.system.roles.filterAll', { defaultValue: '全部' }),
                          value: 'all',
                        },
                        {
                          label: t('pages.system.roles.filterByApp', { defaultValue: '按 APP' }),
                          value: 'app',
                        },
                        {
                          label: t('pages.system.roles.filterByModule', { defaultValue: '按模块' }),
                          value: 'module',
                        },
                        {
                          label: t('pages.system.roles.filterBySearch', { defaultValue: '按搜索' }),
                          value: 'search',
                        },
                      ]}
                      onChange={(value) => {
                        setFieldFilterMode(value as DataPermissionFilterMode);
                        setFieldFilterTarget('');
                        if (value !== 'search') setFieldSearchKeyword('');
                      }}
                    />
                    {fieldFilterMode === 'app' || fieldFilterMode === 'module' ? (
                      <Select
                        style={{ width: 168, flex: '0 0 auto' }}
                        value={fieldFilterTarget || undefined}
                        showSearch
                        optionFilterProp="label"
                        placeholder={
                          fieldFilterMode === 'app'
                            ? t('pages.system.roles.pickAppPlaceholder', { defaultValue: '选择应用（一级）' })
                            : t('pages.system.roles.pickModulePlaceholder', { defaultValue: '选择模块（二级）' })
                        }
                        options={fieldFilterPickOptions}
                        onChange={(val) => setFieldFilterTarget(val)}
                      />
                    ) : fieldFilterMode === 'search' ? (
                      <Input
                        placeholder={t('pages.system.roles.searchFieldPolicy', {
                          defaultValue: '搜索资源或字段名',
                        })}
                        prefix={<SearchOutlined />}
                        value={fieldSearchKeyword}
                        onChange={(e) => setFieldSearchKeyword(e.target.value)}
                        allowClear
                        style={{ width: 168, flex: '0 0 auto' }}
                      />
                    ) : null}
                    <Divider type="vertical" style={{ margin: 0, height: 32 }} />
                    <Button type="primary" onClick={selectAllVisibleFieldPolicies}>
                      {t('pages.system.roles.selectAllVisible', { defaultValue: '全选' })}
                    </Button>
                    <Button onClick={clearVisibleFieldPolicies}>
                      {t('pages.system.roles.clearAllVisible', { defaultValue: '全不选' })}
                    </Button>
                    <Button onClick={invertVisibleFieldPolicies}>
                      {t('pages.system.roles.invertVisible', { defaultValue: '反选' })}
                    </Button>
                    <Select
                      style={{ width: 120, flex: '0 0 auto' }}
                      value={fieldBatchMaskLevel}
                      options={FIELD_MASK_OPTIONS}
                      onChange={(val) => setFieldBatchMaskLevel(val as FieldPermissionPolicy['mask_level'])}
                    />
                    <Button type="primary" onClick={applyFieldMaskToVisibleSelection}>
                      {t('pages.system.roles.applyFieldMaskToSelected', { defaultValue: '应用到已选' })}
                    </Button>
                  </Flex>
                  {visibleFieldPolicyIndexes.length > 0 ? (
                    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                      {visibleFieldPolicyIndexes.map((idx) => {
                        const item = fieldPolicies[idx];
                        if (!item) return null;
                        const rowKey = `${normalizeResourceKey(item.resource)}::${item.field_name}`;
                        return (
                          <Flex key={`field-${rowKey}`} gap={8} align="center" style={{ width: '100%' }}>
                            <Checkbox
                              checked={selectedFieldIndexes.includes(idx)}
                              onChange={(e) =>
                                setSelectedFieldIndexes((prev) =>
                                  e.target.checked
                                    ? Array.from(new Set([...prev, idx]))
                                    : prev.filter((x) => x !== idx)
                                )
                              }
                            />
                            <Select
                              style={{ width: 280, flexShrink: 0 }}
                              value={item.resource}
                              showSearch
                              optionFilterProp="label"
                              options={functionScopedResourceOptions}
                              onChange={(val) =>
                                setFieldPolicies((prev) =>
                                  upsertFieldPolicyMask(prev, { ...item, resource: val }, item.mask_level)
                                )
                              }
                            />
                            <FieldNameInput
                              item={item}
                              displayLabel={fieldNameDisplayLabel(item)}
                              t={t}
                              onChange={(val) =>
                                setFieldPolicies((prev) =>
                                  upsertFieldPolicyMask(prev, { ...item, field_name: val }, item.mask_level)
                                )
                              }
                            />
                            <Select
                              style={{ width: 120, flexShrink: 0 }}
                              value={item.mask_level}
                              options={FIELD_MASK_OPTIONS}
                              onChange={(val) =>
                                setFieldPolicies((prev) =>
                                  upsertFieldPolicyMask(
                                    prev,
                                    item,
                                    val as FieldPermissionPolicy['mask_level']
                                  )
                                )
                              }
                            />
                            <Button
                              danger
                              type="text"
                              onClick={() =>
                                setFieldPolicies((prev) =>
                                  prev.filter(
                                    (p) =>
                                      `${normalizeResourceKey(p.resource)}::${p.field_name}` !== rowKey
                                  )
                                )
                              }
                            >
                              {t('common.delete', { defaultValue: '删除' })}
                            </Button>
                          </Flex>
                        );
                      })}
                    </Space>
                  ) : (
                    <Empty
                      description={
                        grantedDataResourceKeys.size === 0
                          ? t('pages.system.roles.fieldGrantNeedFunction', {
                              defaultValue: '请先在「功能权限」中勾选至少一项，再配置字段显示方式',
                            })
                          : fieldFilterMode === 'search' && !fieldSearchKeyword.trim()
                            ? t('pages.system.roles.searchFieldNeedKeyword', {
                                defaultValue: '请输入关键词搜索资源或字段名',
                              })
                            : t('pages.system.roles.searchFieldEmpty', {
                                defaultValue: '当前筛选下无匹配的字段策略',
                              })
                      }
                    />
                  )}
                  <Button
                    disabled={functionScopedResourceOptions.length === 0}
                    onClick={() =>
                      setFieldPolicies((prev) => [
                        ...prev,
                        {
                          uuid: `tmp-field-${Date.now()}`,
                          role_uuid: selectedRole.uuid,
                          resource: functionScopedResourceOptions[0]?.value || '',
                          field_name: '',
                          mask_level: 'full',
                        },
                      ])
                    }
                  >
                    {t('pages.system.roles.addFieldPolicy', { defaultValue: '新增字段权限策略' })}
                  </Button>
                </Space>
              )}
            </Spin>
        </div>

          <div
            style={{
              borderTop: `1px solid ${token.colorBorder}`,
              padding: '8px 24px',
              display: 'flex',
              fontSize: '12px',
              color: token.colorTextSecondary,
            }}
          >
            <Space separator={<Divider orientation="vertical" />}>
              <span>
                {t('pages.system.roles.systemFunctionPermissions')}
                {functionGrants?.stats?.total_function_codes ?? functionGrantPermissionCodes.length}
                {t('pages.system.roles.statsItemUnit')}
              </span>
              <span>
                {t('pages.system.roles.currentAssigned')}
                <span style={{ color: token.colorPrimary, fontWeight: 500 }}>{assignedFunctionPermissionCount}</span>
                {t('pages.system.roles.statsItemUnit')}
                {permissionLayer === 'function' && grantedNotOnTree > 0 && (
                  <span style={{ color: token.colorTextSecondary, marginLeft: 4 }}>
                    {t('pages.system.roles.assignedDetail', {
                      visible: treeVisibleAssignedCount,
                      unmounted: grantedNotOnTree,
                    })}
                  </span>
                )}
              </span>
              <span>
                {t('pages.system.roles.roleUsers')}
                <span style={{ color: token.colorSuccess, fontWeight: 500 }}>{selectedRole.user_count || 0}</span>
                {t('pages.system.roles.statsUserUnit')}
              </span>
            </Space>
          </div>
        </div>

        <div
          className="roles-permissions-users-panel"
          style={{
            width: 280,
            minWidth: 280,
            flexShrink: 0,
            borderLeft: `1px solid ${token.colorBorder}`,
            backgroundColor: token.colorBgContainer,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div className="roles-permissions-column-header-row roles-permissions-column-header-row--primary roles-permissions-column-header-row--right">
            <Space size={6}>
              <TeamOutlined />
              <span style={{ fontWeight: 600 }}>
                {t('pages.system.roles.roleUsersPanelTitle', { defaultValue: '关联用户' })}
              </span>
              <Tag color="blue">{roleUsers.length}</Tag>
            </Space>
          </div>
          <div className="roles-permissions-users-panel-body">
            <div className="scrollbar-like-modal roles-permissions-users-list-body">
            <Spin spinning={roleUsersLoading}>
              {roleUsers.length > 0 ? (
                <List
                  size="small"
                  dataSource={roleUsers}
                  renderItem={(user) => {
                    const displayName = (user.full_name || '').trim() || user.username;
                    return (
                      <List.Item
                        style={{ paddingInline: 16, cursor: 'pointer' }}
                        onClick={() => {
                          setUserEditUuid(user.uuid);
                          setUserFormOpen(true);
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Space size={6} wrap>
                              <Typography.Text ellipsis style={{ maxWidth: 160 }}>
                                {displayName}
                              </Typography.Text>
                              {!user.is_active ? (
                                <Tag color="default">{t('common.disabled', { defaultValue: '禁用' })}</Tag>
                              ) : null}
                            </Space>
                          }
                          description={
                            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                              {user.department_name
                                ? `${user.department_name} · ${user.username}`
                                : user.username}
                            </Typography.Text>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('pages.system.roles.roleUsersEmpty', { defaultValue: '暂无用户拥有此角色' })}
                  style={{ margin: '32px 0' }}
                />
              )}
            </Spin>
          </div>
          </div>
        </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: token.colorTextSecondary,
              backgroundColor: token.colorFillAlter,
            }}
          >
            {t('pages.system.roles.selectRoleToEdit')}
          </div>
        )}
        </div>
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

      <UserFormModal
        open={userFormOpen}
        editUuid={userEditUuid}
        onClose={() => {
          setUserFormOpen(false);
          setUserEditUuid(null);
        }}
        onSuccess={() => {
          if (selectedRole?.uuid) {
            void loadRoleUsers(selectedRole.uuid);
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
            {
              title: t('field.role.name'),
              dataIndex: 'name',
              width: 140,
              ellipsis: true,
              render: (_: unknown, row: PresetRoleItem) => resolvePresetRoleName(row, t),
            },
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
              render: (_: unknown, row: PresetRoleItem) => resolvePresetRoleDescription(row, t),
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
    </>
  );
};

export default RolesPermissionsPage;
