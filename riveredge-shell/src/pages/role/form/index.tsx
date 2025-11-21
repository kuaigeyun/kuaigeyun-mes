/**
 * 角色表单页面
 * 
 * 用于新增和编辑角色信息。
 * 自动关联当前组织（后端自动设置 tenant_id）。
 */

import React, { useEffect, useState } from 'react';
import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getRoleById, createRole, updateRole, Role, CreateRoleData, UpdateRoleData } from '@/services/role';

/**
 * 角色表单页面组件
 */
const RoleForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<Role>>({});

  /**
   * 加载角色数据（编辑模式）
   */
  useEffect(() => {
    if (roleId) {
      setLoading(true);
      getRoleById(Number(roleId))
        .then((role) => {
          setInitialValues(role);
        })
        .catch((error: any) => {
          message.error(error.message || '加载角色信息失败');
          navigate('/role/list');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [roleId]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (roleId) {
        // 更新角色
        const updateData: UpdateRoleData = {
          name: values.name,
          code: values.code,
          description: values.description,
          is_system: values.is_system,
        };
        await updateRole(Number(roleId), updateData);
        message.success('更新成功');
      } else {
        // 创建角色
        const createData: CreateRoleData = {
          name: values.name,
          code: values.code,
          description: values.description,
          is_system: values.is_system ?? false,
        };
        await createRole(createData);
        message.success('创建成功');
      }
      navigate('/role/list');
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  return (
    <ProForm
      loading={loading}
      initialValues={initialValues}
      onFinish={handleSubmit}
      submitter={{
        searchConfig: {
          submitText: roleId ? '更新' : '创建',
        },
      }}
    >
      <ProFormText
        name="name"
        label="角色名称"
        placeholder="请输入角色名称"
        rules={[
          { required: true, message: '请输入角色名称' },
          { min: 1, max: 50, message: '角色名称长度为 1-50 字符' },
        ]}
      />
      <ProFormText
        name="code"
        label="角色代码"
        placeholder="请输入角色代码（用于程序识别）"
        rules={[
          { required: true, message: '请输入角色代码' },
          { min: 1, max: 50, message: '角色代码长度为 1-50 字符' },
        ]}
      />
      <ProFormTextArea
        name="description"
        label="描述"
        placeholder="请输入角色描述（可选）"
      />
      <ProFormSwitch
        name="is_system"
        label="系统角色"
        initialValue={false}
        extra="系统角色不可删除"
      />
    </ProForm>
  );
};

export default RoleForm;

