/**
 * 组织注册页面
 *
 * 提供组织注册功能
 */

import React from 'react';
import { Card, Typography, Button } from 'antd';
import { Link } from 'react-router-dom';
import { ApartmentOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * 组织注册页面组件
 */
export default function OrganizationRegisterPage() {
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
            <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
              <ApartmentOutlined style={{ marginRight: 12 }} />
              组织注册
            </Title>
            <Text type="secondary">
              创建新组织并开始使用 RiverEdge SaaS
            </Text>
          </Space>
        }
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '64px', color: '#52c41a', marginBottom: '24px' }}>
            <ApartmentOutlined />
          </div>

          <Title level={3} style={{ marginBottom: '16px' }}>
            功能开发中
          </Title>

          <Paragraph style={{ fontSize: '16px', marginBottom: '32px', color: '#666' }}>
            组织注册功能正在开发中，目前请使用个人注册功能加入现有组织。
          </Paragraph>

          <Space direction="vertical" size="medium" style={{ width: '100%' }}>
            <Link to="/register/personal">
              <Button type="primary" size="large" block>
                个人注册（推荐）
              </Button>
            </Link>

            <Link to="/register">
              <Button size="large" block>
                <ArrowLeftOutlined />
                返回注册选择
              </Button>
            </Link>
          </Space>
        </div>
      </Card>
    </div>
  );
}
