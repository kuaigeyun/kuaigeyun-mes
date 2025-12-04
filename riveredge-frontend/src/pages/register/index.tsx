/**
 * 注册页面
 *
 * 提供注册入口页面
 */

import React from 'react';
import { Card, Button, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { UserAddOutlined, ApartmentOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * 注册页面组件
 */
export default function RegisterPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '600px',
          textAlign: 'center'
        }}
        title={
          <Space direction="vertical" size="small">
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              加入 RiverEdge SaaS
            </Title>
            <Text type="secondary">
              选择注册方式开始使用
            </Text>
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Link to="/register/personal">
            <Card
              hoverable
              style={{
                textAlign: 'left',
                borderColor: '#1890ff',
                borderWidth: '2px'
              }}
            >
              <Space align="start">
                <UserAddOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <div>
                  <Title level={4} style={{ margin: '0 0 8px 0' }}>
                    个人注册
                  </Title>
                  <Paragraph style={{ margin: 0, color: '#666' }}>
                    适合个人用户快速注册使用，支持加入组织
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </Link>

          <Link to="/register/organization">
            <Card
              hoverable
              style={{
                textAlign: 'left',
                borderColor: '#52c41a',
                borderWidth: '2px'
              }}
            >
              <Space align="start">
                <ApartmentOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <div>
                  <Title level={4} style={{ margin: '0 0 8px 0' }}>
                    组织注册
                  </Title>
                  <Paragraph style={{ margin: 0, color: '#666' }}>
                    适合企业用户创建新组织并管理成员
                  </Paragraph>
                </div>
              </Space>
            </Card>
          </Link>

          <div style={{ marginTop: '24px' }}>
            <Text type="secondary">
              已有账号？<Link to="/login">立即登录</Link>
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}
