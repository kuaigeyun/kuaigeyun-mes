/**
 * 平台超级管理员登录页面
 *
 * 用于平台超级管理员登录系统
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, App, ConfigProvider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { infraSuperAdminLogin } from '../../services/infraAdmin';
import { setToken, setUserInfo, setTenantId } from '../../utils/auth';
import { useGlobalStore } from '../../stores';
import { theme } from 'antd';
import { getPlatformSettingsPublic } from '../../services/platformSettings';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginFormData>();
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  
  // 获取平台设置（公开接口）
  const { data: platformSettings } = useQuery({
    queryKey: ['platformSettingsPublic'],
    queryFn: getPlatformSettingsPublic,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 主题颜色（默认为 #1890ff）
  const themeColor = platformSettings?.theme_color || '#1890ff';

  // 设置页面标题
  useEffect(() => {
    const platformName = platformSettings?.platform_name || 'RiverEdge SaaS';
    document.title = `${platformName} - ${t('pages.infra.login.pageTitle')}`;
    
    // 组件卸载时恢复默认标题
    return () => {
      document.title = t('pages.infra.login.defaultDocTitle');
    };
  }, [platformSettings?.platform_name, t]);

  // 登录请求
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => infraSuperAdminLogin(data),
    onSuccess: (response) => {
      // 保存认证信息
      setToken(response.access_token);

      setUserInfo({
        ...response.user,
        user_type: 'infra_superadmin',
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
        is_infra_admin: true, // 平台超级管理员始终是平台管理
        is_tenant_admin: false,
        tenant_id: response.default_tenant_id, // 使用默认租户 ID
      });

      messageApi.success(t('pages.infra.login.success'));
      // 登录成功后跳转到平台运营看板
      navigate('/infra/operation', { replace: true });
    },
    onError: (error: any) => {
      messageApi.error(error?.message || t('pages.infra.login.error'));
    },
  });

  /**
   * 处理登录
   */
  const handleLogin = async (values: LoginFormData) => {
    await loginMutation.mutateAsync(values);
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 强制使用浅色模式，不受全局深色模式影响
        token: {
          colorPrimary: themeColor, // 固定主题色，不受全局主题影响
        },
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: `linear-gradient(135deg, ${themeColor} 0%, #40a9ff 100%)`, // 使用固定主题色
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
              {platformSettings?.platform_name ? `${platformSettings.platform_name} ${t('pages.infra.login.pageTitle')}` : t('pages.infra.login.defaultTitle')}
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
                { required: true, message: t('pages.infra.login.usernameRequired') },
                { min: 3, message: t('pages.infra.login.usernameMin') },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('pages.infra.login.usernamePlaceholder')}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: t('pages.infra.login.passwordRequired') },
                { min: 8, message: t('pages.infra.login.passwordMin') },
                { max: 128, message: t('pages.infra.login.passwordMax') },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('pages.infra.login.passwordPlaceholder')}
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
                {t('pages.infra.login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </ConfigProvider>
  );
}
