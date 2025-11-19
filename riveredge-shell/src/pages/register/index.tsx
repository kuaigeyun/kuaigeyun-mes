/**
 * 租户注册页面
 * 
 * 用于新租户注册，包含租户信息和管理员信息。
 * 注册成功后，租户状态为未激活，需要超级管理员审核。
 */

import { ProForm, ProFormText } from '@ant-design/pro-components';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { registerTenant } from '@/services/register';
import './index.less';

/**
 * 租户注册表单数据接口
 */
interface RegisterFormData {
  tenant_name: string;
  tenant_domain: string;
  username: string;
  email?: string;
  password: string;
  confirm_password: string;
  full_name?: string;
}

/**
 * 租户注册页面组件
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  
  /**
   * 处理注册提交
   * 
   * @param values - 表单数据
   */
  const handleSubmit = async (values: RegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }
      
      // 提交注册
      const response = await registerTenant({
        tenant_name: values.tenant_name,
        tenant_domain: values.tenant_domain,
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });
      
      if (response) {
        message.success(response.message || '注册成功，等待管理员审核');
        // 跳转到登录页
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (error: any) {
      message.error(error.message || '注册失败，请稍后重试');
    }
  };
  
  return (
    <div className="register-container">
      <div className="register-box">
        <div className="register-header">
          <h1>RiverEdge SaaS</h1>
          <p>租户注册</p>
        </div>
        
        <ProForm<RegisterFormData>
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: '注册',
            },
            submitButtonProps: {
              size: 'large',
              style: {
                width: '100%',
              },
            },
          }}
        >
          <div className="form-section">
            <h3>租户信息</h3>
            <ProFormText
              name="tenant_name"
              label="租户名称"
              placeholder="请输入租户名称"
              rules={[
                {
                  required: true,
                  message: '请输入租户名称',
                },
                {
                  min: 1,
                  max: 100,
                  message: '租户名称长度为 1-100 字符',
                },
              ]}
              fieldProps={{
                size: 'large',
              }}
            />
            <ProFormText
              name="tenant_domain"
              label="租户域名"
              placeholder="请输入租户域名（用于子域名访问）"
              rules={[
                {
                  required: true,
                  message: '请输入租户域名',
                },
                {
                  min: 1,
                  max: 100,
                  message: '租户域名长度为 1-100 字符',
                },
                {
                  pattern: /^[a-z0-9-]+$/,
                  message: '域名只能包含小写字母、数字和连字符',
                },
              ]}
              fieldProps={{
                size: 'large',
              }}
              extra="域名将用于子域名访问，例如：your-domain.riveredge.com"
            />
          </div>
          
          <div className="form-section">
            <h3>管理员信息</h3>
            <ProFormText
              name="username"
              label="管理员用户名"
              placeholder="请输入管理员用户名"
              rules={[
                {
                  required: true,
                  message: '请输入管理员用户名',
                },
                {
                  min: 3,
                  max: 50,
                  message: '用户名长度为 3-50 字符',
                },
              ]}
              fieldProps={{
                size: 'large',
              }}
            />
            <ProFormText
              name="email"
              label="管理员邮箱（可选）"
              placeholder="请输入管理员邮箱（可选）"
              rules={[
                {
                  type: 'email',
                  message: '请输入有效的邮箱地址',
                },
              ]}
              fieldProps={{
                size: 'large',
              }}
            />
            <ProFormText
              name="password"
              label="管理员密码"
              placeholder="请输入管理员密码"
              fieldProps={{
                type: 'password',
                size: 'large',
              }}
              rules={[
                {
                  required: true,
                  message: '请输入管理员密码',
                },
                {
                  min: 8,
                  message: '密码长度至少 8 字符',
                },
              ]}
            />
            <ProFormText
              name="confirm_password"
              label="确认密码"
              placeholder="请再次输入密码"
              fieldProps={{
                type: 'password',
                size: 'large',
              }}
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
            />
            <ProFormText
              name="full_name"
              label="管理员全名（可选）"
              placeholder="请输入管理员全名（可选）"
              fieldProps={{
                size: 'large',
              }}
            />
          </div>
          
          <div className="register-tips">
            <p>注册说明：</p>
            <ul>
              <li>注册成功后，租户状态为未激活，需要超级管理员审核后才能使用</li>
              <li>请妥善保管管理员账号和密码</li>
              <li>租户域名一旦注册，无法修改</li>
            </ul>
          </div>
        </ProForm>
        
        <div className="register-footer">
          <a onClick={() => navigate('/login')}>已有账号？立即登录</a>
        </div>
      </div>
    </div>
  );
}

