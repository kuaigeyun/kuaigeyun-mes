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
  updateRole,
  deleteRole,
  getRoleFunctionGrants,
  replaceRoleFunctionGrants,
  getAllPermissions,
  type RoleFunctionGrants,
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
import { refreshCurrentUserInStore } from '../../../services/auth';
import { useGlobalStore } from '../../../stores';
import { RoleFormModal } from '../roles/components/RoleFormModal';
import { PERMISSION_TEMPLATES, getPermissionUuidsByTemplate } from '../../../config/permission-modules';
import { getMenuTree, EFFECTIVE_HOME_QUERY_KEY, type MenuTree } from '../../../services/menu';
import { flattenMenuHomePathOptions } from '../../../utils/menuHomePathOptions';
import { useQueryClient } from '@tanstack/react-query';
import { useTrialRunMode } from '../../../hooks/useTrialRunMode';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import { KUAIZHIZAO_PRICING_VIEW } from '../../../utils/kuaizhizaoPricingPermission';
import './roles-permissions.less';
import {
  FunctionGrantTree,
  collectCodesFromGrantTree,
} from './components/FunctionGrantTree';

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
    complete: '完修',
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

function normalizeResourceKey(resource: string): string {
  return resource.trim().toLowerCase();
}

/** 分组/占位菜单码（非页面级资源，不得用前缀吞并子菜单权限） */
function isGenericMenuPermissionCode(norm: string): boolean {
  if (!norm) return true;
  const parts = norm.split(':').filter(Boolean);
  if (parts.length >= 3 && parts[parts.length - 1] === 'read') {
    const resource = parts.slice(1, -1).join(':');
    if (resource === 'workspace' || resource === parts[0]) return true;
  }
  return false;
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
          label: '审核',
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
  const trialRunMode = useTrialRunMode();

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
  const [roleHomePathDraft, setRoleHomePathDraft] = useState<string | undefined>();
  const [savingRoleHome, setSavingRoleHome] = useState(false);
  const queryClient = useQueryClient();

  // 权限相关状态
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  /** 功能权限：服务端矩阵（菜单树 + granted_codes） */
  const [functionGrants, setFunctionGrants] = useState<RoleFunctionGrants | null>(null);
  const [grantedCodes, setGrantedCodes] = useState<string[]>([]);
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
            <span>{role.name}</span>
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
      const keys: React.Key[] = [];
      const walk = (nodes: RoleFunctionGrants['tree']) => {
        nodes.forEach((n) => {
          keys.push(`menu-${n.menu_uuid}`);
          if (n.children?.length) walk(n.children);
        });
      };
      walk(data.tree);
      setPermissionTreeExpandedKeys(keys);
      initializedExpandRef.current = true;
    }
    return data;
  }, []);

  const visibleFunctionPermissionCodes = useMemo(
    () => collectCodesFromGrantTree(functionGrants?.tree ?? []),
    [functionGrants]
  );

  const assignedFunctionPermissionCount = grantedCodes.length;
  const treeVisibleAssignedCount = functionGrants?.stats?.granted_visible_on_tree ?? 0;
  const grantedNotOnTree = functionGrants?.stats?.granted_not_on_tree ?? 0;

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
    // 数据权限资源以菜单真源为准，避免非菜单资源进入第二页配置。
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
          const defaultCustomPayload =
            scope === 'scope_custom' && /outsource-maintenance|outsource-complete/.test(r)
              ? { resolver: 'outsourced_unit' }
              : scope === 'scope_custom' && /molds-documents-trial|molds-reports-trial-record/.test(r)
                ? { resolver: 'partner', dimension: 'supplier', code_field: 'supplier_code' }
                : undefined;
          if (row) {
            map.set(r, {
              ...row,
              scope_type: scope,
              scope_payload:
                scope === 'scope_custom'
                  ? row.scope_payload ?? defaultCustomPayload
                  : undefined,
            });
          } else {
            map.set(r, {
              uuid: `tmp-data-${Date.now()}-${r}`,
              role_uuid: selectedRole?.uuid || '',
              resource: r,
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
      const codes = uuids
        .map((uuid) => {
          const p = allPermissions.find((x) => x.uuid === uuid);
          return p ? normalizeFunctionPermissionCode(p.code || '') : '';
        })
        .filter(Boolean);
      setGrantedCodes(codes);
      const template = PERMISSION_TEMPLATES.find((tmpl) => tmpl.key === templateKey);
      messageApi.success(t('pages.system.roles.templateApplied', { name: template?.name || templateKey, count: codes.length }));
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
  const homePathOptions = useMemo(
    () =>
      flattenMenuHomePathOptions(menuTree, (menuName, path) => {
        const label = translateMenuName(menuName, t, path);
        return `${label} (${path})`;
      }),
    [menuTree, t],
  );

  const handleSaveRoleHomePath = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    try {
      setSavingRoleHome(true);
      const home_path = roleHomePathDraft?.trim() || null;
      const updated = await updateRole(selectedRole.uuid, { home_path });
      setSelectedRole(updated);
      setRoles((prev) => prev.map((r) => (r.uuid === updated.uuid ? { ...r, ...updated } : r)));
      void queryClient.invalidateQueries({ queryKey: EFFECTIVE_HOME_QUERY_KEY });
      messageApi.success(t('pages.system.roles.roleHomeSaved', { defaultValue: '角色首页已保存' }));
    } catch (error: any) {
      messageApi.error(error?.message || t('common.saveFailed'));
    } finally {
      setSavingRoleHome(false);
    }
  };

  const handleSelectRole = async (role: Role) => {
    try {
      setSelectedRoleLoading(true);
      const detail = await getRoleByUuid(role.uuid);
      setSelectedRole(detail);
      setRoleHomePathDraft(detail.home_path || undefined);

      // 并行加载三层权限数据
      initializedExpandRef.current = false;
      const [, roleDataPolicies, roleFieldPolicies] = await Promise.all([
        loadFunctionGrantsForRole(detail.uuid),
        getRoleDataPolicies(detail.uuid),
        getRoleFieldPolicies(detail.uuid),
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
        messageApi.success(`功能权限保存成功：${refreshed.granted_codes?.length ?? 0} 项`);
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

      if (permissionLayer === 'function') {
        try {
          await refreshCurrentUserInStore();
        } catch {
          /* 非阻塞：当前账号刷新失败时仍提示用户重新登录 */
        }
        useGlobalStore.getState().incrementApplicationMenuVersion();
      }
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

  const selectByFunctionModule = useCallback(() => {
    if (!functionBatchApp) return;
    const codes = allPermissions
      .filter((p) => (p.code || '').startsWith(`${functionBatchApp}:`))
      .map((p) => normalizeFunctionPermissionCode(p.code || ''))
      .filter(Boolean);
    setGrantedCodes((prev) => Array.from(new Set([...prev, ...codes])));
  }, [functionBatchApp, allPermissions]);

  const clearByFunctionModule = useCallback(() => {
    if (!functionBatchApp) return;
    const target = new Set(
      allPermissions
        .filter((p) => (p.code || '').startsWith(`${functionBatchApp}:`))
        .map((p) => normalizeFunctionPermissionCode(p.code || ''))
        .filter(Boolean)
    );
    setGrantedCodes((prev) => prev.filter((c) => !target.has(c)));
  }, [functionBatchApp, allPermissions]);

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
          {/* 操作按钮 */}
          <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
            <div style={{ display: 'flex', gap: 8 }}>
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
              <Tooltip title="清理旧角色">
                <Button
                  icon={<ClearOutlined />}
                  style={{ width: 32, minWidth: 32, padding: 0, flexShrink: 0 }}
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
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: token.colorBgContainer,
        }}
      >
        {selectedRole ? (
          <>
        {/* 顶部工具栏 */}
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
            padding: '16px 24px',
            borderBottom: `1px solid ${token.colorBorderSecondary || 'rgba(0,0,0,0.06)'}`
          }}>
            <Space size="middle" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <Space size="small">
                  <span style={{ fontSize: '16px', fontWeight: 600 }}>{selectedRole.name}</span>
                  <Tag color="blue" variant="filled" style={{ margin: 0 }}>{selectedRole.code}</Tag>
                  {selectedRole.is_system && <Tag color="default" variant="filled">{t('pages.system.roles.systemRole')}</Tag>}
                </Space>
              </div>
              <Divider orientation="vertical" style={{ height: 24 }} />
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

            <Space>
                {permissionLayer === 'function' && (
                  <Select
                    placeholder={t('pages.system.roles.applyTemplate')}
                    style={{ width: 180 }}
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
              </Space>
          </div>

          <div
            style={{
              padding: '12px 24px',
              borderBottom: `1px solid ${token.colorBorderSecondary || 'rgba(0,0,0,0.06)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 500, flexShrink: 0 }}>
              {t('field.role.homePath', { defaultValue: 'UniTabs 首页' })}
            </span>
            <Select
              style={{ minWidth: 320, flex: 1, maxWidth: 560 }}
              allowClear
              showSearch
              placeholder={t('field.role.homePathPlaceholder', { defaultValue: '选择页面路径，留空则按全局规则' })}
              value={roleHomePathDraft}
              onChange={(v) => setRoleHomePathDraft(v)}
              options={homePathOptions}
              optionFilterProp="label"
              disabled={selectedRole.is_system}
            />
            <Button
              type="primary"
              ghost
              loading={savingRoleHome}
              disabled={selectedRole.is_system}
              onClick={() => void handleSaveRoleHomePath()}
            >
              {t('pages.system.roles.saveRoleHome', { defaultValue: '保存首页' })}
            </Button>
          </div>

          {/* 权限层 Tab */}
            <div style={{ padding: '16px 24px 0 24px' }}>
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
        </div>

        {/* 权限编辑区域 */}
        <div className="scrollbar-like-modal" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }}>
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
                  {functionGrants?.tree?.length ? (
                    <FunctionGrantTree
                      tree={functionGrants.tree}
                      grantedCodes={grantedCodeSet}
                      expandedKeys={permissionTreeExpandedKeys}
                      onExpand={(keys) => setPermissionTreeExpandedKeys(keys)}
                      onToggle={toggleGrantedCodes}
                      t={t}
                    />
                  ) : (
                    <Empty description="暂无功能权限树，请检查菜单与权限同步" />
                  )}
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
                        onChange={(val) => {
                          const nextScope = val as DataPermissionPolicy['scope_type'];
                          setDataPolicies((prev) =>
                            prev.map((x, i) => {
                              if (i !== idx) return x;
                              const defaultCustomPayload =
                                nextScope === 'scope_custom' &&
                                /outsource-maintenance|outsource-complete/.test(x.resource)
                                  ? { resolver: 'outsourced_unit' }
                                  : nextScope === 'scope_custom' &&
                                      /molds-documents-trial|molds-reports-trial-record/.test(x.resource)
                                    ? { resolver: 'partner', dimension: 'supplier', code_field: 'supplier_code' }
                                    : undefined;
                              return {
                                ...x,
                                scope_type: nextScope,
                                scope_payload:
                                  nextScope === 'scope_custom'
                                    ? x.scope_payload ?? defaultCustomPayload
                                    : undefined,
                              };
                            })
                          );
                        }}
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
                系统功能权限：
                {functionGrants?.stats?.total_function_codes ?? allPermissions.length} 项
              </span>
              <span>
                当前已授权：
                <span style={{ color: token.colorPrimary, fontWeight: 500 }}>{assignedFunctionPermissionCount}</span> 项
                {permissionLayer === 'function' && grantedNotOnTree > 0 && (
                  <span style={{ color: token.colorTextSecondary, marginLeft: 4 }}>
                    （树上可见 {treeVisibleAssignedCount} 项，未挂载 {grantedNotOnTree} 项）
                  </span>
                )}
              </span>
              <span>
                角色关联用户：
                <span style={{ color: token.colorSuccess, fontWeight: 500 }}>{selectedRole.user_count || 0}</span> 人
              </span>
            </Space>
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
    </>
  );
};

export default RolesPermissionsPage;
