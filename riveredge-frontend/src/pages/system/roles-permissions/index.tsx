/**
 * 角色权限管理合并页面
 * 
 * 左侧：角色树形菜单
 * 右侧：选中角色的权限编辑界面
 * 
 * 整合了角色管理和权限分配功能，提供更直观的管理体验。
 * 布局参考文件管理页面设计。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  Space,
  Tag,
  Tree,
  message,
  Modal,
  Popconfirm,
  Input,
  Empty,
  Spin,
  Divider,
  Tooltip,
  App,
  theme,
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

  // 角色编辑 Modal 相关状态
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [isEditRole, setIsEditRole] = useState(false);
  const [roleFormLoading, setRoleFormLoading] = useState(false);
  const [currentEditRole, setCurrentEditRole] = useState<Role | null>(null);

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
   * 加载所有权限
   */
  const loadAllPermissions = async () => {
    try {
      setPermissionsLoading(true);
      // 后端限制 page_size 最大为 100，需要分页加载所有权限
      let allItems: Permission[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await getAllPermissions({ page, page_size: 100 });
        allItems = [...allItems, ...response.items];

        // 如果返回的数据少于 page_size，说明已经是最后一页
        if (response.items.length < 100 || allItems.length >= response.total) {
          hasMore = false;
        } else {
          page++;
        }
      }

      setAllPermissions(allItems);

      // 构建树形数据（按资源分组）
      const resourceMap: Record<string, Permission[]> = {};
      allItems.forEach(permission => {
        if (!resourceMap[permission.resource]) {
          resourceMap[permission.resource] = [];
        }
        resourceMap[permission.resource].push(permission);
      });

      // 获取资源名称的中文翻译
      const getResourceName = (resource: string): string => {
        const translationKey = `permission.resource.${resource}`;
        const translated = t(translationKey);
        // 如果翻译不存在，返回原始资源名称（首字母大写）
        return translated !== translationKey
          ? translated
          : resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
      };

      const treeData = Object.keys(resourceMap).map(resource => ({
        title: (
          <span>
            <strong>{getResourceName(resource)}</strong>
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {resourceMap[resource].length}
            </Tag>
          </span>
        ),
        key: `resource-${resource}`,
        icon: <LockOutlined />,
        children: resourceMap[resource].map(permission => ({
          title: (
            <span>
              {permission.name}
              <Tag color="default" style={{ marginLeft: 8, fontSize: '12px' }}>
                {permission.code}
              </Tag>
            </span>
          ),
          key: permission.id,
        })),
      }));

      setPermissionTreeData(treeData);
    } catch (error: any) {
      messageApi.error(error.message || '加载权限列表失败');
    } finally {
      setPermissionsLoading(false);
    }
  };

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
      const rolePermissionUuids = rolePermissions.map(p => p.id);
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
        key => typeof key === 'string' && !key.startsWith('resource-')
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
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSavePermissions}
                loading={savingPermissions}
              >
                保存权限
              </Button>
            </>
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
              <Tree
                checkable
                checkedKeys={checkedKeys}
                onCheck={(checked) => setCheckedKeys(checked as React.Key[])}
                treeData={permissionTreeData}
                defaultExpandAll
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
              已选择 {checkedKeys.filter(key => typeof key === 'string' && !key.startsWith('resource-')).length} 个权限
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
    </div>
  );
};

export default RolesPermissionsPage;
