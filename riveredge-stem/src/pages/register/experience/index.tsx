/**
 * 个人注册页面
 * 
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：注册表单区
 */

import { ProForm, ProFormText, ProFormGroup } from '@ant-design/pro-components';
import { App, Typography, Space, Alert } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, MailOutlined, ApartmentOutlined } from '@ant-design/icons';
import { registerPersonal, checkTenantExists, type TenantCheckResponse } from '@/services/register';
import { login } from '@/services/auth';
import { setToken, setTenantId } from '@/utils/auth';
import { useGlobalStore } from '@/app';
import { useState } from 'react';
import '../../login/index.less';

const { Title, Text } = Typography;

/**
 * 个人注册表单数据接口
 */
interface PersonalRegisterFormData {
  username: string;
  email?: string;
  password: string;
  confirm_password: string;
  full_name?: string;
  tenant_domain?: string; // 可选，组织域名，如果提供则在指定组织中创建用户，否则在默认组织中创建
  invite_code?: string; // 可选，如果同时提供组织域名和邀请码，则直接注册成功
}

/**
 * 个人注册页面组件
 */
export default function PersonalRegisterPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { setCurrentUser } = useGlobalStore();
  const [tenantCheckResult, setTenantCheckResult] = useState<TenantCheckResponse | null>(null);
  const [checkingTenant, setCheckingTenant] = useState(false);

  /**
   * 检查组织是否存在（通过域名）
   * 
   * @param domain - 组织域名
   */
  const handleCheckTenant = async (domain: string) => {
    if (!domain || domain.trim().length === 0) {
      setTenantCheckResult(null);
      return;
    }

    setCheckingTenant(true);
    try {
      const result = await checkTenantExists(domain);
      setTenantCheckResult(result);
    } catch (error: any) {
      setTenantCheckResult(null);
      // 检查失败不影响注册流程，静默处理
    } finally {
      setCheckingTenant(false);
    }
  };

  /**
   * 处理个人注册提交
   * 
   * 在指定组织或默认组织中创建用户，注册成功后自动登录
   * 如果提供了 tenant_domain，则先通过域名查找组织ID，然后在指定组织中创建用户；否则在默认组织中创建用户
   * 
   * @param values - 表单数据
   */
  const handleSubmit = async (values: PersonalRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      // 如果提供了组织域名，先查找组织ID
      let tenant_id: number | undefined = undefined;
      if (values.tenant_domain && values.tenant_domain.trim().length > 0) {
        // 提取域名部分（去掉 riveredge.cn/ 前缀）
        const domainPart = values.tenant_domain.replace(/^.*\//, '').trim();
        if (domainPart) {
          const checkResult = await checkTenantExists(domainPart);
          if (!checkResult.exists || !checkResult.tenant_id) {
            message.error('组织域名不存在，请检查后重试');
            return;
          }
          tenant_id = checkResult.tenant_id;
        }
      }

      // 提交个人注册
      const registerResponse = await registerPersonal({
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        tenant_id: tenant_id, // 通过域名查找得到的组织ID
        invite_code: values.invite_code, // 可选，如果同时提供组织域名和邀请码，则直接注册成功
      });

      if (registerResponse) {
        message.success('注册成功，正在自动登录...');

        // 注册成功后自动登录
        try {
          const loginResponse = await login({
            username: values.username,
            password: values.password,
          });

          if (loginResponse && loginResponse.access_token) {
            // 保存 Token
            setToken(loginResponse.access_token);

            // 保存组织 ID
            const tenantId = loginResponse.user?.tenant_id || loginResponse.default_tenant_id;
            if (tenantId) {
              setTenantId(tenantId);
            }

            // 更新用户状态
            setCurrentUser({
              id: loginResponse.user.id,
              username: loginResponse.user.username,
              email: loginResponse.user.email,
              is_platform_admin: loginResponse.user.is_platform_admin,
              is_tenant_admin: loginResponse.user.is_tenant_admin,
              tenant_id: tenantId,
            });

            message.success('登录成功');

            // 跳转到首页
            navigate('/dashboard');
          }
        } catch (loginError: any) {
          message.warning('注册成功，但自动登录失败，请手动登录');
          navigate('/login');
        }
      }
    } catch (error: any) {
      let errorMessage = '注册失败，请稍后重试';
      
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
      {/* LOGO 和框架名称（手机端显示在顶部） */}
      <div className="logo-header">
        <img src="/logo.png" alt="RiverEdge Logo" className="logo-img" />
        <Title level={2} className="logo-title">RiverEdge SaaS</Title>
      </div>

      {/* 左侧品牌展示区（桌面端显示，手机端隐藏） */}
      <div className="login-left">
        {/* LOGO 和框架名称放在左上角（桌面端） */}
        <div className="logo-top-left">
          <img src="/logo.png" alt="RiverEdge Logo" className="logo-img" />
          <Title level={2} className="logo-title">RiverEdge SaaS</Title>
        </div>
        
        <div className="login-left-content">
          {/* 装饰图片显示在左侧上方 */}
          <img src="/login.png" alt="Register Decoration" className="login-decoration-img" />
          
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

      {/* 右侧注册表单区 */}
      <div className="login-right">
        <div className="login-form-wrapper" style={{ maxWidth: '600px' }}>
          <div className="login-form-header">
            <Title level={2} className="form-title">个人注册</Title>
            <Text className="form-subtitle">创建个人账户，立即开始使用</Text>
          </div>

          <Alert
            message="注册说明"
            description={
              <div>
                <div style={{ marginBottom: 8 }}>
                  • 注册成功后立即可以使用，无需等待审核
                </div>
                <div style={{ marginBottom: 8 }}>
                  • 填写组织域名可申请加入指定组织，不填写则自动加入默认组织
                </div>
                <div>
                  • 如果填写了组织域名和邀请码，注册后可直接使用，无需等待审核
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            closable
          />

          <ProForm<PersonalRegisterFormData>
            onFinish={handleSubmit}
            submitter={{
              searchConfig: {
                submitText: '注册',
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
            <ProFormGroup title="用户信息">
              <ProFormText
                name="username"
                label="用户名"
                rules={[
                  {
                    required: true,
                    message: '请输入用户名',
                  },
                  {
                    min: 3,
                    max: 50,
                    message: '用户名长度为 3-50 个字符',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />,
                  placeholder: '请输入用户名（3-50个字符）',
                }}
                extra="用户名用于登录，注册后不可修改"
              />

              <ProFormText
                name="email"
                label="邮箱（可选）"
                rules={[
                  {
                    type: 'email',
                    message: '请输入有效的邮箱地址',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <MailOutlined />,
                  placeholder: '请输入邮箱地址',
                }}
                extra="用于接收系统通知和找回密码"
              />

              <ProFormText.Password
                name="password"
                label="密码"
                rules={[
                  {
                    required: true,
                    message: '请输入密码',
                  },
                  {
                    min: 8,
                    message: '密码长度至少 8 个字符',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                  placeholder: '请输入密码（至少8个字符）',
                }}
                extra="建议使用字母、数字和特殊字符组合"
              />

              <ProFormText.Password
                name="confirm_password"
                label="确认密码"
                rules={[
                  {
                    required: true,
                    message: '请再次输入密码',
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致，请重新输入'));
                    },
                  }),
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                  placeholder: '请再次输入密码以确认',
                }}
              />
            </ProFormGroup>

            <ProFormGroup title="组织信息（可选）">
              <ProFormText
                name="tenant_domain"
                label="组织代码（可选）"
                placeholder="输入组织简称"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    max: 100,
                    message: '组织域名长度不能超过 100 个字符',
                  },
                  {
                    pattern: /^[a-z0-9-]*$/,
                    message: '只能包含小写字母、数字和连字符',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <ApartmentOutlined />,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const domain = e.target.value;
                    // 如果输入框为空，清空提示信息
                    if (!domain || domain.trim().length === 0) {
                      setTenantCheckResult(null);
                    }
                  },
                  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                    const domain = e.target.value;
                    if (domain && domain.trim().length > 0) {
                      // 提取域名部分（去掉 riveredge.cn/ 前缀）
                      const domainPart = domain.replace(/^.*\//, '').trim();
                      if (domainPart) {
                        handleCheckTenant(domainPart);
                      }
                    } else {
                      // 如果输入框为空，清空提示信息
                      setTenantCheckResult(null);
                    }
                  },
                }}
                extra={
                  <div>
                    <div style={{ marginBottom: tenantCheckResult ? 4 : 0 }}>
                      填写组织代码可申请加入指定组织，不填写则自动加入默认组织。
                    </div>
                    {/* 组织存在提示 */}
                    {tenantCheckResult?.exists && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="success" style={{ fontSize: 12 }}>
                          ✓ 找到组织：{tenantCheckResult.tenant_name}
                        </Text>
                      </div>
                    )}
                    {tenantCheckResult && !tenantCheckResult.exists && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="danger" style={{ fontSize: 12 }}>
                          ✗ 组织域名不存在
                        </Text>
                      </div>
                    )}
                  </div>
                }
              />
              <ProFormText
                name="invite_code"
                label="邀请码（可选）"
                placeholder="输入组织提供的邀请码"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    max: 100,
                    message: '邀请码长度不能超过 100 个字符',
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      // 如果填写了邀请码，必须同时填写组织域名
                      if (value && !getFieldValue('tenant_domain')) {
                        return Promise.reject(new Error('使用邀请码时，必须同时填写组织域名'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
                fieldProps={{
                  size: 'large',
                }}
                extra="填写邀请码可免审核直接加入组织，需同时填写组织域名"
              />
            </ProFormGroup>
          </ProForm>

          <div className="login-form-footer">
            <Space>
              <Link to="/register">返回</Link>
              <Text type="secondary">|</Text>
              <Link to="/login">已有账号？登录</Link>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}
