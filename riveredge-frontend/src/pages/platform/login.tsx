/**
 * 平台超级管理员登录页面
 *
 * 用于平台超级管理员登录系统
 */

import React, { useState } from 'react';
import { Card, Form, Input, Button, message, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { platformSuperAdminLogin } from '../../services/platformAdmin';
import { setToken, setUserInfo, setTenantId } from '../../utils/auth';
import { useGlobalStore } from '../../stores';

/**
 * 平台超级管理员登录表单数据
 */
interface LoginFormData {
  username: string;
  password: string;
}

/**
 * 平台超级管理员登录页面组件
 */
export default function PlatformLoginPage() {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormData>();
  const { setCurrentUser } = useGlobalStore();

  // 登录请求
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => platformSuperAdminLogin(data),
    onSuccess: (response) => {
      // 保存认证信息
      setToken(response.access_token);

      setUserInfo({
        ...response.user,
        user_type: 'platform_superadmin',
      });

      // 设置默认租户 ID（如果返回了默认租户）
      if (response.default_tenant_id) {
        setTenantId(response.default_tenant_id);
      }

      // 设置当前用户信息到全局状态
      setCurrentUser({
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        full_name: response.user.full_name,
        is_platform_admin: true, // 平台超级管理员始终是平台管理
        is_tenant_admin: false,
        tenant_id: response.default_tenant_id, // 使用默认租户 ID
      });

      messageApi.success('登录成功');
      // 登录成功后跳转到平台运营看板
      navigate('/platform/operation', { replace: true });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || '登录失败，请检查用户名和密码');
    },
  });

  /**
   * 处理登录
   */
  const handleLogin = async (values: LoginFormData) => {
    await loginMutation.mutateAsync(values);
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
        }}
        title={
          <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>
            RiverEdge SaaS 平台登录
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
              style={{ height: '40px', fontSize: '16px' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
