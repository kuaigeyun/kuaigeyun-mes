/**
 * RiverEdge SaaS 多组织框架 - 锁屏页面
 *
 * 提供屏幕锁定功能，需要输入密码解锁
 * 提供屏幕锁定功能，几何图形背景使用 CSS 动画
 */

import { useState, useRef, useEffect } from 'react';
import { App, Input, Button, Form, Typography, Avatar, ConfigProvider } from 'antd';
import { LockOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '../../stores';
import { getToken, getUserInfo, setUserInfo, setTenantId } from '../../utils/auth';
import { login } from '../../services/auth';
import { infraSuperAdminLogin } from '../../services/infraAdmin';
import { setToken } from '../../utils/auth';
import { theme } from 'antd';
import { getAvatarUrl, getAvatarText, getAvatarFontSize } from '../../utils/avatar';

// 固定主题颜色（不受全局主题影响）
const FIXED_THEME_COLOR = '#1890ff';

const { Title, Text } = Typography;

/**
 * 锁屏页面组件
 */
export default function LockScreenPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const unlockScreen = useGlobalStore((s) => s.unlockScreen);
  const lockedPath = useGlobalStore((s) => s.lockedPath);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  
  // 获取用户头像 URL（如果有 UUID）
  useEffect(() => {
    const loadAvatarUrl = async () => {
      const userInfo = getUserInfo();
      let avatarUuid = (currentUser as any)?.avatar || userInfo?.avatar;
      
      // 如果 currentUser 和 userInfo 都没有 avatar，尝试从个人资料 API 获取
      if (!avatarUuid && currentUser) {
        try {
          const { getUserProfile } = await import('../../services/userProfile');
          const profile = await getUserProfile();
          if (profile.avatar) {
            avatarUuid = profile.avatar;
          }
        } catch (error) {
          // 静默失败，不影响其他功能
        }
      }
      
      if (avatarUuid) {
        try {
          const url = await getAvatarUrl(avatarUuid);
          if (url) {
            setAvatarUrl(url);
          } else {
            setAvatarUrl(undefined);
          }
        } catch (error) {
          console.error('加载头像 URL 失败:', error);
          setAvatarUrl(undefined);
        }
      } else {
        setAvatarUrl(undefined);
      }
    };
    
    if (currentUser) {
      loadAvatarUrl();
    }
  }, [currentUser]);

  /**
   * 处理解锁
   */
  const handleUnlock = async (values: { password: string }) => {
    // 使用真实密码值（如果表单值为空，使用状态中的值）
    const password = values.password || realPassword;
    if (!currentUser) {
      message.error('用户信息不存在，请重新登录');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      // 检查用户类型（平台超级管理员还是系统级用户）
      const userInfo = getUserInfo();
      const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';

      let response;

      if (isInfraSuperAdmin) {
        // 平台超级管理员：使用平台登录接口
        const infraResponse = await infraSuperAdminLogin({
          username: currentUser.username,
          password: password,
        });

        // 验证成功，更新 token
        setToken(infraResponse.access_token);

        // 更新用户信息和租户ID
        setUserInfo({
          ...infraResponse.user,
          user_type: 'infra_superadmin',
        });

        // 设置默认租户 ID（如果返回了默认租户）
        if (infraResponse.default_tenant_id) {
          setTenantId(infraResponse.default_tenant_id);
        }

        // 更新全局用户状态
        const { setCurrentUser } = useGlobalStore.getState();
        setCurrentUser({
          id: infraResponse.user.id,
          username: infraResponse.user.username,
          email: infraResponse.user.email,
          full_name: infraResponse.user.full_name,
          is_infra_admin: true,
          is_tenant_admin: false,
          tenant_id: infraResponse.default_tenant_id,
        });

        response = infraResponse;
      } else {
        // 系统级用户：使用系统登录接口
        const systemResponse = await login({
          username: currentUser.username,
          password: password,
        });

        // 验证成功，更新 token
        setToken(systemResponse.access_token);

        response = systemResponse;
      }

      if (response.access_token) {
        // 解锁屏幕
        unlockScreen();

        message.success('解锁成功');

        // 获取锁屏前的路径并导航回去
        if (lockedPath && lockedPath !== '/lock-screen') {
          navigate(lockedPath, { replace: true });
        } else {
          // 根据用户类型导航到不同的默认页面
          if (isInfraSuperAdmin) {
            navigate('/infra/operation', { replace: true });
          } else {
            navigate('/system/dashboard/workplace', { replace: true });
          }
        }
      } else {
        message.error('密码错误，请重新输入');
        form.setFieldsValue({ password: '' });
      }
    } catch (error: any) {
      console.error('解锁失败:', error);
      message.error(error?.response?.data?.detail || '解锁失败，请检查密码');
      form.setFieldsValue({ password: '' });
    } finally {
      setLoading(false);
    }
  };

  // 如果没有用户信息，重定向到登录页
  if (!currentUser && !getToken()) {
    navigate('/login');
    return null;
  }

  // 获取用户显示名称
  const displayName = currentUser?.full_name || currentUser?.username || '用户';
  const userInitial = displayName[0]?.toUpperCase() || 'U';
  
  // 判断是否是体验用户
  const isGuestUser = currentUser?.username === 'guest';

  // 日期和时间状态
  const [currentTime, setCurrentTime] = useState(new Date());
  const passwordInputRef = useRef<any>(null);
  // 密码显示/隐藏状态
  const [passwordVisible, setPasswordVisible] = useState(false);
  // 实际密码值（用于提交）
  const [realPassword, setRealPassword] = useState('');

  /**
   * 实时更新时间（每秒更新一次）
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  /**
   * 阻止浏览器自动填充密码
   */
  useEffect(() => {
    // 延迟执行，确保 DOM 已渲染
    const timer = setTimeout(() => {
      // 查找所有密码输入框并清除自动填充
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      passwordInputs.forEach((input: any) => {
        if (input) {
          input.setAttribute('autocomplete', 'new-password');
          input.setAttribute('data-form-type', 'other');
          input.setAttribute('data-lpignore', 'true');
          input.setAttribute('data-1p-ignore', 'true');
          input.setAttribute('data-dashlane-ignore', 'true');
          input.setAttribute('data-bitwarden-watching', '1');
          // 如果已被自动填充，清除值
          if (input.value) {
            input.value = '';
            form.setFieldsValue({ password: '' });
          }
        }
      });

      // 监听输入事件，如果检测到自动填充，立即清除
      const handleInput = (e: any) => {
        if (e.target.value && e.target.value.length > 0) {
          // 检查是否是自动填充（通常自动填充会在页面加载时立即填充）
          const isAutofill = e.target.matches(':-webkit-autofill');
          if (isAutofill) {
            e.target.value = '';
            form.setFieldsValue({ password: '' });
          }
        }
      };

      passwordInputs.forEach((input: any) => {
        input.addEventListener('input', handleInput);
        input.addEventListener('change', handleInput);
      });

      return () => {
        passwordInputs.forEach((input: any) => {
          input.removeEventListener('input', handleInput);
          input.removeEventListener('change', handleInput);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [form]);

  /**
   * 格式化日期
   */
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    return `${year}年${month}月${day}日 ${weekday}`;
  };

  /**
   * 格式化时间（精确到秒）
   */
  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm, // 强制使用浅色模式，不受全局深色模式影响
        token: {
          colorPrimary: FIXED_THEME_COLOR, // 固定主题色，不受全局主题影响
        },
      }}
    >
      <>
      <style>{`
        @keyframes rotateSlow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-30px);
          }
        }
        .geometric-shape {
          animation: rotateSlow 20s linear infinite;
        }
        .geometric-shape-2 {
          animation: rotateSlow 25s linear infinite reverse;
        }
        .geometric-shape-3 {
          animation: float 8s ease-in-out infinite;
        }
        /* 阻止浏览器自动填充样式 */
        input[type="password"]:-webkit-autofill,
        input[type="password"]:-webkit-autofill:hover,
        input[type="password"]:-webkit-autofill:focus,
        input[type="password"]:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px white inset !important;
          -webkit-text-fill-color: #000 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        /* 隐藏密码管理器的下拉菜单 */
        input[type="password"]::-webkit-credentials-auto-fill-button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `}</style>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 缓慢旋转的几何图形背景 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: FIXED_THEME_COLOR,
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {/* 大圆形 1 */}
          <div
            className="geometric-shape"
            style={{
              position: 'absolute',
              top: '-20%',
              right: '-10%',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.15)',
            }}
          />
          {/* 大圆形 2 */}
          <div
            className="geometric-shape-2"
            style={{
              position: 'absolute',
              bottom: '-15%',
              left: '-10%',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '2px solid rgba(255, 255, 255, 0.12)',
            }}
          />
          {/* 中等圆形 */}
          <div
            className="geometric-shape-3"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
            }}
          />
          {/* 小圆形 1 */}
          <div
            className="geometric-shape"
            style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          />
          {/* 小圆形 2 */}
          <div
            className="geometric-shape-2"
            style={{
              position: 'absolute',
              bottom: '25%',
              right: '15%',
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          />
        </div>

      {/* 锁屏内容 */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 400,
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* 日期和时间显示 - 卡片外 */}
        <div style={{ textAlign: 'center', marginBottom: 32, width: '100%' }}>
          <div style={{ fontSize: 80, fontWeight: 'bold', color: '#fff', marginBottom: 8, textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
            {formatTime(currentTime)}
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.9)', textShadow: '0 1px 4px rgba(0, 0, 0, 0.2)' }}>
            {formatDate(currentTime)}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px 16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            width: '100%',
          }}
        >
          {/* 用户信息 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {avatarUrl ? (
              <Avatar
                size={80}
                src={avatarUrl}
                style={{
                  marginBottom: 16,
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                }}
              />
            ) : (
              <Avatar
                size={80}
                style={{
                  backgroundColor: FIXED_THEME_COLOR,
                  marginBottom: 16,
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                  fontSize: getAvatarFontSize(80),
                  fontWeight: 500,
                }}
              >
                {/* 显示首字母（优先全名，否则用户名） */}
                {getAvatarText(currentUser.full_name, currentUser.username)}
              </Avatar>
            )}
            <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
              {displayName}
            </Title>
            <Text type="secondary">屏幕已锁定</Text>
          </div>

          {/* 解锁表单 */}
          <Form
            form={form}
            onFinish={handleUnlock}
            layout="vertical"
            size="large"
            autoComplete="off"
            id="lock-screen-form"
          >
            {/* 隐藏的假输入框，用于欺骗浏览器 */}
            <input
              type="text"
              name="username"
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              readOnly
            />
            <input
              type="password"
              name="password-fake"
              autoComplete="new-password"
              style={{ position: 'absolute', left: '-9999px', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              tabIndex={-1}
              readOnly
            />
            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' },
              ]}
            >
              <div style={{ position: 'relative' }}>
                {/* 隐藏的真实输入框，用于捕获用户输入 */}
                <input
                  type="text"
                  ref={passwordInputRef}
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-dashlane-ignore="true"
                  data-bitwarden-watching="1"
                  id="lock-screen-password-real"
                  name="lock-screen-password-real"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    zIndex: 2,
                    pointerEvents: 'auto',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'transparent',
                    caretColor: 'transparent',
                  }}
                  value={realPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRealPassword(value);
                    form.setFieldsValue({ password: value });
                  }}
                  onFocus={(e) => {
                    // 清除可能被自动填充的值
                    setTimeout(() => {
                      if (e.target.value && e.target.value.length > 0) {
                        // 检查是否是自动填充（通常自动填充会在页面加载时立即填充）
                        const isAutofill = document.activeElement === e.target && e.target.value.length > 6;
                        if (isAutofill) {
                          e.target.value = '';
                          setRealPassword('');
                          form.setFieldsValue({ password: '' });
                        }
                      }
                    }, 100);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      form.setFieldsValue({ password: realPassword });
                      form.submit();
                    }
                  }}
                />
                {/* 显示的输入框，用于显示圆点或真实字符 */}
                <Input
                  type="text"
                  prefix={<LockOutlined />}
                  placeholder="请输入密码解锁"
                  autoFocus
                  autoComplete="off"
                  data-form-type="other"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-dashlane-ignore="true"
                  data-bitwarden-watching="1"
                  id="lock-screen-password-display"
                  name="lock-screen-password-display"
                  readOnly
                  value={passwordVisible ? realPassword : '•'.repeat(realPassword.length)}
                  style={{
                    pointerEvents: 'none',
                  }}
                  onFocus={() => {
                    // 将焦点转移到隐藏的真实输入框
                    if (passwordInputRef.current) {
                      passwordInputRef.current.focus();
                    }
                  }}
                />
                {/* 独立的眼睛图标，可点击 */}
                <span
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: 'rgba(0, 0, 0, 0.45)',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    height: '22px',
                  }}
                >
                  {passwordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                </span>
              </div>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                icon={<LockOutlined />}
              >
                解锁
              </Button>
            </Form.Item>
          </Form>

          {/* 提示信息 */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            {isGuestUser ? (
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  体验用户解锁密码：<Text strong style={{ color: FIXED_THEME_COLOR }}>guest123</Text>
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  输入密码以解锁屏幕
                </Text>
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                输入您的密码以解锁屏幕
              </Text>
            )}
          </div>
        </div>
      </div>

      {/* 底部信息 */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 10,
        }}
      >

      </div>
    </div>
    </>
    </ConfigProvider>
  );
}
