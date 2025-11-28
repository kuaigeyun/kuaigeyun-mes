/**
 * RiverEdge SaaS 多组织框架 - 用户表单页面
 *
 * 用于新增和编辑用户信息，使用现代化React生态技术栈
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormSwitch } from '@ant-design/pro-components';
import { message, Card } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserById, createUser, updateUser, User, CreateUserData, UpdateUserData } from '@/services/user';
import { useGlobalStore } from '@/stores';

/**
 * 用户表单页面组件
 */
const UserForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentUser } = useGlobalStore();

  const isEdit = !!id;
  const userId = id ? Number(id) : null;

  // 获取用户详情（编辑模式）
  const { data: userDetail, isLoading: loadingUser } = useQuery({
    queryKey: ['userDetail', userId],
    queryFn: () => getUserById(userId!),
    enabled: isEdit && !!userId,
    onError: (error: any) => {
      message.error(error.message || '加载用户信息失败');
      navigate('/users');
    },
  });

  // 创建用户mutation
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      message.success('创建用户成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate('/users');
    },
    onError: (error: any) => {
      message.error(error.message || '创建用户失败');
    },
  });

  // 更新用户mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) => updateUser(id, data),
    onSuccess: () => {
      message.success('更新用户成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userDetail', userId] });
      navigate('/users');
    },
    onError: (error: any) => {
      message.error(error.message || '更新用户失败');
    },
  });

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    if (isEdit && userId) {
      // 更新用户
      const updateData: UpdateUserData = {
        username: values.username,
        email: values.email,
        password: values.password || undefined,
        full_name: values.full_name,
        is_active: values.is_active,
        is_platform_admin: values.is_platform_admin,
        is_tenant_admin: values.is_tenant_admin,
      };
      // 如果密码为空，不更新密码
      if (!updateData.password) {
        delete updateData.password;
      }
      updateMutation.mutate({ id: userId, data: updateData });
    } else {
      // 创建用户
      const createData: CreateUserData = {
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        is_active: values.is_active ?? true,
        is_platform_admin: values.is_platform_admin ?? false,
        is_tenant_admin: values.is_tenant_admin ?? false,
      };
      createMutation.mutate(createData);
    }
  };

  const isLoading = loadingUser || createMutation.isPending || updateMutation.isPending;

  return (
    <PageContainer
      title={isEdit ? '编辑用户' : '创建用户'}
      onBack={() => navigate('/users')}
    >
      <Card loading={isLoading}>
        <ProForm
          initialValues={{
            ...userDetail,
            is_active: userDetail?.is_active ?? true,
            is_platform_admin: userDetail?.is_platform_admin ?? false,
            is_tenant_admin: userDetail?.is_tenant_admin ?? false,
          }}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新用户' : '创建用户',
              resetText: '重置',
            },
            resetButtonProps: {
              style: { display: isEdit ? 'none' : 'inline-block' },
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
            tooltip="用户登录时使用的用户名"
          />
          <ProFormText
            name="email"
            label="邮箱"
            placeholder="请输入邮箱地址"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
            tooltip="可选，用于找回密码等功能"
          />
          <ProFormText.Password
            name="password"
            label={isEdit ? '密码（留空则不修改）' : '密码'}
            placeholder={isEdit ? '留空则不修改密码' : '请输入密码'}
            rules={
              isEdit
                ? []
                : [
                    { required: true, message: '请输入密码' },
                    { min: 8, message: '密码长度至少 8 字符' },
                  ]
            }
            tooltip={isEdit ? '留空表示不修改密码' : '用户登录密码，至少8位字符'}
          />
          <ProFormText
            name="full_name"
            label="全名"
            placeholder="请输入用户全名"
            tooltip="用户的真实姓名，可选"
          />
          <ProFormSwitch
            name="is_active"
            label="账户状态"
            tooltip="控制用户是否可以登录系统"
          />
          {currentUser?.is_platform_admin && (
            <>
              <ProFormSwitch
                name="is_platform_admin"
                label="平台管理员"
                tooltip="平台级别的管理员，具有最高权限"
              />
              <ProFormSwitch
                name="is_tenant_admin"
                label="组织管理员"
                tooltip="组织级别的管理员，可以管理组织内的用户和权限"
              />
            </>
          )}
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default UserForm;

