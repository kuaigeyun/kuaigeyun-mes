/**
 * 注册入口页面
 * 
 * 遵循 Ant Design Pro 登录页面规范，采用左右分栏布局
 * 左侧：品牌展示区
 * 右侧：注册方式选择区
 */

import { Card, Button, Typography, Space } from 'antd';
import { 
  UserAddOutlined, 
  ApartmentOutlined, 
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './index.less';

const { Title, Text, Paragraph } = Typography;

/**
 * 注册入口页面组件
 */
export default function RegisterPage() {
  const navigate = useNavigate();

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

      {/* 右侧注册方式选择区 */}
      <div className="login-right">
        <div 
          className="login-form-wrapper register-form-wrapper"
          style={{ maxWidth: '600px' }}
        >
          <div className="login-form-header">
            <Title level={2} className="form-title">欢迎注册</Title>
            <Text className="form-subtitle">选择注册方式</Text>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <Card
              hoverable
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => navigate('/register/personal')}
            >
              <div style={{ textAlign: 'center' }}>
                <div className="register-icon-wrapper register-icon-personal">
                  <UserAddOutlined style={{ fontSize: 40, color: '#fff' }} />
                </div>
                <Title level={4} style={{ marginBottom: 8 }}>个人注册</Title>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  注册后立即生效
                  <br />
                  无需等待审核
                </Paragraph>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>注册成功后立即可以使用</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>拥有所有功能权限，使用全部功能</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>可加入现有组织或预览默认组织</span>
                  </div>
                </div>
                <Button type="primary" size="large" block>
                  个人注册
                </Button>
              </div>
            </Card>

            <Card
              hoverable
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => navigate('/register/organization')}
            >
              <div style={{ textAlign: 'center' }}>
                <div className="register-icon-wrapper register-icon-organization">
                  <ApartmentOutlined style={{ fontSize: 40, color: '#fff' }} />
                </div>
                <Title level={4} style={{ marginBottom: 8 }}>组织注册</Title>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  创建独立组织
                  <br />
                  需审核后生效
                </Paragraph>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>创建独立的组织空间</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>审核通过后拥有所有功能权限</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'center' }}>
                    <ClockCircleOutlined style={{ color: '#faad14', marginTop: 2, flexShrink: 0 }} />
                    <span style={{ textAlign: 'left', flex: 1 }}>提交注册后需等待平台管理员审核</span>
                  </div>
                </div>
                <Button type="primary" size="large" block>
                  组织注册
                </Button>
              </div>
            </Card>
          </div>

          <div className="login-form-footer">
            <Space>
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/login')}
              >
                返回登录
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}
