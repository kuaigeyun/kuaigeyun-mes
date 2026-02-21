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
      messageApi.error(error.message || '加载角色列表失败');
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
      messageApi.error(error.message || '获取角色详情失败');
    }
  }, [messageApi]);

  /**
   * 删除角色
   */
  const handleDeleteRole = useCallback(async (role: Role) => {
    try {
      await deleteRole(role.uuid);
      messageApi.success('删除成功');

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
        messageApi.error(error.message || '加载角色列表失败');
      } finally {
        setRolesLoading(false);
      }
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  }, [messageApi]);

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
            {role.is_system && <Tag color="default">系统</Tag>}
            {!role.is_active && <Tag color="default">禁用</Tag>}
          </Space>
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="编辑">
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
              title="确定要删除这个角色吗？"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDeleteRole(role);
              }}
              disabled={role.is_system}
            >
              <Tooltip title="删除">
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
      messageApi.error(error.message || '加载权限列表失败');
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
                    <Tag color="orange" style={{ fontSize: '10px' }}>字段</Tag>
                  )}
                  {permission.permission_type === 'data' && (
                    <Tag color="green" style={{ fontSize: '10px' }}>数据</Tag>
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
      const template = PERMISSION_TEMPLATES.find((t) => t.key === templateKey);
      messageApi.success(`已应用模板「${template?.name || templateKey}」，共 ${uuids.length} 个权限，请保存以生效`);
    },
    [allPermissions, messageApi]
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
      messageApi.error(error.message || '加载角色权限失败');
    } finally {
      setSelectedRoleLoading(false);
    }
  };

  /**
   * 保存权限分配
   */
  const handleSavePermissions = async () => {
    if (!selectedRole) {
      messageApi.warning('请先选择一个角色');
      return;
    }

    try {
      setSavingPermissions(true);
      const permissionUuids = checkedKeys.filter(
        key => typeof key === 'string' && !key.startsWith('resource-') && !key.startsWith('module-')
      ) as string[];

      await assignPermissions(selectedRole.uuid, permissionUuids);
      messageApi.success('权限分配成功');

      // 重新加载角色列表（更新权限数）
      await loadRoles();
    } catch (error: any) {
      messageApi.error(error.message || '权限分配失败');
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
        messageApi.success('更新成功');
      } else {
        await createRole(values as CreateRoleData);
        messageApi.success('创建成功');
      }

      setRoleModalVisible(false);
      setCurrentEditRole(null);
      await loadRoles();

      // 如果是编辑当前选中的角色，重新加载
      if (isEditRole && currentEditRole && selectedRole?.uuid === currentEditRole.uuid) {
        await handleSelectRole(currentEditRole);
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
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
      messageApi.success('已从源角色复制权限，请点击保存以生效');
      setCopyModalVisible(false);
      setSourceRoleUuid(null);
    } catch (error: any) {
      messageApi.error(error.message || '获取源角色权限失败');
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
            placeholder="搜索角色"
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
            新建角色
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
              刷新
            </Button>
          </Space>

          {/* 角色信息 */}
          <div style={{ flex: 1 }}>
            {selectedRole ? (
              <Space>
                <span style={{ fontWeight: 500 }}>{selectedRole.name}</span>
                <Tag color="blue">{selectedRole.code}</Tag>
                {selectedRole.is_system && <Tag color="default">系统角色</Tag>}
                {!selectedRole.is_active && <Tag color="default">已禁用</Tag>}
              </Space>
            ) : (
              <span style={{ color: token.colorTextSecondary }}>请从左侧选择一个角色</span>
            )}
          </div>

          {selectedRole && (
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={() => setCopyModalVisible(true)}
              >
                从角色复制
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSavePermissions}
                loading={savingPermissions}
              >
                保存权限
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
                    <span style={{ color: token.colorTextSecondary }}>角色描述：</span>
                    <span style={{ color: token.colorText }}>
                      {selectedRole.description || '暂无描述'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: token.colorTextSecondary }}>权限数：</span>
                    <Tag color="blue">{selectedRole.permission_count || 0}</Tag>
                    <span style={{ color: token.colorTextSecondary, marginLeft: 16 }}>用户数：</span>
                    <Tag color="green">{selectedRole.user_count || 0}</Tag>
                  </div>
                </Space>
              </div>
              <Divider />
              {/* 权限树搜索、类型筛选与批量操作 */}
              <Flex gap="middle" style={{ marginBottom: 16 }} wrap="wrap" align="center">
                <Input
                  placeholder="搜索权限（名称、代码、描述）"
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
                    { value: 'all', label: '全部类型' },
                    { value: 'function', label: '功能权限' },
                    { value: 'data', label: '数据权限' },
                    { value: 'field', label: '字段权限' },
                  ]}
                />
                <Divider orientation="vertical" />
                <Space size="small">
                  <Tooltip title="全选当前筛选条件下的权限，保存后生效">
                    <Button size="small" icon={<CheckSquareOutlined />} onClick={handleSelectAll}>
                      全选
                    </Button>
                  </Tooltip>
                  <Tooltip title="取消勾选当前展示的权限">
                    <Button size="small" icon={<BorderOutlined />} onClick={handleSelectNone}>
                      全不选
                    </Button>
                  </Tooltip>
                  <Tooltip title="反选当前展示的权限">
                    <Button size="small" icon={<SwapOutlined />} onClick={handleSelectInvert}>
                      反选
                    </Button>
                  </Tooltip>
                </Space>
                <Divider orientation="vertical" />
                <Select
                  placeholder="应用权限模板"
                  style={{ width: 160 }}
                  allowClear
                  onChange={(key) => key && handleApplyTemplate(key)}
                  options={PERMISSION_TEMPLATES.map((t) => ({
                    value: t.key,
                    label: t.name + (t.description ? ` (${t.description})` : ''),
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
              description="请从左侧选择一个角色来编辑权限"
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
              已选择 {checkedKeys.filter(key => typeof key === 'string' && !key.startsWith('resource-') && !key.startsWith('module-')).length} 个权限
            </span>
            <span>
              共 {allPermissions.length} 个权限
            </span>
          </div>
        )}
      </div>

      {/* 角色编辑 Modal */}
      <Modal
        title={isEditRole ? '编辑角色' : '新建角色'}
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
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
            placeholder="请输入角色名称"
          />
          <ProFormText
            name="code"
            label="角色代码"
            rules={[
              { required: true, message: '请输入角色代码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线' },
            ]}
            placeholder="请输入角色代码（如：admin、user）"
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入角色描述"
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
            initialValue={true}
          />
        </ProForm>
      </Modal>

      {/* 复制权限 Modal */}
      <Modal
        title="从其他角色复制权限"
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
          <p>请选择要从中复制权限的角色：</p>
          <Select
            placeholder="请选择源角色"
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
          注意：此操作将覆盖当前已勾选的权限，但不会立即保存到数据库。
        </p>
      </Modal>
    </div>
  );
};

export default RolesPermissionsPage;
