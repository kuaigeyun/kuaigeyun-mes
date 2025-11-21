/**
 * 运营中心 - 套餐管理页面
 * 
 * 平台级套餐管理，用于展示和管理所有套餐配置。
 * 仅超级管理员可见。
 */

import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Descriptions,
  Space,
  Alert,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/services/api';

const { Title, Text, Paragraph } = Typography;

/**
 * 套餐配置接口
 */
interface PackageConfig {
  name: string;
  max_users: number;
  max_storage_mb: number;
  allow_pro_apps: boolean;
  description: string;
}

/**
 * 套餐管理页面组件
 */
export default function PackagesPage() {
  /**
   * 获取所有套餐配置
   */
  const { data: packageConfigs, isLoading } = useQuery<Record<string, PackageConfig>>({
    queryKey: ['packageConfigs'],
    queryFn: async () => {
      const response = await apiRequest<Record<string, PackageConfig>>('/tenants/packages/config', {
        method: 'GET',
      });
      return response;
    },
  });

  /**
   * 格式化存储空间
   */
  const formatStorage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  /**
   * 获取套餐标签颜色
   */
  const getPlanTagColor = (plan: string) => {
    switch (plan) {
      case 'trial':
        return 'default';
      case 'basic':
        return 'blue';
      case 'professional':
        return 'purple';
      case 'enterprise':
        return 'gold';
      default:
        return 'default';
    }
  };

  /**
   * 获取套餐中文名称
   */
  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'trial':
        return '体验套餐';
      case 'basic':
        return '基础版';
      case 'professional':
        return '专业版';
      case 'enterprise':
        return '企业版';
      default:
        return plan;
    }
  };

  return (
    <PageContainer
      title="套餐管理"
      subTitle="平台套餐配置和限制管理"
      loading={isLoading}
    >
      <Alert
        message="套餐配置说明"
        description="套餐配置通过配置文件管理，修改配置后需要重启服务生效。当前页面仅用于查看套餐配置信息。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {packageConfigs && (
        <Row gutter={[16, 16]}>
          {Object.entries(packageConfigs).map(([plan, config]) => (
            <Col xs={24} lg={12} key={plan}>
              <Card
                title={
                  <Space>
                    <Tag color={getPlanTagColor(plan)}>{getPlanName(plan)}</Tag>
                    <Text type="secondary">{config.name}</Text>
                  </Space>
                }
                extra={
                  <Tag color={config.allow_pro_apps ? 'success' : 'default'}>
                    {config.allow_pro_apps ? (
                      <>
                        <CheckCircleOutlined /> PRO 应用
                      </>
                    ) : (
                      <>
                        <CloseCircleOutlined /> 基础应用
                      </>
                    )}
                  </Tag>
                }
                style={{ height: '100%' }}
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="套餐名称">
                    <Text strong>{config.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="套餐描述">
                    <Paragraph style={{ margin: 0 }}>{config.description}</Paragraph>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <Space>
                        <UserOutlined />
                        <span>最大用户数</span>
                      </Space>
                    }
                  >
                    <Text strong>{config.max_users}</Text>
                    <Text type="secondary"> 人</Text>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <Space>
                        <DatabaseOutlined />
                        <span>最大存储空间</span>
                      </Space>
                    }
                  >
                    <Text strong>{formatStorage(config.max_storage_mb)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <Space>
                        <AppstoreOutlined />
                        <span>PRO 应用权限</span>
                      </Space>
                    }
                  >
                    {config.allow_pro_apps ? (
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        允许使用
                      </Tag>
                    ) : (
                      <Tag color="default" icon={<CloseCircleOutlined />}>
                        不允许使用
                      </Tag>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </PageContainer>
  );
}

