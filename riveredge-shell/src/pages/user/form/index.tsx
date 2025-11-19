/**
 * 用户表单页面
 * 
 * 用于新增和编辑用户信息。
 * 自动关联当前租户（后端自动设置 tenant_id）。
 */

import React, { useEffect, useState } from 'react';
import { ProForm, ProFormText, ProFormSwitch, ProFormSelect } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUserById, createUser, updateUser, User, CreateUserData, UpdateUserData } from '@/services/user';

/**
 * 用户表单页面组件
 */
const UserForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<Partial<User>>({});

  /**
   * 加载用户数据（编辑模式）
   */
  useEffect(() => {
    if (userId) {
      setLoading(true);
      getUserById(Number(userId))
        .then((user) => {
          setInitialValues(user);
        })
        .catch((error: any) => {
          message.error(error.message || '加载用户信息失败');
          navigate('/user/list');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [userId]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      if (userId) {
        // 更新用户
        const updateData: UpdateUserData = {
          username: values.username,
          email: values.email,
          password: values.password || undefined,
          full_name: values.full_name,
          is_active: values.is_active,
          is_superuser: values.is_superuser,
          is_tenant_admin: values.is_tenant_admin,
        };
        // 如果密码为空，不更新密码
        if (!updateData.password) {
          delete updateData.password;
        }
        await updateUser(Number(userId), updateData);
        message.success('更新成功');
      } else {
        // 创建用户
        const createData: CreateUserData = {
          username: values.username,
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          is_active: values.is_active ?? true,
          is_superuser: values.is_superuser ?? false,
          is_tenant_admin: values.is_tenant_admin ?? false,
        };
        await createUser(createData);
        message.success('创建成功');
      }
      navigate('/user/list');
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
          submitText: userId ? '更新' : '创建',
        },
      }}
    >
      <ProFormText
        name="username"
        label="用户名"
        placeholder="请输入用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, max: 50, message: '用户名长度为 3-50 字符' },
        ]}
      />
      <ProFormText
        name="email"
        label="邮箱（可选）"
        placeholder="请输入邮箱（可选）"
        rules={[
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      />
      <ProFormText.Password
        name="password"
        label={userId ? '密码（留空则不修改）' : '密码'}
        placeholder={userId ? '留空则不修改密码' : '请输入密码'}
        rules={
          userId
            ? []
            : [
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码长度至少 8 字符' },
              ]
        }
      />
      <ProFormText
        name="full_name"
        label="全名"
        placeholder="请输入全名（可选）"
      />
      <ProFormSwitch
        name="is_active"
        label="是否激活"
        initialValue={true}
      />
      <ProFormSwitch
        name="is_superuser"
        label="超级用户（租户内）"
        initialValue={false}
      />
      <ProFormSwitch
        name="is_tenant_admin"
        label="租户管理员"
        initialValue={false}
      />
    </ProForm>
  );
};

export default UserForm;

