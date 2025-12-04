/**
 * 登录页面
 *
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：登录表单区
 */

import { ProForm, ProFormText } from '@ant-design/pro-components';
import { App, Typography, Button, Space, Tooltip } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, ThunderboltOutlined, BgColorsOutlined, GlobalOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { login, guestLogin, type LoginResponse } from '../../services/auth';
import { setToken, setTenantId } from '../../utils/auth';
import { useGlobalStore } from '../../stores';
import { TenantSelectionModal, TermsModal } from '../../components';
import './index.less';

const { Title, Text } = Typography;

/**
 * 登录表单数据接口
 */
interface LoginFormData {
  username: string;
  password: string;
}

/**
 * 登录页面组件
 *
 * 遵循 Ant Design Pro 登录页面设计规范：
 * - 左右分栏布局（响应式设计）
 * - 左侧品牌展示区（包含 Logo、标题、描述）
 * - 右侧登录表单区（包含表单、链接等）
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  // 使用全局状态管理（Zustand状态管理规范）
  const { setCurrentUser } = useGlobalStore();

  // 组织选择弹窗状态
  const [tenantSelectionVisible, setTenantSelectionVisible] = useState(false);
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<LoginFormData | null>(null);

  // 条款弹窗状态
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'user' | 'privacy'>('user');

  /**
   * 处理登录提交
   *
   * 登录成功后判断组织数量：
   * - 单组织：直接进入系统
   * - 多组织：显示组织选择弹窗
   * - 超级管理员：直接进入全功能后台
   *
   * @param values - 表单数据
   */
  const handleSubmit = async (values: LoginFormData) => {
    try {
      const response = await login(values);

      if (response && response.access_token) {
        // 保存 Token
        setToken(response.access_token);

        // 判断组织数量
        const tenants = response.tenants || [];
        const isPlatformAdmin = response.user?.is_platform_admin || false;

        // 平台管理：直接进入
        if (isPlatformAdmin) {
          // 保存组织 ID（如果有）
          if (response.default_tenant_id) {
            setTenantId(response.default_tenant_id);
          }

          // 更新用户状态
          setCurrentUser({
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            is_platform_admin: response.user.is_platform_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            tenant_id: response.default_tenant_id,
          });

          message.success('登录成功');
          navigate('/login/dashboard');
          return;
        }

        // 多组织：显示选择弹窗
        if (tenants.length > 1 || response.requires_tenant_selection) {
          setLoginResponse(response);
          setLoginCredentials(values); // 保存登录凭据，用于选择组织后重新登录
          setTenantSelectionVisible(true);
          return;
        }

        // 单组织：直接进入
        const selectedTenantId = response.user?.tenant_id || response.default_tenant_id || tenants[0]?.id;

        if (selectedTenantId) {
          setTenantId(selectedTenantId);

          // 更新用户状态
          setCurrentUser({
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            is_platform_admin: response.user.is_platform_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            tenant_id: selectedTenantId,
          });

          message.success('登录成功');

          // 使用 React Router 进行页面跳转
          const urlParams = new URL(window.location.href).searchParams;
          navigate(urlParams.get('redirect') || '/login/dashboard');
        } else {
          message.error('登录失败，无法确定组织');
        }
      } else {
        message.error('登录失败，请检查用户名和密码');
      }
    } catch (error: any) {
      // 提取错误信息（支持多种错误格式）
      let errorMessage = '登录失败，请稍后重试';

      if (error?.response?.data) {
        const errorData = error.response.data;
        // 统一错误格式 { success: false, error: { message: ... } }
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
        // FastAPI 错误格式 { detail: ... }
        else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        }
        // 旧格式 { message: ... }
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      // 如果 error 本身是 Error 对象
      else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    }
  };

  /**
   * 处理免注册体验登录
   *
   * 直接使用预设的体验账户登录，进入后台（只有浏览权限）
   */
  const handleGuestLogin = async () => {
    try {
      const response = await guestLogin();

      if (response && response.access_token) {
        // 保存 Token
        setToken(response.access_token);

        // 获取组织 ID
        const tenantId = response.user?.tenant_id || response.default_tenant_id;

        if (tenantId) {
          setTenantId(tenantId);

          // 更新用户状态
          setCurrentUser({
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            is_platform_admin: response.user.is_platform_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            tenant_id: tenantId,
          });

          message.success('体验登录成功（仅浏览权限）');

          // 跳转到首页
          const urlParams = new URL(window.location.href).searchParams;
          navigate(urlParams.get('redirect') || '/login/dashboard');
        } else {
          message.error('体验登录失败，无法确定组织');
        }
      } else {
        message.error('体验登录失败，请稍后重试');
      }
    } catch (error: any) {
      // 提取错误信息
      let errorMessage = '体验登录失败，请稍后重试';

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    }
  };

  /**
   * 处理组织选择
   *
   * 用户选择组织后，使用选中的 tenant_id 重新登录以获取包含该组织的 Token
   *
   * @param tenantId - 选中的组织 ID
   */
  const handleTenantSelect = async (tenantId: number) => {
    if (!loginResponse || !loginCredentials) {
      return;
    }

    try {
      // 使用选中的组织 ID 重新登录（后端会根据 tenant_id 生成新的 Token）
      const response = await login({
        username: loginCredentials.username,
        password: loginCredentials.password,
        tenant_id: tenantId, // 传递选中的组织 ID
      });

      if (response && response.access_token) {
        // 保存新的 Token（包含选中的组织 ID）
        setToken(response.access_token);

        // 保存组织 ID
        const selectedTenantId = response.user?.tenant_id || tenantId;
        setTenantId(selectedTenantId);

        // 更新用户状态
        setCurrentUser({
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          is_platform_admin: response.user.is_platform_admin,
          is_tenant_admin: response.user.is_tenant_admin,
          tenant_id: selectedTenantId,
        });

        setTenantSelectionVisible(false);
        setLoginResponse(null);
        setLoginCredentials(null);

        message.success('已选择组织');

        // 跳转到首页
        const urlParams = new URL(window.location.href).searchParams;
        navigate(urlParams.get('redirect') || '/dashboard');
      } else {
        message.error('选择组织失败，请重试');
      }
    } catch (error: any) {
      let errorMessage = '选择组织失败，请重试';

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    }
  };

  return (
    <div className="login-container">
      {/* 右上角工具栏（颜色切换、语言切换） */}
      <div
        className="login-toolbar"
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Tooltip
          title="切换主题颜色（待实现）"
          placement="bottomLeft"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
          overlayStyle={{ maxWidth: '200px' }}
        >
          <Button
            type="default"
            icon={<BgColorsOutlined />}
            onClick={() => {
              // 占位：后续实现主题切换功能
              message.info('主题切换功能待实现');
            }}
            style={{
              backgroundColor: '#fff',
              color: '#1890ff',
              borderColor: '#1890ff',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              minWidth: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Tooltip>
        <Tooltip
          title="切换语言（待实现）"
          placement="bottomLeft"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
          overlayStyle={{ maxWidth: '200px' }}
        >
          <Button
            type="default"
            icon={<GlobalOutlined />}
            onClick={() => {
              // 占位：后续实现语言切换功能
              message.info('语言切换功能待实现');
            }}
            style={{
              backgroundColor: '#fff',
              color: '#1890ff',
              borderColor: '#1890ff',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              minWidth: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Tooltip>
      </div>

      {/* LOGO 和框架名称（手机端显示在顶部） */}
      <div className="logo-header">
        <img 
          src="/img/logo.png" 
          alt="RiverEdge Logo" 
          className="logo-img"
          onError={(e) => {
            // 图片加载失败时，使用占位符
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement?.appendChild(
              Object.assign(document.createElement('div'), {
                className: 'logo-placeholder',
                style: {
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#1890ff',
                },
                textContent: 'RE',
              })
            );
          }}
        />
        <Title level={2} className="logo-title">RiverEdge SaaS</Title>
      </div>

      {/* 左侧品牌展示区（桌面端显示，手机端隐藏） */}
      <div className="login-left">
        {/* LOGO 和框架名称放在左上角（桌面端） */}
        <div className="logo-top-left">
          <img 
            src="/img/logo.png" 
            alt="RiverEdge Logo" 
            className="logo-img"
            onError={(e) => {
              // 图片加载失败时，使用占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.appendChild(
                Object.assign(document.createElement('div'), {
                  className: 'logo-placeholder',
                  style: {
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#1890ff',
                    marginRight: '16px',
                  },
                  textContent: 'RE',
                })
              );
            }}
          />
          <Title level={2} className="logo-title">RiverEdge SaaS</Title>
        </div>

        <div className="login-left-content">
          {/* 装饰图片显示在左侧上方 */}
          <img 
            src="/img/login.png" 
            alt="Login Decoration" 
            className="login-decoration-img"
            onError={(e) => {
              // 图片加载失败时，使用占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.appendChild(
                Object.assign(document.createElement('div'), {
                  className: 'login-placeholder',
                  style: {
                    width: '100%',
                    maxWidth: '600px',
                    height: '400px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '48px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginBottom: '40px',
                  },
                  textContent: '🚀',
                })
              );
            }}
          />

          {/* 框架简介显示在图片下方 */}
          <div className="login-description">
            <Title level={3} className="description-title">
              多组织管理框架
            </Title>
            <Text className="description-text">
              为企业提供安全、高效、可扩展的 SaaS 解决方案
            </Text>
          </div>
        </div>
      </div>

      {/* 右侧登录表单区 */}
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <Title level={2} className="form-title">欢迎登录</Title>
            <Text className="form-subtitle">请输入您的账号信息</Text>
          </div>

          <ProForm<LoginFormData>
            onFinish={handleSubmit}
            submitter={{
              searchConfig: {
                submitText: '登录',
              },
              submitButtonProps: {
                size: 'large',
                type: 'primary',
                style: {
                  width: '100%',
                  height: '40px',
                },
              },
            }}
            size="large"
          >
            <ProFormText
              name="username"
              rules={[
                {
                  required: true,
                  message: '请输入用户名',
                },
              ]}
              fieldProps={{
                size: 'large',
                prefix: <UserOutlined />,
                placeholder: '请输入用户名',
              }}
            />

            <ProFormText.Password
              name="password"
              rules={[
                {
                  required: true,
                  message: '请输入密码',
                },
              ]}
              fieldProps={{
                size: 'large',
                prefix: <LockOutlined />,
                placeholder: '请输入密码',
              }}
            />
          </ProForm>

          <div className="login-form-footer">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="default"
                size="large"
                icon={<ThunderboltOutlined />}
                block
                onClick={handleGuestLogin}
                style={{
                  height: '40px',
                  borderColor: '#1890ff',
                  color: '#1890ff',
                }}
              >
                免注册体验
              </Button>
            </div>
            <Text className="register-link">
              还没有账号？<Link to="/register">立即注册</Link>
            </Text>
          </div>

          {/* 底部链接（ICP备案、用户条款、隐私条款） */}
          <div className="login-footer-links">
            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>} size="small">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ICP备案：苏ICP备2021002752号-5
              </Text>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '12px', height: 'auto' }}
                onClick={() => {
                  setTermsModalType('user');
                  setTermsModalVisible(true);
                }}
              >
                用户条款
              </Button>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '12px', height: 'auto' }}
                onClick={() => {
                  setTermsModalType('privacy');
                  setTermsModalVisible(true);
                }}
              >
                隐私条款
              </Button>
            </Space>
          </div>
        </div>
      </div>

      {/* 组织选择弹窗 */}
      {loginResponse && (
        <TenantSelectionModal
          open={tenantSelectionVisible}
          tenants={loginResponse.tenants || []}
          defaultTenantId={loginResponse.default_tenant_id}
          onSelect={handleTenantSelect}
          onCancel={() => {
            setTenantSelectionVisible(false);
            // 取消选择时，清除 Token，返回登录页面
            setToken('');
            message.info('请重新登录');
          }}
        />
      )}

      {/* 条款弹窗 */}
      <TermsModal
        open={termsModalVisible}
        type={termsModalType}
        onClose={() => setTermsModalVisible(false)}
      />
    </div>
  );
}
