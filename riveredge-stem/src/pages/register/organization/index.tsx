/**
 * 组织注册页面
 * 
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：注册表单区
 */

import { ProForm, ProFormText, ProFormGroup } from '@ant-design/pro-components';
import { App, Typography, Space, Alert, Button, Modal } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, MailOutlined, ApartmentOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { registerOrganization, checkTenantExists, joinTenant, type TenantCheckResponse } from '@/services/register';
import { useState } from 'react';
import '../../login/index.less';
import './index.less';

const { Title, Text } = Typography;

/**
 * 组织注册表单数据接口
 */
interface OrganizationRegisterFormData {
  tenant_name: string;
  tenant_domain?: string;
  username: string;
  email?: string;
  password: string;
  confirm_password: string;
  full_name?: string;
}

/**
 * 组织注册页面组件
 */
export default function OrganizationRegisterPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [tenantCheckResult, setTenantCheckResult] = useState<TenantCheckResponse | null>(null);
  const [checkingTenant, setCheckingTenant] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinFormData, setJoinFormData] = useState<OrganizationRegisterFormData | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerResult, setRegisterResult] = useState<{ tenant_domain?: string; message?: string } | null>(null);

  /**
   * 检查组织是否存在
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
   * 处理申请加入组织
   * 
   * @param values - 表单数据
   */
  const handleJoinTenant = async (values: OrganizationRegisterFormData) => {
    if (!tenantCheckResult?.tenant_id) {
      message.error('组织信息无效');
      return;
    }

    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      // 提交申请加入组织
      const response = await joinTenant({
        tenant_id: tenantCheckResult.tenant_id,
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });

      if (response) {
        message.success(response.message || '申请提交成功，等待组织管理员审核');
        setJoinModalVisible(false);
        // 跳转到登录页
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error: any) {
      let errorMessage = '申请失败，请稍后重试';
      
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
   * 处理组织注册提交
   * 
   * 创建新组织，注册成功后提示等待审核
   * 如果组织已存在，显示申请加入选项
   * 
   * @param values - 表单数据
   */
  const handleSubmit = async (values: OrganizationRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      // 提交组织注册
      // 如果tenant_domain为空字符串，则传undefined让后端自动生成
      const response = await registerOrganization({
        tenant_name: values.tenant_name,
        tenant_domain: values.tenant_domain && values.tenant_domain.trim() ? values.tenant_domain.trim() : undefined,
        username: values.username,
        email: values.email,
        password: values.password,
      });

      if (response) {
        // 设置注册成功状态和结果
        setRegisterSuccess(true);
        setRegisterResult({
          tenant_domain: response.tenant_domain,
          message: response.message || '注册成功，等待管理员审核',
        });
      }
    } catch (error: any) {
      // 检查是否是组织已存在的错误（409 Conflict）
      if (error?.response?.status === 409 && error?.response?.data?.detail) {
        const errorDetail = error.response.data.detail;
        if (errorDetail.error === 'tenant_exists') {
          // 组织已存在，显示申请加入选项
          setTenantCheckResult({
            exists: true,
            tenant_id: errorDetail.tenant_id,
            tenant_name: errorDetail.tenant_name,
            tenant_domain: values.tenant_domain,
            tenant_status: errorDetail.tenant_status,
          });
          setJoinFormData(values);
          setJoinModalVisible(true);
          return;
        }
      }

      let errorMessage = '注册失败，请稍后重试';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        // 处理 FastAPI 标准错误格式 { detail: ... }
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (typeof errorData.detail === 'object' && errorData.detail.message) {
            errorMessage = errorData.detail.message;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } 
        // 处理统一错误格式 { error: { message: ... } }
        else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } 
        // 处理简单消息格式 { message: ... }
        else if (errorData.message) {
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
        <div className="login-form-wrapper organization-form-wrapper" style={{ maxWidth: '600px' }}>
          <div className="login-form-header">
            <Title level={2} className="form-title">组织注册</Title>
            <Text className="form-subtitle">创建专属组织</Text>
          </div>

          {/* 注册成功提示 */}
          {registerSuccess && registerResult && (
            <>
              <Alert
                message="注册成功"
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      {registerResult.message || '注册成功，等待管理员审核'}
                    </div>
                    {registerResult.tenant_domain && (
                      <div>
                        您的组织域名：<span style={{ color: '#1890ff', fontWeight: 500 }}>{registerResult.tenant_domain}</span>
                      </div>
                    )}
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                closable={false}
              />
              <Alert
                message="查看审核进度"
                description="您可以先用个人账户登录系统，查看组织审核进度。组织审核通过后，您可以使用刚才注册的管理员账号登录并管理组织。"
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
                closable={false}
              />
            </>
          )}

          {/* 注册说明（仅在未注册成功时显示） */}
          {!registerSuccess && (
            <Alert
              message="注册说明"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    • 提交注册后，需等待平台管理员审核，审核通过后即可使用
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    • 组织简称留空将自动生成8位随机域名，格式：riveredge.cn/xxxxx
                  </div>
                  <div>
                    • 请妥善保管管理员账号和密码，这是您管理组织的唯一凭证
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
              closable
            />
          )}

          {/* 组织存在提示 */}
          {tenantCheckResult?.exists && !joinModalVisible && !registerSuccess && (
            <Alert
              message={`组织 "${tenantCheckResult.tenant_name}" 已存在`}
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>
                    域名 <Text strong>{tenantCheckResult.tenant_domain}</Text> 已被使用
                  </Text>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                      setJoinModalVisible(true);
                    }}
                  >
                    申请加入
                  </Button>
                </Space>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
              closable
              onClose={() => setTenantCheckResult(null)}
            />
          )}

          {/* 注册表单（仅在未注册成功时显示） */}
          {!registerSuccess && (
            <ProForm<OrganizationRegisterFormData>
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
            <ProFormGroup title="组织信息">
              <ProFormText
                name="tenant_name"
                label="组织名称"
                placeholder="请输入组织名称（如：XX公司）"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    required: true,
                    message: '请输入组织名称',
                  },
                  {
                    min: 1,
                    max: 100,
                    message: '组织名称长度为 1-100 个字符',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <ApartmentOutlined />,
                }}
                extra="组织名称将显示在系统界面中，建议使用公司或团队名称"
              />
              <ProFormText
                name="tenant_domain"
                label="组织简称（可选）"
                placeholder="输入小写字母、数字或连字符"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    max: 100,
                    message: '组织简称长度不能超过 100 个字符',
                  },
                  {
                    pattern: /^[a-z0-9-]*$/,
                    message: '只能包含小写字母、数字和连字符（-）',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                    const domain = e.target.value;
                    if (domain && domain.trim().length > 0) {
                      handleCheckTenant(domain);
                    }
                  },
                }}
                extra="留空将自动生成8位随机域名，填写则使用自定义域名。完整域名格式：riveredge.cn/您的简称"
              />
            </ProFormGroup>

            <ProFormGroup title="管理员信息">
              <ProFormText
                name="username"
                label="管理员用户名"
                placeholder="请输入管理员用户名（3-50个字符）"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    required: true,
                    message: '请输入管理员用户名',
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
                }}
                extra="管理员用户名用于登录系统，注册后不可修改"
              />
              <ProFormText
                name="email"
                label="管理员邮箱（可选）"
                placeholder="请输入邮箱地址"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    type: 'email',
                    message: '请输入有效的邮箱地址',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <MailOutlined />,
                }}
                extra="用于接收系统通知、审核结果和找回密码"
              />
              <ProFormText.Password
                name="password"
                label="管理员密码"
                placeholder="请输入密码（至少8个字符）"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    required: true,
                    message: '请输入管理员密码',
                  },
                  {
                    min: 8,
                    message: '密码长度至少 8 个字符',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                extra="建议使用字母、数字和特殊字符组合"
              />
              <ProFormText.Password
                name="confirm_password"
                label="确认密码"
                placeholder="请再次输入密码"
                colProps={{ xs: 24, sm: 24, md: 12 }}
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
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
              />
            </ProFormGroup>
            </ProForm>
          )}

          <div className="login-form-footer">
            <Space>
              {registerSuccess ? (
                <>
                  <Button
                    type="primary"
                    onClick={() => navigate('/login')}
                  >
                    前往登录
                  </Button>
                  <Text type="secondary">|</Text>
                  <Link to="/register">返回注册选择</Link>
                </>
              ) : (
                <>
                  <Link to="/register">返回</Link>
                  <Text type="secondary">|</Text>
                  <Link to="/login">已有账号？登录</Link>
                </>
              )}
            </Space>
          </div>
        </div>
      </div>

      {/* 申请加入组织弹窗 */}
      <Modal
        title="申请加入组织"
        open={joinModalVisible}
        onCancel={() => {
          setJoinModalVisible(false);
          setJoinFormData(null);
        }}
        footer={null}
        width={600}
      >
        {tenantCheckResult?.exists && (
          <div style={{ marginBottom: 24 }}>
            <Alert
              message={`申请加入：${tenantCheckResult.tenant_name}`}
              description={`域名：${tenantCheckResult.tenant_domain}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Alert
              message="申请说明"
              description="提交申请后，需等待该组织的管理员审核。审核通过后，您将收到通知并可以使用系统。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          </div>
        )}

        {joinFormData && (
          <ProForm<OrganizationRegisterFormData>
            onFinish={handleJoinTenant}
            initialValues={joinFormData}
            submitter={{
              searchConfig: {
                submitText: '提交',
              },
              submitButtonProps: {
                size: 'large',
                type: 'primary',
                style: {
                  width: '100%',
                },
              },
              resetButtonProps: {
                style: { display: 'none' },
              },
            }}
            size="large"
          >
            <ProFormGroup title="用户信息">
              <ProFormText
                name="username"
                label="用户名"
                placeholder="请输入用户名（3-50个字符）"
                colProps={{ xs: 24, sm: 24, md: 12 }}
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
                }}
                extra="用户名用于登录系统，注册后不可修改"
              />
              <ProFormText
                name="email"
                label="邮箱（可选）"
                placeholder="请输入邮箱地址"
                colProps={{ xs: 24, sm: 24, md: 12 }}
                rules={[
                  {
                    type: 'email',
                    message: '请输入有效的邮箱地址',
                  },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <MailOutlined />,
                }}
                extra="用于接收审核结果通知和找回密码"
              />
              <ProFormText.Password
                name="password"
                label="密码"
                placeholder="请输入密码（至少8个字符）"
                colProps={{ xs: 24, sm: 24, md: 12 }}
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
                }}
                extra="建议使用字母、数字和特殊字符组合，提高账号安全性"
              />
              <ProFormText.Password
                name="confirm_password"
                label="确认密码"
                placeholder="请再次输入密码以确认"
                colProps={{ xs: 24, sm: 24, md: 12 }}
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
                }}
              />
            </ProFormGroup>
          </ProForm>
        )}
      </Modal>
    </div>
  );
}
