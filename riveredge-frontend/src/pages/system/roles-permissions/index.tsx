/**
 * 角色权限管理合并页面
 * 
 * 左侧：角色树形菜单
 * 右侧：选中角色的权限编辑界面
 * 
 * 整合了角色管理和权限分配功能，提供更直观的管理体验。
 * 布局参考文件管理页面设计。
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Flex,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  SearchOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  CopyOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import {
  getRoleList,
  getRoleByUuid,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignPermissions,
  getAllPermissions,
  Role,
  CreateRoleData,
  UpdateRoleData,
  Permission,
} from '../../../services/role';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import {
  PERMISSION_MODULE_NAMES,
  getModuleByResource,
  PERMISSION_TEMPLATES,
  getPermissionUuidsByTemplate,
} from '../../../config/permission-modules';

/**
 * 角色权限管理合并页面组件
 */
const RolesPermissionsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const formRef = useRef<ProFormInstance>();

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
  const [isEditRole, setIsEditRole] = useState(false);
  const [roleFormLoading, setRoleFormLoading] = useState(false);
  const [currentEditRole, setCurrentEditRole] = useState<Role | null>(null);
  
  // 复制权限相关状态
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [sourceRoleUuid, setSourceRoleUuid] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

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
   * 编辑角色
   */
  const handleEditRole = useCallback(async (role: Role) => {
    try {
      setIsEditRole(true);
      setCurrentEditRole(role);
      setRoleModalVisible(true);

      // 获取角色详情
      const detail = await getRoleByUuid(role.uuid);

      // 等待 Modal 打开后再设置表单值
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          code: detail.code,
          description: detail.description || '',
          is_active: detail.is_active,
        });
      }, 100);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.getDetailFailed'));
    }
  }, [messageApi, t]);

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
  const filteredRoles = roles.filter(role => {
    if (!roleSearchKeyword) return true;
    const keyword = roleSearchKeyword.toLowerCase();
    return (
      role.name.toLowerCase().includes(keyword) ||
      role.code.toLowerCase().includes(keyword) ||
      (role.description && role.description.toLowerCase().includes(keyword))
    );
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
      let allItems: Permission[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await getAllPermissions({ page, page_size: 100 });
        allItems = [...allItems, ...response.items];
        if (response.items.length < 100 || allItems.length >= response.total) {
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
   * 根据权限列表、搜索关键词、类型筛选构建树形数据
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

    const groupedData: Record<string, Record<string, Permission[]>> = {};
    filteredItems.forEach((permission) => {
      const module = getModuleByResource(permission.resource);
      if (!groupedData[module]) groupedData[module] = {};
      if (!groupedData[module][permission.resource]) {
        groupedData[module][permission.resource] = [];
      }
      groupedData[module][permission.resource].push(permission);
    });

    const getResourceName = (resource: string): string => {
      const translationKey = `permission.resource.${resource}`;
      const translated = t(translationKey);
      return translated !== translationKey
        ? translated
        : resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
    };

    const getActionName = (action?: string): string => {
      if (!action) return '';
      const key = `permission.action.${action.toLowerCase()}`;
      const translated = t(key);
      if (translated !== key) return translated;
      return action;
    };

    const getScopeName = (scope?: string): string => {
      if (!scope) return '';
      const key = `permission.scope.${scope.toLowerCase()}`;
      const translated = t(key);
      if (translated !== key) return translated;
      return scope;
    };

    const getPermissionDisplayName = (permission: Permission): string => {
      const codeParts = (permission.code || '').split(':').filter(Boolean);
      const resource = permission.resource || codeParts[0] || '';
      const action = permission.action || codeParts[1] || '';
      const resourceName = getResourceName(resource);
      const actionName = getActionName(action);

      if (permission.permission_type === 'function') {
        if (actionName && resourceName) return `${actionName}${resourceName}`;
        return permission.name;
      }

      if (permission.permission_type === 'data') {
        const scope =
          codeParts.find((part) => ['all', 'department', 'self'].includes(part.toLowerCase())) || '';
        const scopeName = getScopeName(scope);
        if (scopeName && resourceName) return `${resourceName}${scopeName}数据`;
        return permission.name;
      }

      return permission.name;
    };

    const getModuleName = (module: string): string =>
      PERMISSION_MODULE_NAMES[module] || module;

    const expandKeys: React.Key[] = [];
    const treeData = Object.keys(groupedData).map((module) => {
      expandKeys.push(`module-${module}`);
      return {
        title: (
          <span style={{ fontWeight: 600, color: token.colorPrimary }}>
            {getModuleName(module)}
          </span>
        ),
        key: `module-${module}`,
        icon: <AppstoreOutlined />,
        children: Object.keys(groupedData[module]).map((resource) => {
          expandKeys.push(`resource-${resource}`);
          return {
            title: (
              <span>
                <strong>{getResourceName(resource)}</strong>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {groupedData[module][resource].length}
                </Tag>
              </span>
            ),
            key: `resource-${resource}`,
            icon: <LockOutlined />,
            children: groupedData[module][resource].map((permission) => ({
              title: (
                <Space>
                  <span>{getPermissionDisplayName(permission)}</span>
                  <Tag color="cyan" style={{ fontSize: '10px' }}>
                    {permission.code}
                  </Tag>
                  {permission.permission_type === 'field' && (
                    <Tag color="orange" style={{ fontSize: '10px' }}>{t('pages.system.roles.permissionTypeField')}</Tag>
                  )}
                  {permission.permission_type === 'data' && (
                    <Tag color="green" style={{ fontSize: '10px' }}>{t('pages.system.roles.permissionTypeData')}</Tag>
                  )}
                </Space>
              ),
              key: permission.uuid,
              icon:
                permission.permission_type === 'field' ? (
                  <EyeInvisibleOutlined />
                ) : permission.permission_type === 'data' ? (
                  <DatabaseOutlined />
                ) : (
                  <SafetyCertificateOutlined />
                ),
            })),
          };
        }),
      };
    });

    setPermissionTreeData(treeData);
    setPermissionTreeExpandedKeys(expandKeys);
  }, [allPermissions, permissionSearchKeyword, permissionTypeFilter, t, token.colorPrimary]);

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
        } else if (typeof node.key === 'string' && !node.key.startsWith('module-') && !node.key.startsWith('resource-')) {
          collect.push(node.key);
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
      checkedKeys.filter((k) => typeof k === 'string' && !String(k).startsWith('resource-') && !String(k).startsWith('module-'))
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
      (k) => typeof k === 'string' && !k.startsWith('resource-') && !k.startsWith('module-') && !toRemove.has(k)
    );
    setCheckedKeys(kept);
  }, [checkedKeys, displayedPermissionUuids]);

  /**
   * 批量操作：反选当前展示的权限
   */
  const handleSelectInvert = useCallback(() => {
    const displayedSet = new Set(displayedPermissionUuids);
    const currentChecked = new Set(
      checkedKeys.filter((k) => typeof k === 'string' && !String(k).startsWith('resource-') && !String(k).startsWith('module-'))
    );
    const result: string[] = [];
    displayedSet.forEach((uuid) => {
      if (!currentChecked.has(uuid)) result.push(uuid);
    });
    checkedKeys.forEach((k) => {
      if (typeof k === 'string' && !displayedSet.has(k) && !k.startsWith('resource-') && !k.startsWith('module-')) {
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
        key => typeof key === 'string' && !key.startsWith('resource-') && !key.startsWith('module-')
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

  /**
   * 新建角色
   */
  const handleCreateRole = () => {
    setIsEditRole(false);
    setCurrentEditRole(null);
    setRoleModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 提交角色表单（创建/更新）
   */
  const handleSubmitRole = async () => {
    try {
      setRoleFormLoading(true);
      const values = await formRef.current?.validateFields();

      if (isEditRole && currentEditRole) {
        await updateRole(currentEditRole.uuid, values as UpdateRoleData);
        messageApi.success(t('pages.system.roles.updateSuccess'));
      } else {
        await createRole(values as CreateRoleData);
        messageApi.success(t('pages.system.roles.createSuccess'));
      }

      setRoleModalVisible(false);
      setCurrentEditRole(null);
      await loadRoles();

      // 如果是编辑当前选中的角色，重新加载
      if (isEditRole && currentEditRole && selectedRole?.uuid === currentEditRole.uuid) {
        await handleSelectRole(currentEditRole);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.roles.operationFailed'));
    } finally {
      setRoleFormLoading(false);
    }
  };

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
        padding: `0 ${PAGE_SPACING?.PADDING || 16}px ${PAGE_SPACING?.PADDING || 16}px ${PAGE_SPACING?.PADDING || 16}px`,
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

        {/* 新建按钮 */}
        <div style={{ padding: '8px', borderBottom: `1px solid ${token.colorBorder}` }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={handleCreateRole}
          >
            {t('pages.system.roles.createRole')}
          </Button>
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
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
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
              <Divider />
              {/* 权限树搜索、类型筛选与批量操作 */}
              <Flex gap="middle" style={{ marginBottom: 16 }} wrap="wrap" align="center">
                <Input
                  placeholder={t('pages.system.roles.searchPermission')}
                  prefix={<SearchOutlined />}
                  value={permissionSearchKeyword}
                  onChange={(e) => setPermissionSearchKeyword(e.target.value)}
                  allowClear
                  style={{ width: 240 }}
                />
                <Select
                  value={permissionTypeFilter}
                  onChange={setPermissionTypeFilter}
                  style={{ width: 120 }}
                  options={[
                    { value: 'all', label: t('pages.system.roles.allTypes') },
                    { value: 'function', label: t('pages.system.roles.functionPermission') },
                    { value: 'data', label: t('pages.system.roles.dataPermission') },
                    { value: 'field', label: t('pages.system.roles.fieldPermission') },
                  ]}
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
                <Divider orientation="vertical" />
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
              {t('pages.system.roles.selectedCount', { count: checkedKeys.filter(key => typeof key === 'string' && !key.startsWith('resource-') && !key.startsWith('module-')).length })}
            </span>
            <span>
              {t('pages.system.roles.totalPermissions', { count: allPermissions.length })}
            </span>
          </div>
        )}
      </div>

      {/* 角色编辑 Modal */}
      <Modal
        title={isEditRole ? t('pages.system.roles.editRole') : t('pages.system.roles.createRole')}
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={handleSubmitRole}
        confirmLoading={roleFormLoading}
        width={600}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label={t('pages.system.roles.roleName')}
            rules={[{ required: true, message: t('pages.system.roles.roleNameRequired') }]}
            placeholder={t('pages.system.roles.roleNamePlaceholder')}
          />
          <ProFormText
            name="code"
            label={t('pages.system.roles.roleCode')}
            rules={[
              { required: true, message: t('pages.system.roles.roleCodeRequired') },
              { pattern: /^[a-zA-Z0-9_]+$/, message: t('pages.system.roles.roleCodePattern') },
            ]}
            placeholder={t('pages.system.roles.roleCodePlaceholder')}
          />
          <ProFormTextArea
            name="description"
            label={t('pages.system.roles.description')}
            placeholder={t('pages.system.roles.descriptionPlaceholder')}
          />
          <ProFormSwitch
            name="is_active"
            label={t('pages.system.roles.isEnabled')}
            initialValue={true}
          />
        </ProForm>
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
