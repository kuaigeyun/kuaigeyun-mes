/**
 * 登录页面
 *
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：登录表单区
 */

import { ProForm, ProFormText, ProFormGroup } from '@ant-design/pro-components';
import { App, Typography, Button, Space, Tooltip, ConfigProvider, Card, Row, Col, Drawer, Alert, AutoComplete, Input } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { UserOutlined, LockOutlined, ThunderboltOutlined, GlobalOutlined, UserAddOutlined, ApartmentOutlined, ArrowLeftOutlined, MailOutlined, MobileOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import loginAnimation from '../../../static/lottie/login.json';
import { registerPersonal, registerOrganization, checkTenantExists, searchTenants, sendVerificationCode, type TenantCheckResponse, type TenantSearchOption, type OrganizationRegisterRequest, type SendVerificationCodeRequest } from '../../services/register';
import { login, guestLogin, wechatLoginCallback, type LoginResponse } from '../../services/auth';
import { setToken, setTenantId, setUserInfo } from '../../utils/auth';
import { useGlobalStore } from '../../stores';
import { TenantSelectionModal, TermsModal, LongPressVerify } from '../../components';
import { theme } from 'antd';
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
  const { token } = theme.useToken(); // 获取主题 token
  // 使用全局状态管理（Zustand状态管理规范）
  const { setCurrentUser } = useGlobalStore();

  // 组织选择弹窗状态
  const [tenantSelectionVisible, setTenantSelectionVisible] = useState(false);
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<LoginFormData | null>(null);

  // 条款弹窗状态
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [termsModalType, setTermsModalType] = useState<'user' | 'privacy'>('user');

  // 注册抽屉状态
  const [registerDrawerVisible, setRegisterDrawerVisible] = useState(false);
  const [registerType, setRegisterType] = useState<'select' | 'personal' | 'organization'>('select');

  
  // 个人注册表单状态
  const [tenantCheckResult, setTenantCheckResult] = useState<TenantCheckResponse | null>(null);
  const [checkingTenant, setCheckingTenant] = useState(false);
  const [tenantSearchOptions, setTenantSearchOptions] = useState<TenantSearchOption[]>([]);
  const [searchingTenant, setSearchingTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantSearchOption | null>(null);

  // 频繁操作检测状态
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [loginFailTimes, setLoginFailTimes] = useState<number[]>([]);
  const [requireVerification, setRequireVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // 频繁操作阈值：5分钟内失败3次触发验证
  const FAIL_COUNT_THRESHOLD = 3;
  const TIME_WINDOW = 5 * 60 * 1000; // 5分钟
  
  /**
   * 根据失败次数计算长按验证时间（递增惩罚机制）
   * 
   * @param failCount - 失败次数
   * @returns 长按验证时间（毫秒）
   */
  const calculateVerifyDuration = (failCount: number): number => {
    // 基础时间 2 秒
    const baseDuration = 2000;
    
    // 递增惩罚规则：
    // 3-4 次：2 秒
    // 5-6 次：3 秒
    // 7-8 次：5 秒
    // 9-10 次：8 秒
    // 11 次及以上：10 秒
    if (failCount <= 4) {
      return baseDuration; // 2 秒
    } else if (failCount <= 6) {
      return 3000; // 3 秒
    } else if (failCount <= 8) {
      return 5000; // 5 秒
    } else if (failCount <= 10) {
      return 8000; // 8 秒
    } else {
      return 10000; // 10 秒（最大）
    }
  };
  
  // localStorage 键名
  const STORAGE_KEY = 'login_fail_times';
  const VERIFIED_KEY = 'login_verified_token'; // 验证通过后的令牌
  
  /**
   * 个人注册表单数据接口
   */
  interface PersonalRegisterFormData {
    username: string;
    phone: string;
    phone_verification_code: string;
    email?: string;
    password: string;
    confirm_password: string;
    full_name?: string;
    tenant_domain?: string;
    invite_code?: string;
  }
  
  /**
   * 组织注册表单数据接口
   */
  interface OrganizationRegisterFormData {
    tenant_name: string;
    phone: string;
    password: string;
    confirm_password: string;
    tenant_domain?: string;
    email?: string;
  }
  
  /**
   * 搜索组织（支持组织代码或组织名模糊搜索）
   */
  const handleSearchTenant = async (keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setTenantSearchOptions([]);
      setSelectedTenant(null);
      setTenantCheckResult(null);
      return;
    }

    setSearchingTenant(true);
    try {
      const result = await searchTenants(keyword.trim());
      setTenantSearchOptions(result.items || []);
      
      // 如果找到唯一匹配的组织，自动选中
      if (result.items && result.items.length === 1) {
        setSelectedTenant(result.items[0]);
        setTenantCheckResult({
          exists: true,
          tenant_id: result.items[0].tenant_id,
          tenant_name: result.items[0].tenant_name,
        });
      } else if (result.items && result.items.length > 1) {
        // 多个匹配，不自动选中
        setSelectedTenant(null);
        setTenantCheckResult(null);
      } else {
        // 没有找到
        setSelectedTenant(null);
        setTenantCheckResult(null);
      }
    } catch (error: any) {
      setTenantSearchOptions([]);
      setSelectedTenant(null);
      setTenantCheckResult(null);
    } finally {
      setSearchingTenant(false);
    }
  };

  /**
   * 选择组织
   */
  const handleSelectTenant = (value: string, option: any) => {
    const tenant = option.tenant || tenantSearchOptions.find(t => 
      t.tenant_id === option.value || 
      t.tenant_domain === value || 
      t.tenant_name === value
    );
    if (tenant) {
      setSelectedTenant(tenant);
      setTenantCheckResult({
        exists: true,
        tenant_id: tenant.tenant_id,
        tenant_name: tenant.tenant_name,
      });
    }
  };
  
  /**
   * 处理个人注册提交
   */
  const handlePersonalRegister = async (values: PersonalRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      // 如果选择了组织，使用选中的组织ID
      let tenant_id: number | undefined = undefined;
      if (selectedTenant && selectedTenant.tenant_id) {
        tenant_id = selectedTenant.tenant_id;
      } else if (values.tenant_domain && values.tenant_domain.trim().length > 0) {
        // 如果没有选中组织但输入了组织代码，提示用户选择
        message.warning('请从搜索结果中选择一个组织，或清空输入框以注册到默认组织');
        return;
      }
      // 如果不填写组织代码，tenant_id 为 undefined，将注册到默认组织

      // 临时跳过验证码验证（待短信服务完全接入后启用）
      // TODO: 实现真实的验证码验证逻辑
      if (!values.phone_verification_code || values.phone_verification_code.trim() === '') {
      } else {
        // 这里可以添加简单的格式验证
        if (!/^\d{6}$/.test(values.phone_verification_code)) {
          message.error('验证码格式不正确，应为6位数字');
          return;
        }
      }

      // 提交个人注册
      const registerResponse = await registerPersonal({
        username: values.username,
        phone: values.phone,
        email: values.email && values.email.trim() !== '' ? values.email : undefined,
        password: values.password,
        full_name: values.full_name && values.full_name.trim() !== '' ? values.full_name : undefined,
        tenant_id: tenant_id,
        invite_code: values.invite_code,
      });

      if (registerResponse) {
        message.success('注册成功，正在自动登录...');

        // 注册成功后自动登录
        try {
          const loginResponse = await login({
            username: values.username,
            password: values.password,
            tenant_id: tenant_id,
          });

          if (loginResponse && loginResponse.access_token) {
            setToken(loginResponse.access_token);
            // 优先使用登录响应中的 tenant_id（因为 Token 中包含的组织上下文）
            const tenantId = loginResponse.user?.tenant_id || tenant_id || loginResponse.default_tenant_id;
            if (tenantId) {
              setTenantId(tenantId);
            }
            
            // 从 tenants 数组中查找对应的租户名称
            const tenants = loginResponse.tenants || [];
            const selectedTenant = tenants.find(t => t.id === tenantId);
            const tenantName = selectedTenant?.name || '';

            const userInfo = {
              id: loginResponse.user.id,
              username: loginResponse.user.username,
              email: loginResponse.user.email,
              full_name: loginResponse.user.full_name,
              is_infra_admin: loginResponse.user.is_infra_admin,
              is_tenant_admin: loginResponse.user.is_tenant_admin,
              tenant_id: tenantId,
              tenant_name: tenantName,
              user_type: 'user',
            };
      setCurrentUser(userInfo);
      setUserInfo(userInfo);
      setRegisterDrawerVisible(false);
      setRegisterType('select');
      // 延迟执行消息提示和导航，避免阻塞主线程
      setTimeout(() => {
        message.success('登录成功');
        navigate('/system/dashboard', { replace: true });
      }, 0);
          }
        } catch (loginError: any) {
          message.warning('注册成功，但自动登录失败，请手动登录');
          setRegisterDrawerVisible(false);
          setRegisterType('select');
        }
      }
    } catch (error: any) {
      let errorMessage = '注册失败，请稍后重试';
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
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
   */
  const handleOrganizationRegister = async (values: OrganizationRegisterFormData) => {
    try {
      // 验证密码确认
      if (values.password !== values.confirm_password) {
        message.error('两次输入的密码不一致');
        return;
      }

      // 提交组织注册（极简表单：组织名称、手机号、密码）
      const registerResponse = await registerOrganization({
        tenant_name: values.tenant_name,
        phone: values.phone,
        password: values.password,
        tenant_domain: values.tenant_domain,
        email: values.email,
      });

      if (registerResponse && registerResponse.success) {
        message.success('注册成功，正在自动登录...');

        // 注册成功后自动登录（使用手机号作为用户名）
        try {
          const loginResponse = await login({
            username: values.phone,  // 手机号即账号
            password: values.password,
            tenant_id: registerResponse.tenant_id,
          });

          if (loginResponse && loginResponse.access_token) {
            setToken(loginResponse.access_token);
            // 优先使用登录响应中的 tenant_id（因为 Token 中包含的组织上下文）
            const tenantId = loginResponse.user?.tenant_id || registerResponse.tenant_id || loginResponse.default_tenant_id;
            if (tenantId) {
              setTenantId(tenantId);
            }
            
            // 从 tenants 数组中查找对应的租户名称
            const tenants = loginResponse.tenants || [];
            const selectedTenant = tenants.find(t => t.id === tenantId);
            const tenantName = selectedTenant?.name || '';

            const userInfo = {
              id: loginResponse.user.id,
              username: loginResponse.user.username,
              email: loginResponse.user.email,
              full_name: loginResponse.user.full_name,
              is_infra_admin: loginResponse.user.is_infra_admin,
              is_tenant_admin: loginResponse.user.is_tenant_admin,
              tenant_id: tenantId,
              tenant_name: tenantName,
              user_type: 'user',
            };
      setCurrentUser(userInfo);
      setUserInfo(userInfo);
      setRegisterDrawerVisible(false);
      setRegisterType('select');
      // 延迟执行消息提示和导航，避免阻塞主线程
      // 新注册的组织跳转到初始化向导
      setTimeout(() => {
        message.success('登录成功');
        navigate('/init/wizard', { replace: true });
      }, 0);
          }
        } catch (loginError: any) {
          message.warning('注册成功，但自动登录失败，请手动登录');
          setRegisterDrawerVisible(false);
          setRegisterType('select');
        }
      }
    } catch (error: any) {
      let errorMessage = '注册失败，请稍后重试';
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    }
  };

  // 固定主题颜色（不受全局主题影响）
  const fixedThemeColor = '#1890ff';

  /**
   * 处理登录成功后的逻辑
   * 
   * 统一处理登录成功后的逻辑，包括：
   * - 保存 Token
   * - 判断组织数量并处理跳转
   * - 更新用户状态
   * 
   * @param response - 登录响应数据
   * @param credentials - 登录凭据（用于多组织选择后重新登录）
   */
  const handleLoginSuccess = (response: LoginResponse, credentials?: LoginFormData) => {
    if (!response || !response.access_token) {
      message.error('登录失败，请检查用户名和密码');
      return;
    }

    // 保存 Token
    setToken(response.access_token);

    // 判断组织数量
    const tenants = response.tenants || [];
    const isPlatformAdmin = response.user?.is_infra_admin || false;

    // 平台管理：直接进入
    if (isPlatformAdmin) {
      // 保存组织 ID（如果有）
      if (response.default_tenant_id) {
        setTenantId(response.default_tenant_id);
      }

      // 从 tenants 数组中查找对应的租户名称（平台管理员可能没有租户）
      const tenantName = response.default_tenant_id && tenants.length > 0 
        ? tenants.find(t => t.id === response.default_tenant_id)?.name || ''
        : '';

      // 更新用户状态
      const userInfo = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        full_name: response.user.full_name,
        is_infra_admin: response.user.is_infra_admin,
        is_tenant_admin: response.user.is_tenant_admin,
        tenant_id: response.default_tenant_id,
        tenant_name: tenantName,
        user_type: 'infra_superadmin',
      };
      setCurrentUser(userInfo);
      setUserInfo(userInfo);

      // 触发用户登录事件，通知布局组件清除菜单缓存
      window.dispatchEvent(new CustomEvent('user-logged-in'));
      
      // 延迟执行消息提示和导航，避免阻塞主线程
      setTimeout(() => {
        message.success('登录成功');
        navigate('/system/dashboard');
      }, 0);
      return;
    }

    // 多组织：显示选择弹窗
    if (tenants.length > 1 || response.requires_tenant_selection) {
      setLoginResponse(response);
      if (credentials) {
        setLoginCredentials(credentials);
      }
      setTenantSelectionVisible(true);
      return;
    }

    // 单组织：直接进入
    const selectedTenantId = response.user?.tenant_id || response.default_tenant_id || tenants[0]?.id;

    if (selectedTenantId) {
      setTenantId(selectedTenantId);

      // 从 tenants 数组中查找对应的租户名称
      const selectedTenant = tenants.find(t => t.id === selectedTenantId);
      const tenantName = selectedTenant?.name || '';

      // 更新用户状态
      const userInfo = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        full_name: response.user.full_name,
        is_infra_admin: response.user.is_infra_admin,
        is_tenant_admin: response.user.is_tenant_admin,
        tenant_id: selectedTenantId,
        tenant_name: tenantName,
        user_type: 'user',
      };
      setCurrentUser(userInfo);
      setUserInfo(userInfo);

      // 触发用户登录事件，通知布局组件清除菜单缓存
      window.dispatchEvent(new CustomEvent('user-logged-in'));
      
      // 延迟执行消息提示和导航，避免阻塞主线程
      const urlParams = new URL(window.location.href).searchParams;
      setTimeout(() => {
        message.success('登录成功');
        navigate(urlParams.get('redirect') || '/system/dashboard');
      }, 0);
    } else {
      message.error('登录失败，无法确定组织');
    }
  };

  /**
   * 处理微信登录
   * 
   * 跳转到微信授权页面
   */
  const handleWechatLogin = async () => {
    try {
      // 微信授权 URL
      // 注意：需要配置微信开放平台的 AppID 和回调地址
      // 优先从环境变量获取，如果没有则提示配置
      // 从环境变量获取微信 AppID（需要在 .env 文件中配置 VITE_WECHAT_APPID）
      const WECHAT_APPID = (import.meta as any).env?.VITE_WECHAT_APPID || '';
      
      // 如果 AppID 未配置，提示用户
      if (!WECHAT_APPID) {
        message.warning('微信登录功能未配置，请联系管理员配置 VITE_WECHAT_APPID');
        return;
      }

      // 生成回调地址（前端地址）
      const redirectUri = encodeURIComponent(`${window.location.origin}/login?provider=wechat`);
      
      // 生成随机 state，用于防止 CSRF 攻击
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // 保存 state 到 sessionStorage，用于回调时验证
      sessionStorage.setItem('wechat_login_state', state);

      // 跳转到微信授权页面
      // 微信开放平台网站应用授权地址
      const wechatAuthUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${WECHAT_APPID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
      window.location.href = wechatAuthUrl;
    } catch (error: any) {
      message.error('微信登录跳转失败，请稍后重试');
    }
  };

  /**
   * 处理社交登录
   * 
   * @param provider - 社交登录提供商（wechat, qq, wechat_work, dingtalk, feishu）
   */
  const handleSocialLogin = (provider: 'wechat' | 'qq' | 'wechat_work' | 'dingtalk' | 'feishu') => {
    if (provider === 'wechat') {
      handleWechatLogin();
    }
  };

  /**
   * 处理微信登录回调
   * 
   * 从 URL 中获取 code 和 state，验证后调用后端 API 完成登录
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const provider = urlParams.get('provider');

    // 检查是否是微信登录回调
    if (provider === 'wechat' && code && state) {
      // 验证 state（防止 CSRF 攻击）
      const savedState = sessionStorage.getItem('wechat_login_state');
      if (savedState !== state) {
        message.error('微信登录验证失败，请重试');
        // 清除 URL 参数，避免重复处理
        window.history.replaceState({}, '', '/login');
        return;
      }

      // 清除 state
      sessionStorage.removeItem('wechat_login_state');

      // 调用后端 API 完成登录
      const handleWechatCallback = async () => {
        try {
          message.loading('正在登录...', 0);
          const response = await wechatLoginCallback(code);
          message.destroy();
          handleLoginSuccess(response);
        } catch (error: any) {
          message.destroy();
          let errorMessage = '微信登录失败，请稍后重试';
          
          if (error?.response?.data) {
            const errorData = error.response.data;
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.detail) {
              errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          message.error(errorMessage);
          // 清除 URL 参数
          window.history.replaceState({}, '', '/login');
        }
      };

      handleWechatCallback();
    }
  }, []);

  /**
   * 从 localStorage 加载失败记录
   */
  const loadFailTimesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const times = JSON.parse(stored) as number[];
        // 清理过期的记录
        const now = Date.now();
        const recentTimes = times.filter(time => now - time < TIME_WINDOW);
        if (recentTimes.length > 0) {
          setLoginFailTimes(recentTimes);
          // 如果还有有效记录，更新存储
          localStorage.setItem(STORAGE_KEY, JSON.stringify(recentTimes));
        } else {
          // 如果没有有效记录，清除存储
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('加载登录失败记录失败:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  /**
   * 保存失败记录到 localStorage
   */
  const saveFailTimesToStorage = (times: number[]) => {
    try {
      if (times.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('保存登录失败记录失败:', error);
    }
  };

  /**
   * 检查验证令牌是否有效
   */
  const checkVerifyToken = (): boolean => {
    try {
      const stored = localStorage.getItem(VERIFIED_KEY);
      if (!stored) return false;
      
      const token = JSON.parse(stored) as { timestamp: number; expiresAt: number };
      const now = Date.now();
      
      // 检查是否过期
      if (now > token.expiresAt) {
        localStorage.removeItem(VERIFIED_KEY);
        return false;
      }
      
      return true;
    } catch (error) {
      localStorage.removeItem(VERIFIED_KEY);
      return false;
    }
  };

  /**
   * 组件加载时从 localStorage 恢复失败记录和验证状态
   */
  useEffect(() => {
    loadFailTimesFromStorage();
    // 检查是否有有效的验证令牌
    const hasValidToken = checkVerifyToken();
    if (hasValidToken) {
      // 如果验证令牌有效，说明用户已经完成验证，允许直接登录
      // 不需要再次显示验证按钮
      setIsVerified(true);
      // 注意：不清除 requireVerification，因为失败记录还在
      // 但在登录时会检查验证令牌，如果有效则允许登录
    }
  }, []);

  /**
   * 监听登录失败次数变化，自动检查是否需要验证并保存到 localStorage
   */
  useEffect(() => {
    if (loginFailTimes.length > 0) {
      saveFailTimesToStorage(loginFailTimes);
      checkRequireVerification();
    } else {
      // 如果失败记录为空，清除存储
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [loginFailTimes]);

  /**
   * 检查是否需要验证
   * 5分钟内失败3次或以上，需要长按验证
   * 
   * @param currentFailTimes - 当前失败时间数组（可选，用于同步检查）
   */
  const checkRequireVerification = (currentFailTimes?: number[]) => {
    const now = Date.now();
    const failTimesToCheck = currentFailTimes !== undefined ? currentFailTimes : loginFailTimes;
    
    // 清理超过时间窗口的失败记录
    const recentFailTimes = failTimesToCheck.filter(time => now - time < TIME_WINDOW);
    
    // 如果提供了新的失败时间数组，更新状态
    if (currentFailTimes !== undefined) {
      setLoginFailTimes(recentFailTimes);
    } else if (recentFailTimes.length !== failTimesToCheck.length) {
      // 如果有清理，更新状态
      setLoginFailTimes(recentFailTimes);
    }
    
    // 如果最近失败次数达到阈值，需要验证
    const needVerify = recentFailTimes.length >= FAIL_COUNT_THRESHOLD;
    
    // 调试日志
    if (recentFailTimes.length > 0) {
    }
    
    setRequireVerification(needVerify);
    
    // 如果需要验证但未通过，重置验证状态
    if (needVerify && !isVerified) {
      setIsVerified(false);
    }
    
    return needVerify;
  };

  /**
   * 处理验证通过
   * 
   * 验证通过后，生成一个验证令牌，只允许一次登录尝试
   * 如果登录失败，需要重新验证
   */
  const handleVerify = () => {
    setIsVerified(true);
    // 生成验证令牌（包含时间戳，有效期5分钟）
    const verifyToken = {
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟有效期
    };
    // 保存验证令牌到 localStorage
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(verifyToken));
    // 注意：不清除失败记录，验证后只允许一次尝试，如果失败需要重新验证
  };

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
    // 检查是否需要验证 - 如果需要验证但未通过，直接阻止登录请求，不发送到后端
    if (requireVerification && !isVerified) {
      message.warning('检测到频繁操作，请先完成长按验证后再登录');
      return;
    }

    // 如果已验证，检查验证令牌是否有效
    if (isVerified) {
      const hasValidToken = checkVerifyToken();
      if (!hasValidToken) {
        setIsVerified(false);
        setRequireVerification(true);
        message.warning('验证已过期，请重新完成长按验证');
        return;
      }
    }

    try {
      const response = await login(values);
      // 登录成功，清除所有记录和验证状态
      setLoginFailTimes([]);
      setLoginFailCount(0);
      setRequireVerification(false);
      setIsVerified(false);
      // 清除 localStorage 中的所有记录
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VERIFIED_KEY);
      handleLoginSuccess(response, values);
    } catch (error: any) {
      // 登录失败，清除验证状态（验证后只允许一次尝试）
      if (isVerified) {
        setIsVerified(false);
        localStorage.removeItem(VERIFIED_KEY);
        message.warning('登录失败，请重新完成长按验证');
      }
      
      // 记录失败时间和次数
      const now = Date.now();
      const updatedFailTimes = [...loginFailTimes, now];
      setLoginFailTimes(updatedFailTimes);
      setLoginFailCount(prev => prev + 1);
      
      // 检查是否需要验证（使用更新后的失败时间数组）
      const needVerify = checkRequireVerification(updatedFailTimes);
      
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
      
      // 如果触发验证要求，提示用户
      if (needVerify) {
        message.warning('检测到频繁操作，请完成长按验证后重试');
      }
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

          const tenantName = (response.user as any)?.tenant_name || 
            (() => {
              const tenants = response.tenants || [];
              const selectedTenant = tenants.find(t => t.id === tenantId);
              return selectedTenant?.name || '默认组织';  // 体验用户默认使用"默认组织"
            })();

          // 更新用户状态
          const userInfo = {
            id: response.user.id,
            username: response.user.username,
            email: response.user.email,
            full_name: response.user.full_name,
            is_infra_admin: response.user.is_infra_admin,
            is_tenant_admin: response.user.is_tenant_admin,
            tenant_id: tenantId,
            tenant_name: tenantName,
            user_type: 'guest',
          };
          setCurrentUser(userInfo);
          setUserInfo(userInfo);

          // 延迟执行消息提示和导航，避免阻塞主线程
          const urlParams = new URL(window.location.href).searchParams;
          setTimeout(() => {
            message.success('体验登录成功（仅浏览权限）');
            navigate(urlParams.get('redirect') || '/system/dashboard');
          }, 0);
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

        // 从 tenants 数组中查找对应的租户名称
        const tenants = response.tenants || [];
        const selectedTenant = tenants.find(t => t.id === selectedTenantId);
        const tenantName = selectedTenant?.name || '';

        // 更新用户状态
        const userInfo = {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          full_name: response.user.full_name,
          is_infra_admin: response.user.is_infra_admin,
          is_tenant_admin: response.user.is_tenant_admin,
          tenant_id: selectedTenantId,
          tenant_name: tenantName,
          user_type: 'user',
        };
        setCurrentUser(userInfo);
        setUserInfo(userInfo);
        setTenantSelectionVisible(false);
        setLoginResponse(null);
        setLoginCredentials(null);

        // 延迟执行消息提示和导航，避免阻塞主线程
        const urlParams = new URL(window.location.href).searchParams;
        setTimeout(() => {
          message.success('已选择组织');
          navigate(urlParams.get('redirect') || '/system/dashboard');
        }, 0);
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
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 强制使用浅色模式，不受全局深色模式影响
        token: {
          colorPrimary: fixedThemeColor, // 固定主题色，不受全局主题影响
        },
      }}
    >
      <div 
        className="login-container"
        style={{
          background: fixedThemeColor, // 固定背景色，不受全局主题影响
        }}
      >
      {/* 右上角工具栏（语言切换） */}
      <div
        className="login-toolbar"
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Tooltip
          title="切换语言"
          placement="bottomLeft"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
          styles={{ root: { maxWidth: '200px' } }}
        >
          <Button
            type="default"
            icon={<GlobalOutlined />}
            onClick={() => {
              // 语言切换功能
            }}
            style={{
              backgroundColor: '#fff',
              color: fixedThemeColor,
              borderColor: fixedThemeColor,
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
      <div 
        className="logo-header"
        style={{
          background: fixedThemeColor,
        }}
      >
        <img 
          src="/img/logo.png" 
          alt="RiverEdge Logo" 
          className="logo-img"
          onError={(e) => {
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
                  color: fixedThemeColor,
                },
                textContent: 'RE',
              })
            );
          }}
        />
        <Title level={2} className="logo-title">RiverEdge SaaS</Title>
      </div>

      {/* 左侧品牌展示区（桌面端显示，手机端隐藏） */}
      <div 
        className="login-left"
        style={{
          background: fixedThemeColor,
        }}
      >
        {/* LOGO 和框架名称放在左上角（桌面端） */}
        <div className="logo-top-left">
          <img 
            src="/img/logo.png" 
            alt="RiverEdge Logo" 
            className="logo-img"
            onError={(e) => {
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
                    color: fixedThemeColor,
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
          {/* Lottie 动画装饰显示在左侧上方 */}
          <div className="login-decoration-lottie">
            <Lottie
              animationData={loginAnimation}
              loop={true}
              autoplay={true}
              style={{
                width: '100%',
                maxWidth: '600px',
                height: 'auto',
              }}
            />
          </div>

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
                  backgroundColor: fixedThemeColor,
                  borderColor: fixedThemeColor,
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
                autoComplete: 'username',
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
                autoComplete: 'current-password',
              }}
            />

            {/* 长按验证 - 仅在检测到频繁操作且未验证时显示 */}
            {/* 如果验证令牌有效，说明已经完成验证，不需要再次显示验证按钮 */}
            {requireVerification && !isVerified && (() => {
              const verifyDuration = calculateVerifyDuration(loginFailTimes.length);
              return (
                <div style={{  marginBottom: 24 }}>
                  <Tooltip 
                    title={`检测到频繁操作，请完成验证（${verifyDuration / 1000}秒）`} 
                    placement="top"
                  >
                    <div>
                      <LongPressVerify
                        duration={verifyDuration}
                        onVerify={handleVerify}
                        text={`长按验证 ${verifyDuration / 1000}秒`}
                        size="large"
                        disabled={false}
                      />
                    </div>
                  </Tooltip>
                </div>
              );
            })()}
          </ProForm>

          <div className="login-form-footer">
            {/* 社交登录区域 */}
            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px',
                marginBottom: 12
              }}>
                {/* 左侧分割线 */}
                <div style={{ 
                  flex: 1, 
                  height: '1px', 
                  background: 'rgba(0, 0, 0, 0.1)',
                  maxWidth: '80px'
                }}></div>
                
                {/* 社交图标按钮 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  {/* 微信登录 */}
                  <Tooltip title="微信登录">
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('wechat')}
                      className="social-login-btn social-login-btn-wechat"
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: 'rgba(7, 193, 96, 0.7)',
                        borderColor: 'rgba(7, 193, 96, 0.7)',
                        borderWidth: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#07C160';
                        e.currentTarget.style.borderColor = '#07C160';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(7, 193, 96, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(7, 193, 96, 0.7)';
                      }}
                    >
                      <img 
                        src="/social/wechat.svg" 
                        alt="微信" 
                        style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                      />
                    </Button>
                  </Tooltip>
                  {/* QQ登录 */}
                  <Tooltip title="QQ登录">
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('qq')}
                      className="social-login-btn social-login-btn-qq"
                      style={{
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(18, 183, 245, 0.7)',
                        borderColor: 'rgba(18, 183, 245, 0.7)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#12B7F5';
                        e.currentTarget.style.borderColor = '#12B7F5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(18, 183, 245, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(18, 183, 245, 0.7)';
                      }}
                    >
                      <img 
                        src="/social/qq.svg" 
                        alt="QQ" 
                        style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                      />
                    </Button>
                  </Tooltip>
                  {/* 企业微信登录 */}
                  <Tooltip title="企业微信登录">
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('wechat_work')}
                      className="social-login-btn social-login-btn-wechat-work"
                      style={{
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(120, 195, 64, 0.5)',
                        borderColor: 'rgba(120, 195, 64, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#78C340';
                        e.currentTarget.style.borderColor = '#78C340';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(120, 195, 64, 0.7)';
                        e.currentTarget.style.borderColor = 'rgba(120, 195, 64, 0.7)';
                      }}
                    >
                      <img 
                        src="/social/qwei.svg" 
                        alt="企业微信" 
                        style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                      />
                    </Button>
                  </Tooltip>
                  {/* 钉钉登录 */}
                  <Tooltip title="钉钉登录">
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('dingtalk')}
                      className="social-login-btn social-login-btn-dingtalk"
                      style={{
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 117, 255, 0.5)',
                        borderColor: 'rgba(0, 117, 255, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0075FF';
                        e.currentTarget.style.borderColor = '#0075FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 117, 255, 0.5)';
                        e.currentTarget.style.borderColor = 'rgba(0, 117, 255, 0.5)';
                      }}
                    >
                      <img 
                        src="/social/dingtalk.svg" 
                        alt="钉钉" 
                        style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                      />
                    </Button>
                  </Tooltip>
                  {/* 飞书登录 */}
                  <Tooltip title="飞书登录">
                    <Button
                      type="default"
                      shape="circle"
                      size="large"
                      onClick={() => handleSocialLogin('feishu')}
                      className="social-login-btn social-login-btn-feishu"
                      style={{
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(51, 112, 255, 0.5)',
                        borderColor: 'rgba(51, 112, 255, 0.5)',
                        borderWidth: '0',
                        padding: 0,
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#3370FF';
                        e.currentTarget.style.borderColor = '#3370FF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(51, 112, 255, 0.5)';
                        e.currentTarget.style.borderColor = 'rgba(51, 112, 255, 0.5)';
                      }}
                    >
                      <img 
                        src="/social/feishu.svg" 
                        alt="飞书" 
                        style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }}
                      />
                    </Button>
                  </Tooltip>
                </div>
                
                {/* 右侧分割线 */}
                <div style={{ 
                  flex: 1, 
                  height: '1px', 
                  background: 'rgba(0, 0, 0, 0.1)',
                  maxWidth: '80px'
                }}></div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Button
                type="default"
                size="large"
                icon={<ThunderboltOutlined />}
                block
                onClick={handleGuestLogin}
                style={{
                  height: '40px',
                  borderColor: fixedThemeColor,
                  color: fixedThemeColor,
                }}
              >
                体验登录
              </Button>
            </div>

            <Text 
              className="register-link"
              style={{
                color: fixedThemeColor,
              }}
            >
              还没有账号？<Button type="link" style={{ padding: 0, color: fixedThemeColor }} onClick={() => {
                setRegisterDrawerVisible(true);
                setRegisterType('select');
              }}>立即注册</Button>
            </Text>
          </div>

          {/* 底部链接（ICP备案、用户条款、隐私条款） */}
          <div className="login-footer-links">
            <Space separator={<span style={{ color: '#d9d9d9' }}>|</span>} size="small">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ICP备案：苏ICP备2021002752号-5
              </Text>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: '12px', height: 'auto', color: fixedThemeColor }}
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
                style={{ padding: 0, fontSize: '12px', height: 'auto', color: fixedThemeColor }}
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

      {/* 注册选择抽屉 */}
      <Drawer
        title={
          registerType === 'select' ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                选择注册方式
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                请选择适合您的注册方式
              </Text>
            </div>
          ) : registerType === 'personal' ? (
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => setRegisterType('select')}
                style={{ padding: 0, marginRight: 8 }}
              >
                返回
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                个人注册
              </Title>
            </Space>
          ) : (
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => setRegisterType('select')}
                style={{ padding: 0, marginRight: 8 }}
              >
                返回
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                组织注册
              </Title>
            </Space>
          )
        }
        open={registerDrawerVisible}
        onClose={() => {
          setRegisterDrawerVisible(false);
          setRegisterType('select');
        }}
        size="large"
        placement="right"
        maskClosable={true}
        closable={true}
        destroyOnClose={false}
        styles={{
          body: {
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            overflow: 'auto',
          },
          header: {
            padding: '16px 24px',
            borderBottom: `1px solid ${token.colorBorder}`,
          },
        }}
      >
        {/* 注册选择界面 */}
        {registerType === 'select' && (
          <div style={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '32px',
            maxWidth: '800px',
            width: '100%',
            padding: '0 32px'
          }}>
        <Row gutter={[24, 24]} style={{ margin: 0, width: '100%' }}>
          <Col xs={24} sm={12} style={{ display: 'flex' }}>
            <div style={{ width: '100%', display: 'flex' }}>
              <Card
                hoverable
                style={{
                  width: '100%',
                  textAlign: 'center',
                  border: `2px solid ${fixedThemeColor}`,
                  borderRadius: token.borderRadiusLG,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
                styles={{
                  body: {
                    padding: '32px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '220px',
                  },
                }}
                onClick={() => {
                  setRegisterType('personal');
                }}
              >
                {/* 图标容器 */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    backgroundColor: `${fixedThemeColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    position: 'relative',
                    zIndex: 1,
                    border: `2px solid ${fixedThemeColor}30`,
                  }}
                >
                  <UserAddOutlined style={{ fontSize: 36, color: fixedThemeColor }} />
                </div>
                
                {/* 内容区域 */}
                <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                  <Title level={4} style={{ margin: '0 0 12px 0', color: fixedThemeColor, fontWeight: 600 }}>
                    个人注册
                  </Title>
                  <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block' }}>
                    快速创建个人账户
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block', marginTop: 4 }}>
                    可加入现有组织或使用默认组织
                  </Text>
                </div>
              </Card>
            </div>
          </Col>
          <Col xs={24} sm={12} style={{ display: 'flex' }}>
            <div style={{ width: '100%', display: 'flex' }}>
              <Card
                hoverable
                style={{
                  width: '100%',
                  textAlign: 'center',
                  border: '2px solid #52c41a',
                  borderRadius: token.borderRadiusLG,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
                styles={{
                  body: {
                    padding: '32px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '220px',
                  },
                }}
                onClick={() => {
                  setRegisterType('organization');
                }}
              >
                {/* 图标容器 */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    backgroundColor: '#52c41a15',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    position: 'relative',
                    zIndex: 1,
                    border: '2px solid #52c41a30',
                  }}
                >
                  <ApartmentOutlined style={{ fontSize: 36, color: '#52c41a' }} />
                </div>
                
                {/* 内容区域 */}
                <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                  <Title level={4} style={{ margin: '0 0 12px 0', color: '#52c41a', fontWeight: 600 }}>
                    组织注册
                  </Title>
                  <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block' }}>
                    创建新组织并成为管理员
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14, lineHeight: '24px', display: 'block', marginTop: 4 }}>
                    可邀请团队成员加入
                  </Text>
                </div>
              </Card>
            </div>
          </Col>
        </Row>

        <div style={{ 
          textAlign: 'center', 
          paddingTop: '24px', 
          flexShrink: 0,
          width: '100%'
        }}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            已有账号？
            <Button
              type="link"
              style={{ padding: 0, fontSize: 14, height: 'auto', marginLeft: 4 }}
              onClick={() => {
                setRegisterDrawerVisible(false);
                setRegisterType('select');
              }}
            >
              立即登录
            </Button>
          </Text>
        </div>
        </div>
        )}
        
        {/* 个人注册表单 */}
        {registerType === 'personal' && (
          <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
            <style>{`
              .register-form .ant-input::placeholder,
              .register-form .ant-input-affix-wrapper .ant-input::placeholder {
                font-size: 14px !important;
              }
            `}</style>
            {/* 注册进度指示器 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#52c41a',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  marginRight: 8
                }}>
                  1
                </div>
                <div style={{ flex: 1, height: 2, backgroundColor: '#52c41a', marginRight: 8 }}></div>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: '#d9d9d9',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 'bold',
                  marginRight: 8
                }}>
                  2
                </div>
                <div style={{ flex: 1, height: 2, backgroundColor: '#d9d9d9' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 500 }}>填写信息</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>验证邮箱</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                填写以下信息创建您的个人账户
              </Text>
            </div>

            <Alert
              title="注册说明"
              description={
                <div>
                  <div style={{ marginBottom: 6 }}>
                    • <strong>不填写组织</strong>：自动加入默认组织，拥有完整操作权限
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    • <strong>填写组织</strong>：可申请加入指定组织，需管理员审核通过
                  </div>
                  <div>
                    • <strong>提示</strong>：输入组织代码或名称搜索，未找到可创建新组织
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
              closable
            />

            <ProForm<PersonalRegisterFormData>
              onFinish={handlePersonalRegister}
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
                  loading: false,
                },
              }}
              size="large"
              grid={true}
              rowProps={{ gutter: 16 }}
              className="register-form"
              onKeyDown={(e) => {
                // 支持 Ctrl+Enter 快速提交
                if (e.ctrlKey && e.key === 'Enter') {
                  e.preventDefault();
                  const form = e.currentTarget as any;
                  if (form && form.submit) {
                    form.submit();
                  }
                }
              }}
            >
              <ProFormGroup title="用户信息">
                <ProFormText
                  name="username"
                  label="用户名"
                  colProps={{ span: 12 }}
                  rules={[
                    { required: true, message: '请输入用户名' },
                    { min: 3, max: 50, message: '用户名长度为 3-50 个字符' },
                    {
                      pattern: /^[a-zA-Z0-9_-]+$/,
                      message: '用户名只能包含字母、数字、下划线和连字符'
                    },
                  ]}
                  fieldProps={{
                    size: 'large',
                    prefix: <UserOutlined />,
                    placeholder: '请输入用户名（3-50个字符）',
                    autoComplete: 'username',
                  }}
                  extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      <div>这是您登录时使用的账号，注册后无法修改，请谨慎填写</div>
                    </div>
                  }
                />

                <ProFormText
                  name="phone"
                  label="手机号"
                  colProps={{ span: 12 }}
                  rules={[
                    { required: true, message: '请输入手机号' },
                    {
                      pattern: /^1[3-9]\d{9}$/,
                      message: '请输入有效的11位手机号'
                    }
                  ]}
                  fieldProps={{
                    size: 'large',
                    prefix: <MobileOutlined />,
                    placeholder: '请输入11位手机号',
                    autoComplete: 'tel',
                    maxLength: 11,
                  }}
                  extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      <div>手机号用于接收短信验证码，保障账户安全</div>
                      <div style={{ marginTop: 4, color: '#52c41a' }}>
                        ✅ 支持中国大陆手机号
                      </div>
                    </div>
                  }
                />

                  <ProFormText
                    name="phone_verification_code"
                    label="短信验证码"
                    colProps={{ span: 12 }}
                    rules={[
                      { required: false, message: '请输入短信验证码' }, // 临时设为非必填
                      { pattern: /^\d{6}$/, message: '验证码格式不正确' },
                    ]}
                    fieldProps={{
                      size: 'large',
                      placeholder: '请输入6位验证码（暂未接入）',
                      maxLength: 6,
                    addonAfter: (
                  <Button
                        type="link"
                        style={{ padding: '0 8px', height: '100%' }}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                      // 获取手机号值
                      const form = document.querySelector('.register-form') as any;
                      if (form && form.getFieldsValue) {
                        const values = form.getFieldsValue();
                        const phone = values.phone;

                        if (!phone) {
                          message.warning('请先输入手机号');
                          return;
                        }

                        if (!/^1[3-9]\d{9}$/.test(phone)) {
                          message.warning('请输入有效的手机号');
                          return;
                        }

                        try {
                          const result = await sendVerificationCode({ phone });
                          if (result.success) {
                            message.success(result.message);
                          } else {
                            message.error(result.message);
                          }
                        } catch (error) {
                          message.error('验证码发送失败，请稍后重试');
                        }
                      }
                    }}
                  >
                    获取验证码
                  </Button>
                    ),
                  }}
                  extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      <div style={{ color: '#faad14' }}>⚠️ 验证码服务暂未完全接入，可留空跳过</div>
                      <div>输入手机号后点击"获取验证码"按钮接收短信验证码</div>
                </div>
                  }
                />

                <ProFormText
                  name="email"
                  label="邮箱（可选）"
                  colProps={{ span: 12 }}
                  rules={[
                    {
                      validator: (_, value) => {
                        // 如果为空，则通过验证（非必填）
                        if (!value || value.trim() === '') {
                          return Promise.resolve();
                        }
                        // 如果有值，则验证邮箱格式
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (emailRegex.test(value)) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('请输入有效的邮箱地址格式'));
                      }
                    }
                  ]}
                  fieldProps={{
                    size: 'large',
                    prefix: <MailOutlined />,
                    placeholder: '请输入邮箱地址',
                    autoComplete: 'email',
                  }}
                  extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      <div>邮箱用于接收重要通知和密码找回，可选填</div>
                      <div style={{ marginTop: 4, color: '#1890ff' }}>
                        💡 支持 Gmail、Outlook、QQ、163 等主流邮箱
                      </div>
                    </div>
                  }
                />

                <ProFormText.Password
                  name="password"
                  label="密码"
                  colProps={{ span: 12 }}
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 8, message: '密码长度至少 8 个字符' },
                    { max: 128, message: '密码长度不能超过 128 个字符' },
                  ]}
                  fieldProps={{
                    size: 'large',
                    prefix: <LockOutlined />,
                    placeholder: '请输入密码（8-128个字符）',
                    autoComplete: 'new-password',
                  }}
                  extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      为了账户安全，建议使用字母、数字和特殊符号的组合，至少8个字符
                    </div>
                  }
                />

                <ProFormText.Password
                  name="confirm_password"
                  label="确认密码"
                  colProps={{ span: 12 }}
                  rules={[
                    { required: true, message: '请再次输入密码' },
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
                    autoComplete: 'new-password',
                  }}
                />
              </ProFormGroup>

              <ProFormGroup title="组织信息（可选）">
                <Row gutter={16}>
                  <Col span={12}>
                    <ProForm.Item
                      name="tenant_domain"
                      label="加入组织（可选）"
                      extra={
                    <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                      <div style={{ marginBottom: 4, fontSize: '12px' }}>
                        如果您要加入某个组织，请输入组织代码或组织名称进行搜索。不填写则自动加入默认组织
                      </div>
                      {tenantCheckResult?.exists && selectedTenant && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="success" style={{ fontSize: 11 }}>
                            ✓ 已选择：{selectedTenant.tenant_name}（{selectedTenant.tenant_domain}）
                          </Text>
                        </div>
                      )}
                      {tenantSearchOptions.length > 0 && !selectedTenant && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="warning" style={{ fontSize: 11 }}>
                            找到 {tenantSearchOptions.length} 个匹配的组织，请从下拉列表中选择您要加入的组织
                          </Text>
                        </div>
                      )}
                      {tenantSearchOptions.length === 0 && !searchingTenant && selectedTenant === null && tenantCheckResult && !tenantCheckResult.exists && (
                        <div style={{ marginTop: 4 }}>
                          <Space>
                            <Text type="danger" style={{ fontSize: 11 }}>
                              ✗ 未找到匹配的组织
                            </Text>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, fontSize: 11, height: 'auto' }}
                              onClick={() => {
                                setRegisterType('organization');
                              }}
                            >
                              创建新组织
                            </Button>
                          </Space>
                        </div>
                      )}
                    </div>
                  }
                >
                  <AutoComplete
                    options={(tenantSearchOptions || []).map(tenant => ({
                      value: tenant.tenant_domain,
                      label: (
                        <div>
                          <div style={{ fontWeight: 500 }}>{tenant.tenant_name}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{tenant.tenant_domain}</div>
                        </div>
                      ),
                      tenant: tenant,
                    }))}
                    onSearch={handleSearchTenant}
                    onSelect={(value, option) => handleSelectTenant(value, option)}
                    filterOption={false}
                    notFoundContent={searchingTenant ? '搜索中...' : '未找到匹配的组织'}
                    style={{ width: '100%' }}
                  >
                    <Input
                      size="large"
                      prefix={<ApartmentOutlined />}
                      allowClear
                      placeholder="输入组织代码或组织名称搜索"
                      style={{ height: '40px' }}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value || value.trim().length === 0) {
                          setTenantSearchOptions([]);
                          setSelectedTenant(null);
                          setTenantCheckResult(null);
                        }
                      }}
                    />
                  </AutoComplete>
                  </ProForm.Item>
                  </Col>
                  <Col span={12}>
                    <ProFormText
                      name="invite_code"
                      label="邀请码（可选）"
                      placeholder="输入组织提供的邀请码"
                      rules={[
                        { max: 100, message: '邀请码长度不能超过 100 个字符' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (value && !getFieldValue('tenant_domain')) {
                              return Promise.reject(new Error('使用邀请码时，必须同时填写组织代码'));
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      fieldProps={{
                        size: 'large',
                      }}
                      extra={
                        <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px' }}>
                          填写邀请码可免审核直接加入组织，需同时填写组织代码
                        </div>
                      }
                    />
                  </Col>
                </Row>
              </ProFormGroup>
            </ProForm>
          </div>
        )}
        
        {/* 组织注册表单 */}
        {registerType === 'organization' && (
          <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ fontSize: 14 }}>
                创建新组织，成为组织管理员
              </Text>
            </div>

            <Alert
              title="注册说明"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    • 注册成功后，您将成为该组织的管理员
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    • 组织域名可选，留空将自动生成8位随机域名
                  </div>
                  <div>
                    • 组织域名格式：riveredge.cn/xxxxx
                  </div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
              closable
            />

            <ProForm<OrganizationRegisterFormData>
              onFinish={handleOrganizationRegister}
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
              grid={true}
              rowProps={{ gutter: 16 }}
              className="register-form"
            >
              {/* 极简注册表单：仅3个必填字段 */}
              <ProFormText
                name="tenant_name"
                label="组织名称"
                rules={[
                  { required: true, message: '请输入组织名称' },
                  { min: 1, max: 100, message: '组织名称长度为 1-100 个字符' },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <ApartmentOutlined />,
                  placeholder: '请输入组织名称',
                }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>
                    这是您组织的显示名称，用于标识您的组织
                  </div>
                }
              />
              <ProFormText
                name="phone"
                label="手机号"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的11位中国大陆手机号' },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <MobileOutlined />,
                  placeholder: '请输入手机号（11位）',
                  autoComplete: 'tel',
                }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>
                    手机号将作为您的登录账号，请确保手机号正确
                  </div>
                }
              />
              <ProFormText.Password
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 8, message: '密码长度至少 8 个字符' },
                  { max: 128, message: '密码长度不能超过 128 个字符' },
                ]}
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                  placeholder: '请输入密码（至少8个字符）',
                  autoComplete: 'new-password',
                }}
                extra={
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '12px', color: '#999' }}>
                    为了账户安全，建议使用字母、数字和特殊符号的组合
                  </div>
                }
              />
              <ProFormText.Password
                name="confirm_password"
                label="确认密码"
                rules={[
                  { required: true, message: '请再次输入密码' },
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
                  placeholder: '请再次输入密码以确认',
                  autoComplete: 'new-password',
                }}
              />
            </ProForm>
          </div>
        )}
      </Drawer>
    </div>
    </ConfigProvider>
  );
}
