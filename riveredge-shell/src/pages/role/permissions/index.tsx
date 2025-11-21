/**
 * 角色权限分配页面
 * 
 * 用于为角色分配权限。
 * 自动过滤当前组织的权限。
 */

import React, { useEffect, useState } from 'react';
import { Tree, Card, Button, message, Spin } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getRoleById, getRolePermissions, assignPermissions, getAllPermissions, Permission } from '@/services/role';

/**
 * 角色权限分配页面组件
 */
const RolePermissions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<any>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

  /**
   * 加载角色和权限数据
   */
  useEffect(() => {
    if (roleId) {
      setLoading(true);
      Promise.all([
        getRoleById(Number(roleId)),
        getRolePermissions(Number(roleId)),
        getAllPermissions({ page: 1, page_size: 1000 }), // 获取所有权限
      ])
        .then(([roleData, rolePermissions, allPermissionsData]) => {
          setRole(roleData);
          setAllPermissions(allPermissionsData.items);
          // 设置已选中的权限（角色已有的权限）
          setCheckedKeys(rolePermissions.map((p) => p.id));
        })
        .catch((error: any) => {
          message.error(error.message || '加载数据失败');
          navigate('/role/list');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [roleId]);

  /**
   * 构建权限树数据
   */
  const buildTreeData = () => {
    // 按资源分组
    const resourceMap = new Map<string, Permission[]>();
    allPermissions.forEach((permission) => {
      const resource = permission.resource;
      if (!resourceMap.has(resource)) {
        resourceMap.set(resource, []);
      }
      resourceMap.get(resource)!.push(permission);
    });

    // 构建树结构
    const treeData = Array.from(resourceMap.entries()).map(([resource, permissions]) => ({
      title: resource,
      key: `resource-${resource}`,
      children: permissions.map((permission) => ({
        title: `${permission.name} (${permission.code})`,
        key: permission.id,
        isLeaf: true,
      })),
    }));

    return treeData;
  };

  /**
   * 处理权限选择变化
   */
  const handleCheck = (checkedKeysValue: React.Key[]) => {
    setCheckedKeys(checkedKeysValue);
  };

  /**
   * 处理保存
   */
  const handleSave = async () => {
    if (!roleId) {
      return;
    }

    // 过滤出叶子节点（实际权限 ID）
    const permissionIds = checkedKeys
      .filter((key) => typeof key === 'number')
      .map((key) => Number(key));

    setSaving(true);
    try {
      await assignPermissions(Number(roleId), permissionIds);
      message.success('权限分配成功');
      navigate('/role/list');
    } catch (error: any) {
      message.error(error.message || '权限分配失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card
      title={`角色权限分配 - ${role?.name || ''}`}
      extra={
        <Button type="primary" onClick={handleSave} loading={saving}>
          保存
        </Button>
      }
    >
      <Tree
        checkable
        checkedKeys={checkedKeys}
        onCheck={handleCheck}
        treeData={buildTreeData()}
        defaultExpandAll
      />
    </Card>
  );
};

export default RolePermissions;

