/**
 * 登录页面
 * 
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：登录表单区
 */

import { ProForm, ProFormText } from '@ant-design/pro-components';
import { App, Typography } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '@/services/auth';
import { setToken, setTenantId } from '@/utils/auth';
import useUserModel from '@/models/user';
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
  // 使用自定义 hooks 管理用户状态（Zustand状态管理规范）
  const { setCurrentUser } = useUserModel();
  
  /**
   * 处理登录提交
   * 
   * 登录成功后更新用户状态，然后刷新页面以触发 getInitialState
   * 
   * @param values - 表单数据
   */
  const handleSubmit = async (values: LoginFormData) => {
    try {
      const response = await login(values);

      if (response && response.access_token) {
        // 保存 Token
        setToken(response.access_token);

        // 保存租户 ID
        if (response.user?.tenant_id) {
          setTenantId(response.user.tenant_id);
        } else if (response.default_tenant_id) {
          setTenantId(response.default_tenant_id);
        }

        // 更新用户状态（getInitialState 会在页面刷新时自动获取）
        setCurrentUser({
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          is_superuser: response.user.is_superuser,
          is_tenant_admin: response.user.is_tenant_admin,
          tenant_id: response.user.tenant_id,
        });

        message.success('登录成功');

        // 使用 React Router 进行页面跳转
        const urlParams = new URL(window.location.href).searchParams;
        // 跳转到指定页面或默认dashboard
        navigate(urlParams.get('redirect') || '/dashboard');
      } else {
        message.error('登录失败，请检查用户名和密码');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || '登录失败，请稍后重试';
      message.error(errorMessage);
    }
  };
  
  return (
    <div className="login-container">
      {/* 左侧品牌展示区 */}
      <div className="login-left">
        {/* LOGO 和框架名称放在左上角 */}
        <div className="logo-top-left">
          <img src="/logo.png" alt="RiverEdge Logo" className="logo-img" />
          <Title level={2} className="logo-title">RiverEdge SaaS</Title>
        </div>
        
        <div className="login-left-content">
          {/* 装饰图片显示在左侧上方 */}
          <img src="/login.png" alt="Login Decoration" className="login-decoration-img" />
          
          {/* 框架简介显示在图片下方 */}
          <div className="login-description">
            <Title level={3} className="description-title">
              多租户管理框架
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
            <Text className="register-link">
              还没有账号？<Link to="/register">立即注册</Link>
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

